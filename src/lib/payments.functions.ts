import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

const envSchema = z.enum(["sandbox", "live"]);

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
  .inputValidator((d) =>
    z
      .object({
        priceId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
        returnUrl: z.string().url(),
        environment: envSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId], expand: ["data.product"] });
      if (!prices.data.length) throw new Error("Price not found");
      const price = prices.data[0];
      const isRecurring = price.type === "recurring";

      const { userId, supabase } = context;
      const { data: userInfo } = await supabase.auth.getUser();
      const email = userInfo.user?.email ?? undefined;

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const product = typeof price.product === "string"
        ? await stripe.products.retrieve(price.product)
        : price.product;
      const productName = (product as { name?: string }).name ?? "Purchase";

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        ...(isRecurring
          ? { subscription_data: { metadata: { userId } } }
          : { payment_intent_data: { description: productName } }),
        metadata: { userId, kind: isRecurring ? "subscription" : "one_time" },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("createSupportCheckout error", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Open the Stripe customer portal for managing subscriptions / cancelling. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ returnUrl: z.string().url(), environment: envSchema }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      const { supabase, userId } = context;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub?.stripe_customer_id) throw new Error("No subscription found");

      const stripe = createStripeClient(data.environment);
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
