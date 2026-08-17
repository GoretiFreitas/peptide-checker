import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createStripeClient, getStripeErrorMessage, resolvePaymentsEnv } from "@/lib/stripe.server";
import { computeFundingTotals } from "@/lib/board-totals.server";
import { fetchProfileHandles, listCampaignBackers } from "@/lib/profiles.server";

let _publicSupabase: SupabaseClient<Database> | undefined;

function publicSupabase(): SupabaseClient<Database> {
  if (!_publicSupabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase public credentials not configured");
    }
    _publicSupabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
  }
  return _publicSupabase;
}

// ---------------- Public reads ----------------

export const getBoard = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicSupabase();
  const [items, totals] = await Promise.all([
    sb.from("board_items").select("*").order("created_at", { ascending: false }),
    computeFundingTotals(),
  ]);
  const itemRows = items.data ?? [];
  const backersByItem: Record<
    string,
    Array<{ amount_cents: number; created_at: string; initial: string }>
  > = {};

  if (itemRows.length > 0) {
    const itemIds = itemRows.map((it: { id: string }) => it.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pledgeData } = await (supabaseAdmin as any)
      .from("pledges")
      .select("item_id, amount_cents, created_at, user_id")
      .in("item_id", itemIds)
      .in("status", ["paid", "authorized", "captured"])
      .order("created_at", { ascending: false });

    const allPledges = (pledgeData as any[]) ?? [];
    const allUserIds = allPledges.map((p) => p.user_id);
    const handles = await fetchProfileHandles(allUserIds);

    for (const it of itemRows) {
      backersByItem[it.id] = [];
    }

    for (const p of allPledges) {
      const currentList = backersByItem[p.item_id];
      if (currentList && currentList.length < 12) {
        currentList.push({
          amount_cents: Number(p.amount_cents ?? 0),
          created_at: p.created_at,
          initial: (handles[p.user_id]?.[0] ?? "?").toUpperCase(),
        });
      }
    }
  }

  return {
    items: itemRows,
    totals,
    backers: backersByItem,
  };
});

export const getItem = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    const [item, stretch, totals, result, backers] = await Promise.all([
      sb.from("board_items").select("*").eq("id", data.id).maybeSingle(),
      sb.from("board_stretch_goals").select("*").eq("item_id", data.id),
      computeFundingTotals(data.id),
      sb.from("results").select("*").eq("item_id", data.id).maybeSingle(),
      listCampaignBackers(data.id),
    ]);
    return {
      item: item.data,
      stretch: stretch.data ?? [],
      totals: totals[0] ?? { item_id: data.id, pledged_cents: 0, backer_count: 0 },
      result: result.data,
      backers,
    };
  });

export const getCampaignBackers = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ item_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => listCampaignBackers(data.item_id));

export const getFundTotal = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicSupabase();
  const { data } = await sb.from("community_fund").select("total_cents").maybeSingle();
  return data?.total_cents ?? 0;
});

// ---------------- Signed-in actions ----------------

export const nominateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        product_name: z.string().min(2).max(200),
        seller: z.string().max(200).default(""),
        source_url: z.string().url().optional().or(z.literal("")),
        description: z.string().max(2000).optional(),
        lab: z.enum(["janoshik", "finnrick"]),
        test_battery: z.array(z.string()).default([]),
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
        lab: data.lab,
        test_battery: data.test_battery,
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
      .select(
        "id, item_id, amount_cents, status, environment, created_at, updated_at, refunded_cents, rolled_over_from_item_id, rolled_over_at, x_handle, display_mode, hide_amount, board_items(product_name, state)",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

const handleSchema = z
  .string()
  .max(15)
  .regex(/^[a-zA-Z0-9_]*$/, "Only letters, numbers and underscores")
  .transform((v) => v.replace(/^@/, "").trim())
  .optional()
  .or(z.literal(""));

export const getMyPledgeIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ item_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await (context.supabase as any)
      .from("pledges")
      .select("id, x_handle, display_mode, hide_amount, display_initials")
      .eq("item_id", data.item_id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (row as any) ?? null;
  });

