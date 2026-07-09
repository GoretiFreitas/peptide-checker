import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// ---------------- Public reads ----------------

export const getBoard = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicSupabase();
  const [items, totals] = await Promise.all([
    sb.from("board_items").select("*").order("created_at", { ascending: false }),
    sb.from("item_funding_totals").select("*"),
  ]);
  return {
    items: items.data ?? [],
    totals: totals.data ?? [],
  };
});

export const getItem = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    const [item, stretch, totals, result] = await Promise.all([
      sb.from("board_items").select("*").eq("id", data.id).maybeSingle(),
      sb.from("board_stretch_goals").select("*").eq("item_id", data.id),
      sb.from("item_funding_totals").select("*").eq("item_id", data.id).maybeSingle(),
      sb.from("results").select("*").eq("item_id", data.id).maybeSingle(),
    ]);
    return {
      item: item.data,
      stretch: stretch.data ?? [],
      totals: totals.data,
      result: result.data,
    };
  });

export const getFundTotal = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicSupabase();
  const { data } = await sb.from("community_fund").select("total_cents").maybeSingle();
  return data?.total_cents ?? 0;
});

// ---------------- Signed-in actions ----------------

export const nominateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        product_name: z.string().min(2).max(200),
        seller: z.string().max(200).default(""),
        source_url: z.string().url().optional().or(z.literal("")),
        description: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("board_items")
      .insert({
        product_name: data.product_name,
        seller: data.seller,
        source_url: data.source_url || null,
        description: data.description || null,
        state: "nominated",
        nominated_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getMyPledges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("pledges")
      .select("*, board_items(product_name, state)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createPledgeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        item_id: z.string().uuid(),
        amount_cents: z.number().int().min(500).max(500000),
        return_url: z.string().url(),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      // Verify item is in a fundable state
      const { data: item } = await context.supabase
        .from("board_items")
        .select("id, state, product_name")
        .eq("id", data.item_id)
        .maybeSingle();
      if (!item) return { error: "Item not found" };
      if (item.state !== "funding" && item.state !== "nominated") {
        return { error: "This item is not currently accepting pledges." };
      }

      // Insert pending pledge
      const { data: pledge, error: insertErr } = await context.supabase
        .from("pledges")
        .insert({
          item_id: data.item_id,
          user_id: context.userId,
          amount_cents: data.amount_cents,
          status: "pending",
          environment: data.environment,
        })
        .select()
        .single();
      if (insertErr || !pledge) return { error: insertErr?.message ?? "Could not create pledge" };

      const stripe = createStripeClient(data.environment as StripeEnv);
      const { data: { user } } = await context.supabase.auth.getUser();

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.return_url,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `Pledge — ${item.product_name}` },
              unit_amount: data.amount_cents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          capture_method: "manual",
          description: `Testing board pledge — ${item.product_name}`,
          metadata: {
            pledge_id: pledge.id,
            item_id: item.id,
            user_id: context.userId,
          },
        },
        
        metadata: {
          pledge_id: pledge.id,
          item_id: item.id,
          user_id: context.userId,
        },
        ...(user?.email && { customer_email: user.email }),
      });

      // Store checkout session id
      await context.supabase
        .from("pledges")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", pledge.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// ---------------- Admin actions ----------------

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const adminSetItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        state: z
          .enum(["nominated", "funding", "funded", "procuring", "testing", "published", "expired"])
          .optional(),
        sample_cost_cents: z.number().int().min(0).optional(),
        test_cost_cents: z.number().int().min(0).optional(),
        operations_margin_cents: z.number().int().min(0).optional(),
        funding_deadline: z.string().optional().nullable(),
        description: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const patch: Record<string, any> = {};
    for (const k of [
      "state",
      "sample_cost_cents",
      "test_cost_cents",
      "operations_margin_cents",
      "funding_deadline",
      "description",
    ] as const) {
      if (data[k] !== undefined) patch[k] = data[k];
    }
    const { error } = await (context.supabase.from("board_items") as any).update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSettlePledges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        item_id: z.string().uuid(),
        action: z.enum(["capture", "cancel"]),
        environment: z.enum(["sandbox", "live"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: pledges } = await context.supabase
      .from("pledges")
      .select("id, stripe_payment_intent_id, amount_cents")
      .eq("item_id", data.item_id)
      .eq("status", "authorized");
    if (!pledges?.length) return { ok: true, processed: 0 };

    const stripe = createStripeClient(data.environment as StripeEnv);
    let processed = 0;
    for (const p of pledges) {
      if (!p.stripe_payment_intent_id) continue;
      try {
        if (data.action === "capture") {
          await stripe.paymentIntents.capture(p.stripe_payment_intent_id);
          await context.supabase.from("pledges").update({ status: "captured" }).eq("id", p.id);
        } else {
          await stripe.paymentIntents.cancel(p.stripe_payment_intent_id);
          await context.supabase.from("pledges").update({ status: "cancelled" }).eq("id", p.id);
        }
        processed++;
      } catch (e) {
        console.error("Settle error", p.id, e);
      }
    }

    // Move state
    if (data.action === "capture") {
      await context.supabase.from("board_items").update({ state: "procuring" }).eq("id", data.item_id);
    } else {
      await context.supabase.from("board_items").update({ state: "expired" }).eq("id", data.item_id);
    }
    return { ok: true, processed };
  });

export const adminPublishResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        item_id: z.string().uuid(),
        batch_id: z.string().optional(),
        lab_name: z.string().optional(),
        summary: z.string().min(10),
        verdict: z.enum(["consistent", "concerns", "failed", "insufficient"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("results").upsert(
      {
        item_id: data.item_id,
        batch_id: data.batch_id ?? null,
        lab_name: data.lab_name ?? null,
        summary: data.summary,
        verdict: data.verdict,
        signed_off_by: context.userId,
        signed_off_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      },
      { onConflict: "item_id" },
    );
    if (error) throw new Error(error.message);
    await context.supabase.from("board_items").update({ state: "published" }).eq("id", data.item_id);
    return { ok: true };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });
