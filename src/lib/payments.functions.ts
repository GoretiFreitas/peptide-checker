import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, resolvePaymentsEnv } from "@/lib/stripe.server";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/** Create an embedded checkout session for support/donation/registry purchases. */
export const createSupportCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        priceId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
        returnUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const environment = resolvePaymentsEnv();
      const stripe = createStripeClient(environment);
      const prices = await stripe.prices.list({
        lookup_keys: [data.priceId],
        expand: ["data.product"],
      });
      if (!prices.data.length) throw new Error("Price not found");
      const price = prices.data[0];
      const isRecurring = price.type === "recurring";

      const { userId, supabase } = context;
      const { data: userInfo } = await supabase.auth.getUser();
      const email = userInfo.user?.email ?? undefined;

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const product =
        typeof price.product === "string"
          ? await stripe.products.retrieve(price.product)
          : price.product;
      const productName = (product as { name?: string }).name ?? "Purchase";

      const params: Stripe.Checkout.SessionCreateParams = {
        line_items: [{ price: price.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        ...(isRecurring
          ? { subscription_data: { metadata: { userId } } }
          : { payment_intent_data: { description: productName } }),
        metadata: { userId, kind: isRecurring ? "subscription" : "one_time" },
        // Crypto (USDC) requires a USD-presented amount; disable currency conversion.
        adaptive_pricing: { enabled: false },
      };

      // Full compliance handling (tax + fraud + disputes + support).
      // Not part of the pinned SDK type — cast to satisfy TS.
      (params as Record<string, unknown>).managed_payments = { enabled: true };

      const session = await stripe.checkout.sessions.create(params);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("createSupportCheckout error", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Open the Stripe customer portal for managing subscriptions / cancelling. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ returnUrl: z.string().url() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      const { supabase, userId } = context;
      const environment = resolvePaymentsEnv();
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) throw new Error("No subscription found");

      const stripe = createStripeClient(environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (error) {
      console.error("createPortalSession error", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

/** List the signed-in user's purchases in the current environment. */
export const getMyPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const environment = resolvePaymentsEnv();
    const { data: rows, error } = await supabase
      .from("purchases")
      .select(
        "id, created_at, kind, product_id, price_id, amount_cents, currency, status, refunded_cents, stripe_payment_intent_id, stripe_checkout_session_id",
      )
      .eq("user_id", userId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { purchases: [], error: error.message };
    return { purchases: rows ?? [] };
  });

/** Get the Stripe-hosted receipt URL for one of the signed-in user's purchases. */
export const getReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ purchaseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      const { supabase, userId } = context;
      const environment = resolvePaymentsEnv();
      const { data: p } = await supabase
        .from("purchases")
        .select("stripe_payment_intent_id, user_id, environment")
        .eq("id", data.purchaseId)
        .maybeSingle();
      if (!p || p.user_id !== userId || p.environment !== environment) {
        return { error: "Not found" };
      }
      if (!p.stripe_payment_intent_id) return { error: "No receipt available" };
      const stripe = createStripeClient(environment);
      const pi = await stripe.paymentIntents.retrieve(p.stripe_payment_intent_id, {
        expand: ["latest_charge"],
      });
      const charge = pi.latest_charge as Stripe.Charge | null;
      const url = charge?.receipt_url ?? null;
      if (!url) return { error: "No receipt yet" };
      return { url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Return the full published test report for a board item. Requires the caller
 * to hold either `registry_member` or `admin` role. Non-members should call
 * the public `getItem` for the redacted view.
 */
export const getFullReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const has = new Set((roles ?? []).map((r: { role: string }) => r.role));
    if (!has.has("registry_member") && !has.has("admin")) {
      return { error: "Registry access required" as const };
    }
    const [{ data: item }, { data: result }] = await Promise.all([
      supabase.from("board_items").select("*").eq("id", data.itemId).maybeSingle(),
      supabase
        .from("results")
        .select("*")
        .eq("item_id", data.itemId)
        .not("published_at", "is", null)
        .maybeSingle(),
    ]);
    if (!item || !result) return { error: "Report not found" as const };
    return { report: { item, result } };
  });

/**
 * One-time setup: set Stripe tax codes on our products so full compliance
 * handling can classify them. Idempotent; admin-only.
 */
export const applyStripeTaxCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ updated: string[] } | { error: string }> => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles || roles.length === 0) return { error: "Admins only" };
    try {
      const stripe = createStripeClient(resolvePaymentsEnv());
      const priceKeys = [
        "supporter_monthly",
        "supporter_yearly",
        "donate_10",
        "donate_25",
        "donate_100",
        "registry_full_500",
      ];
      const taxCodeByPriceKey: Record<string, string> = {
        supporter_monthly: "txcd_10103001",
        supporter_yearly: "txcd_10103001",
        donate_10: "txcd_10000000",
        donate_25: "txcd_10000000",
        donate_100: "txcd_10000000",
        registry_full_500: "txcd_10000000",
      };
      const updated: string[] = [];
      const seenProducts = new Set<string>();
      for (const key of priceKeys) {
        const list = await stripe.prices.list({ lookup_keys: [key], limit: 1 });
        const price = list.data[0];
        if (!price) continue;
        const productId = typeof price.product === "string" ? price.product : price.product.id;
        if (seenProducts.has(productId)) continue;
        seenProducts.add(productId);
        await stripe.products.update(productId, { tax_code: taxCodeByPriceKey[key] });
        updated.push(`${productId}=${taxCodeByPriceKey[key]}`);
      }
      return { updated };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