export const updatePledgeIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        pledge_id: z.string().uuid(),
        x_handle: handleSchema,
        display_initials: z.string().max(3).optional().or(z.literal("")),
        display_mode: z.enum(["handle", "initials", "anonymous"]),
        hide_amount: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const handle = data.x_handle ? data.x_handle.replace(/^@/, "").trim() : null;
    if (handle && (handle.length < 1 || handle.length > 15 || !/^[a-zA-Z0-9_]+$/.test(handle))) {
      throw new Error("Invalid X handle");
    }
    const initials = (data.display_initials ?? "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase();

    // Ownership check with the caller's own (RLS-scoped) client.
    const { data: owned, error: readError } = await (context.supabase as any)
      .from("pledges")
      .select("id")
      .eq("id", data.pledge_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!owned) throw new Error("Contribution not found for your account");

    // RLS on `pledges` only allows admins to update, so perform the verified
    // identity-only write with the service client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("pledges")
      .update({
        x_handle: handle || null,
        display_initials: initials || null,
        display_mode: data.display_mode,
        hide_amount: data.hide_amount,
      })
      .eq("id", data.pledge_id)
      .eq("user_id", context.userId)
      .select("id, x_handle, display_mode, hide_amount, display_initials")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Could not save — contribution not updated");
    return updated as any;
  });

export const createPledgeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        item_id: z.string().uuid(),
        amount_cents: z.number().int().min(500).max(500000),
        return_url: z.string().url(),
        us_shipping_ack: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      // Never from the client: a caller who can pick "sandbox" could pay with a
      // test card and still be granted a real membership.
      const environment = resolvePaymentsEnv();
      // Verify item is in a fundable state
      const { data: item } = await (context.supabase.from("board_items") as any)
        .select("id, state, product_name, us_only, lab")
        .eq("id", data.item_id)
        .maybeSingle();
      if (!item) return { error: "Item not found" };
      if (item.state !== "funding" && item.state !== "nominated") {
        return { error: "This item is not currently accepting contributions." };
      }
      if (item.us_only && !data.us_shipping_ack) {
        return { error: "This campaign requires a US-shipping confirmation." };
      }

      const {
        data: { user },
      } = await context.supabase.auth.getUser();

      // Insert pending contribution (becomes `paid` on the verified webhook)
      const { data: pledge, error: insertErr } = await (context.supabase.from("pledges") as any)
        .insert({
          item_id: data.item_id,
          user_id: context.userId,
          amount_cents: data.amount_cents,
          status: "pending",
          environment,
          backer_email: user?.email ?? null,
        })
        .select("id")
        .single();
      if (insertErr || !pledge)
        return { error: insertErr?.message ?? "Could not create contribution" };

      const stripe = createStripeClient(environment);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.return_url,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `Contribution — ${item.product_name}` },
              unit_amount: data.amount_cents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          description: `Testing fund contribution — ${item.product_name}`,
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
        adaptive_pricing: { enabled: false },
        ...(user?.email && { customer_email: user.email }),
      });

      await context.supabase
        .from("pledges")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", pledge.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Confirm a completed pledge checkout straight from the return page.
 * The webhook is still the source of truth, but this makes the success state
 * (and membership) immediate even if the webhook is delayed. Idempotent.
 */
export const confirmPledgeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        session_id: z.string().min(10).max(200),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      paid: boolean;
      amount_cents: number;
      member: boolean;
      pledge_id?: string;
      error?: string;
    }> => {
      try {
        const environment = resolvePaymentsEnv();
        const stripe = createStripeClient(environment);
        const session = await stripe.checkout.sessions.retrieve(data.session_id);
        const meta = (session.metadata ?? {}) as Record<string, string>;
        if (meta.user_id !== context.userId) {
          return { paid: false, amount_cents: 0, member: false, error: "Not found" };
        }
        if (session.payment_status === "unpaid") {
          return { paid: false, amount_cents: 0, member: false };
        }
        const amount = Number(session.amount_total ?? 0);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        if (meta.pledge_id) {
          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : ((session.payment_intent as { id?: string } | null)?.id ?? null);

          let methodType: string | null = null;
          if (paymentIntentId) {
            try {
              const piFull: any = await stripe.paymentIntents.retrieve(paymentIntentId, {
                expand: ["latest_charge"],
              });
              methodType =
                piFull?.latest_charge?.payment_method_details?.type ??
                piFull?.payment_method_types?.[0] ??
                null;
            } catch {
              methodType = null;
            }
          }

          await admin
            .from("pledges")
            .update({
              status: "paid",
              stripe_payment_intent_id: paymentIntentId,
              backer_email: session.customer_details?.email ?? null,
              payment_method_type: methodType,
              environment,
            })
            .eq("id", meta.pledge_id)
            .neq("status", "refunded");
        }

        let member = false;
        if (amount >= 500) {
          await admin
            .from("user_roles")
            .upsert(
              { user_id: context.userId, role: "supporter" },
              { onConflict: "user_id,role", ignoreDuplicates: true },
            );
          member = true;
        }
        return { paid: true, amount_cents: amount, member, pledge_id: meta.pledge_id };
      } catch (error) {
        return { paid: false, amount_cents: 0, member: false, error: getStripeErrorMessage(error) };
      }
    },
  );

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
  .validator((d: unknown) =>
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
    const { error } = await (context.supabase.from("board_items") as any)
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Close a campaign: run the goal check. If funded, mark it funded.
 * Otherwise roll every paid contribution over to the most-backed active
 * campaign (backers become backers of that campaign) — no refunds.
 */
export const adminCloseCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ item_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const sb: any = context.supabase;

    const { data: item } = await sb
      .from("board_items")
      .select("id, product_name, goal_cents, state")
      .eq("id", data.item_id)
      .maybeSingle();
    if (!item) throw new Error("Campaign not found");

    const { data: contributions } = await sb
      .from("pledges")
      .select("id, amount_cents")
      .eq("item_id", data.item_id)
      .in("status", ["paid", "captured", "authorized"]);
    const raised = (contributions ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount_cents ?? 0),
      0,
    );
    const goal = Number(item.goal_cents ?? 0);

    if (goal > 0 && raised >= goal) {
      await sb.from("board_items").update({ state: "funded" }).eq("id", item.id);
      await sb.from("admin_activity").insert({
        kind: "campaign_closed",
        message: `${item.product_name} reached its goal — marked funded ($${(raised / 100).toFixed(2)}).`,
        meta: { item_id: item.id, raised_cents: raised, goal_cents: goal },
      });
      return { ok: true, outcome: "funded" as const, raised_cents: raised, rolled_over: 0 };
    }

    // Find the most-backed other active campaign
    const { data: candidates } = await sb
      .from("board_items")
      .select("id, product_name, state")
      .in("state", ["nominated", "funding"])
      .neq("id", item.id);
    const totals = await computeFundingTotals();
    const totalsById = new Map(
      (totals ?? []).map((t) => [t.item_id, Number(t.pledged_cents ?? 0)]),
    );
    const target = (candidates ?? [])
      .slice()
      .sort(
        (a: any, b: any) => Number(totalsById.get(b.id) ?? 0) - Number(totalsById.get(a.id) ?? 0),
      )[0];

    if (!target) {
      await sb.from("board_items").update({ state: "expired" }).eq("id", item.id);
      await sb.from("admin_activity").insert({
        kind: "campaign_closed",
        message: `${item.product_name} missed its goal and no active campaign was available for rollover.`,
        meta: { item_id: item.id, raised_cents: raised },
      });
      return { ok: true, outcome: "no_target" as const, raised_cents: raised, rolled_over: 0 };
    }

    const now = new Date().toISOString();
    const ids = (contributions ?? []).map((c: any) => c.id);
    if (ids.length) {
      await sb
        .from("pledges")
        .update({
          item_id: target.id,
          rolled_over_from_item_id: item.id,
          rolled_over_at: now,
        })
        .in("id", ids);
    }
    await sb.from("board_items").update({ state: "expired" }).eq("id", item.id);
    await sb.from("admin_activity").insert({
      kind: "rollover",
      message: `${item.product_name} missed its goal — $${(raised / 100).toFixed(2)} from ${ids.length} contribution(s) rolled over to ${target.product_name}. Backers must be notified.`,
      meta: {
        from_item_id: item.id,
        to_item_id: target.id,
        raised_cents: raised,
        contributions: ids.length,
      },
    });

    return {
      ok: true,
      outcome: "rolled_over" as const,
      raised_cents: raised,
      rolled_over: ids.length,
      target: target.product_name as string,
    };
  });

/** Revenue + backer metrics across all campaigns. Admin only. */
export const adminFundMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    const { data: rows } = await sb
      .from("pledges")
      .select(
        "id, item_id, user_id, backer_email, amount_cents, refunded_cents, status, created_at, stripe_payment_intent_id, payment_method_type, rolled_over_from_item_id, board_items(product_name)",
      )
      .in("status", ["paid", "captured", "refunded"])
      .order("created_at", { ascending: false })
      .limit(5000);

    const list = (rows ?? []) as any[];
    const paid = list.filter((r) => r.status !== "refunded");
    const grossCents = paid.reduce((s, r) => s + Number(r.amount_cents ?? 0), 0);
    const refundedCents = list.reduce((s, r) => s + Number(r.refunded_cents ?? 0), 0);
    const uniqueBackers = new Set(paid.map((r) => r.user_id ?? r.backer_email ?? r.id)).size;

    const perCampaign = new Map<string, any>();
    for (const r of paid) {
      const key = r.item_id;
      const c = perCampaign.get(key) ?? {
        item_id: key,
        product_name: r.board_items?.product_name ?? "—",
        gross_cents: 0,
        contributions: 0,
        backers: new Set<string>(),
      };
      c.gross_cents += Number(r.amount_cents ?? 0);
      c.contributions += 1;
      c.backers.add(r.user_id ?? r.backer_email ?? r.id);
      perCampaign.set(key, c);
    }
    const campaigns = [...perCampaign.values()]
      .map((c) => ({
        item_id: c.item_id,
        product_name: c.product_name,
        gross_cents: c.gross_cents,
        contributions: c.contributions,
        unique_backers: c.backers.size,
      }))
      .sort((a, b) => b.gross_cents - a.gross_cents);

    const perDay = new Map<string, number>();
    for (const r of paid) {
      const day = String(r.created_at).slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + Number(r.amount_cents ?? 0));
    }
    const daily = [...perDay.entries()]
      .map(([day, cents]) => ({ day, cents }))
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 30);

    const transactions = list.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      backer_email: r.backer_email ?? "—",
      campaign: r.board_items?.product_name ?? "—",
      amount_cents: Number(r.amount_cents ?? 0),
      refunded_cents: Number(r.refunded_cents ?? 0),
      status: r.status === "refunded" ? "refunded" : "paid",
      stripe_payment_intent_id: r.stripe_payment_intent_id ?? "",
      payment_method_type: r.payment_method_type ?? "",
      rolled_over: !!r.rolled_over_from_item_id,
    }));

    return {
      gross_cents: grossCents,
      refunded_cents: refundedCents,
      net_cents: grossCents - refundedCents,
      unique_backers: uniqueBackers,
      contributions: paid.length,
      campaigns,
      daily,
      transactions,
    };
  });

export const adminPublishResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
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
    await context.supabase
      .from("board_items")
      .update({ state: "published" })
      .eq("id", data.item_id);
    return { ok: true };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { admin: !!data };
  });
