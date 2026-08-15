import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv, createStripeClient } from "@/lib/stripe.server";

async function getAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// ------- Entitlement helpers -------

async function grantRole(admin: any, userId: string, role: "supporter" | "registry_member") {
  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
}
async function revokeRole(admin: any, userId: string, role: "supporter" | "registry_member") {
  await admin.from("user_roles").delete().eq("user_id", userId).eq("role", role);
}

async function creditFund(admin: any, deltaCents: number, note: string, meta: any) {
  if (!deltaCents) return;
  // Read-modify-write; single-row table
  const { data } = await admin.from("community_fund").select("total_cents").eq("id", true).single();
  const current = Number(data?.total_cents ?? 0);
  await admin
    .from("community_fund")
    .update({ total_cents: current + deltaCents, updated_at: new Date().toISOString() })
    .eq("id", true);
  await admin.from("admin_activity").insert({
    kind: "fund_credit",
    message: `${deltaCents >= 0 ? "Credited" : "Debited"} ${(deltaCents / 100).toFixed(2)} USD — ${note}`,
    meta,
  });
}

// ------- Subscription handlers -------

function priceLookup(item: any): string | null {
  return (
    item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id || null
  );
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const admin = await getAdmin();
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn("Subscription without userId metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = priceLookup(item);
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  // Entitlement logic:
  // active/trialing/past_due -> keep supporter role (past_due is dunning grace)
  // canceled with future period_end -> keep until period ends
  // otherwise -> revoke
  const now = Date.now();
  const activeStatuses = ["active", "trialing", "past_due"];
  const stillPaid = periodEnd && periodEnd * 1000 > now;
  const shouldGrant =
    activeStatuses.includes(subscription.status) ||
    (subscription.status === "canceled" && stillPaid);
  if (shouldGrant) await grantRole(admin, userId, "supporter");
  else await revokeRole(admin, userId, "supporter");

  await admin.from("admin_activity").insert({
    kind: "subscription",
    message: `Subscription ${subscription.id} → ${subscription.status}`,
    meta: { userId, priceId, cancel_at_period_end: subscription.cancel_at_period_end },
  });
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const admin = await getAdmin();
  await admin
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  const userId = subscription.metadata?.userId;
  if (userId) {
    await revokeRole(admin, userId, "supporter");
    await admin.from("admin_activity").insert({
      kind: "subscription",
      message: `Subscription ${subscription.id} deleted; supporter role revoked`,
      meta: { userId },
    });
  }
}

// ------- One-time purchase handling (donations, registry) -------

async function handleCheckoutSessionCompleted(
  session: any,
  env: StripeEnv,
  stripeEnvKey: StripeEnv,
) {
  // Fund contributions live under board.functions and use `metadata.pledge_id`.
  const pledgeId = session.metadata?.pledge_id;
  if (pledgeId) {
    if (session.payment_status === "unpaid") return;
    const admin = await getAdmin();
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    // Which payment method the backer used (card, crypto, ...) for the audit trail.
    let methodType: string | null = null;
    if (paymentIntentId) {
      try {
        const stripeForMethod = createStripeClient(stripeEnvKey);
        const piFull: any = await stripeForMethod.paymentIntents.retrieve(paymentIntentId, {
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
        stripe_payment_intent_id: paymentIntentId ?? null,
        backer_email: session.customer_details?.email ?? session.customer_email ?? null,
        payment_method_type: methodType,
        environment: env,
      })
      .eq("id", pledgeId);

    // Backing a pool with $5 or more grants membership (supporter role).
    const backerUserId = session.metadata?.user_id;
    const amountTotal = Number(session.amount_total ?? 0);
    if (backerUserId && amountTotal >= 500) {
      await grantRole(admin, backerUserId, "supporter");
      await admin.from("admin_activity").insert({
        kind: "membership",
        message: `Membership granted from a $${(amountTotal / 100).toFixed(2)} fund contribution.`,
        meta: { user_id: backerUserId, pledge_id: pledgeId },
      });
    }
    return;
  }

  // Subscription checkouts: the subscription.created event will handle entitlement.
  if (session.mode !== "payment") return;

  const userId = session.metadata?.userId;
  const admin = await getAdmin();
  const stripe = createStripeClient(stripeEnvKey);

  // Expand line items to identify the product/price
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items", "payment_intent.latest_charge.balance_transaction"],
  });
  const line = full.line_items?.data?.[0];
  const priceObj: any = line?.price;
  const priceLookupKey =
    priceObj?.lookup_key || priceObj?.metadata?.lovable_external_id || priceObj?.id || null;
  const productId =
    typeof priceObj?.product === "string" ? priceObj.product : priceObj?.product?.id;

  const pi: any = full.payment_intent;
  const paymentIntentId = typeof pi === "string" ? pi : pi?.id;
  const charge = typeof pi === "object" ? pi?.latest_charge : null;
  const balanceTx: any = typeof charge === "object" ? charge?.balance_transaction : null;
  const netCents = typeof balanceTx === "object" ? Number(balanceTx?.net ?? 0) : null;
  const purchaseMethodType: string | null =
    (typeof charge === "object" ? (charge as any)?.payment_method_details?.type : null) ??
    (typeof pi === "object" ? pi?.payment_method_types?.[0] : null) ??
    null;

  const amount = Number(full.amount_total ?? 0);
  let kind: "donation" | "registry" | "other" = "other";
  if (productId === "community_donation" || String(priceLookupKey).startsWith("donate_"))
    kind = "donation";
  else if (
    productId === "registry_access" ||
    priceLookupKey === "registry_full_500" ||
    priceLookupKey === "registry_lifetime"
  )
    kind = "registry";

  await admin.from("purchases").upsert(
    {
      user_id: userId ?? null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId ?? null,
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : session.customer?.id,
      product_id: productId ?? "unknown",
      price_id: priceLookupKey,
      kind,
      amount_cents: amount,
      net_cents: netCents,
      currency: full.currency ?? "usd",
      payment_method_type: purchaseMethodType,
      status: "succeeded",
      environment: env,
      metadata: { session_metadata: session.metadata },
    },
    { onConflict: "stripe_checkout_session_id" },
  );

  // Registry unlock: grant role
  if (kind === "registry" && userId) {
    await grantRole(admin, userId, "registry_member");
    await admin.from("admin_activity").insert({
      kind: "purchase",
      message: `Registry access granted`,
      meta: { userId, amount_cents: amount },
    });
  }

  // Donations: credit the community fund (net of Stripe fees when available)
  if (kind === "donation") {
    const credit = netCents ?? amount;
    await admin
      .from("purchases")
      .update({ credited_to_fund: true, fund_credit_cents: credit })
      .eq("stripe_checkout_session_id", session.id);
    await creditFund(admin, credit, "donation", { session_id: session.id, userId });
  }
}

async function handleChargeRefunded(charge: any, env: StripeEnv) {
  const admin = await getAdmin();
  const pi =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const refunded = Number(charge.amount_refunded ?? 0);
  const total = Number(charge.amount ?? 0);
  const status = refunded >= total ? "refunded" : "partially_refunded";

  // Mirror refunds onto fund contributions (manual admin refunds only —
  // a missed goal never triggers a refund; it rolls over instead).
  await admin
    .from("pledges")
    .update({
      refunded_cents: refunded,
      ...(status === "refunded" ? { status: "refunded" } : {}),
    })
    .eq("stripe_payment_intent_id", pi)
    .eq("environment", env);

  const { data: purchase } = await admin
    .from("purchases")
    .select("id, user_id, kind, fund_credit_cents, credited_to_fund")
    .eq("stripe_payment_intent_id", pi)
    .eq("environment", env)
    .maybeSingle();
  if (!purchase) return;

  await admin
    .from("purchases")
    .update({ status, refunded_cents: refunded, updated_at: new Date().toISOString() })
    .eq("id", purchase.id);

  // Full-refund entitlement revocation
  if (status === "refunded" && purchase.user_id) {
    if (purchase.kind === "registry") {
      await revokeRole(admin, purchase.user_id, "registry_member");
    }
    if (purchase.kind === "subscription_charge") {
      // Supporter refund → revoke immediately per business rule
      await revokeRole(admin, purchase.user_id, "supporter");
    }
  }
  // If fund was credited on this purchase, debit the fund by the same amount
  if (status === "refunded" && purchase.credited_to_fund && purchase.fund_credit_cents) {
    await creditFund(admin, -Number(purchase.fund_credit_cents), `${purchase.kind} refund`, {
      purchase_id: purchase.id,
    });
  }
  await admin.from("admin_activity").insert({
    kind: "refund",
    message: `Refund on ${pi} — ${status}`,
    meta: { purchase_id: purchase.id, kind: purchase.kind, refunded_cents: refunded },
  });
}

// Membership renewals & initial subscription invoices: record as a purchase
// (kind='subscription_charge') and credit 60% of net revenue to the fund.
const MEMBERSHIP_FUND_SHARE = 0.6;

async function handleInvoicePaid(invoice: any, env: StripeEnv, stripeEnvKey: StripeEnv) {
  // Only paid subscription invoices with a real charge
  if (!invoice || invoice.status !== "paid") return;
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subscriptionId) return; // one-off invoices handled via checkout.session.completed
  const paymentIntentId =
    typeof invoice.payment_intent === "string"
      ? invoice.payment_intent
      : invoice.payment_intent?.id;
  if (!paymentIntentId) return;

  const admin = await getAdmin();
  const stripe = createStripeClient(stripeEnvKey);

  // Pull userId from the subscription (most reliable place we set it)
  const sub: any = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = sub.metadata?.userId ?? null;

  // Retrieve the charge for net (after Stripe fees) via balance transaction
  const pi: any = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge: any = pi?.latest_charge;
  const bt: any = charge?.balance_transaction;
  const netCents = typeof bt === "object" && bt ? Number(bt.net ?? 0) : null;
  const amount = Number(invoice.amount_paid ?? invoice.total ?? 0);

  const item = sub.items?.data?.[0];
  const priceLookup =
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id ||
    null;
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;

  // Compute fund credit: 60% of net (Stripe fee-adjusted) revenue
  const baseForFund = netCents ?? amount;
  const fundCredit = Math.floor(baseForFund * MEMBERSHIP_FUND_SHARE);

  const { error: upsertErr } = await admin.from("purchases").upsert(
    {
      user_id: userId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: null,
      stripe_customer_id:
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
      product_id: productId ?? "supporter_membership",
      price_id: priceLookup,
      kind: "subscription_charge",
      amount_cents: amount,
      net_cents: netCents,
      currency: invoice.currency ?? "usd",
      status: "succeeded",
      environment: env,
      credited_to_fund: fundCredit > 0,
      fund_credit_cents: fundCredit > 0 ? fundCredit : null,
      metadata: {
        subscription_id: subscriptionId,
        invoice_id: invoice.id,
        billing_reason: invoice.billing_reason,
      },
    },
    { onConflict: "stripe_payment_intent_id", ignoreDuplicates: false },
  );
  if (upsertErr) {
    console.error("invoice.paid upsert error", upsertErr);
    return;
  }

  if (fundCredit > 0) {
    await creditFund(admin, fundCredit, "supporter membership (60% share)", {
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
      userId,
    });
  }
}

async function handleCheckoutSessionExpired(session: any, env: StripeEnv) {
  const pledgeId = session.metadata?.pledge_id;
  if (!pledgeId) return;
  const admin = await getAdmin();
  await admin
    .from("pledges")
    .update({ status: "cancelled" })
    .eq("id", pledgeId)
    .eq("environment", env)
    .eq("status", "pending");
}

// ------- Pledge event forwarding (unchanged) -------

async function handlePledgeEvent(event: { type: string; data: { object: any } }, env: StripeEnv) {
  const obj = event.data.object;
  const admin = await getAdmin();
  const pledgeId =
    obj?.metadata?.pledge_id ??
    (obj?.payment_intent && typeof obj.payment_intent === "object"
      ? obj.payment_intent.metadata?.pledge_id
      : undefined);
  if (!pledgeId) return;

  switch (event.type) {
    case "payment_intent.succeeded":
      await admin
        .from("pledges")
        .update({ status: "paid", stripe_payment_intent_id: obj.id, environment: env })
        .eq("id", pledgeId);
      break;
    case "payment_intent.canceled":
    case "payment_intent.payment_failed":
      await admin
        .from("pledges")
        .update({ status: event.type === "payment_intent.canceled" ? "cancelled" : "failed" })
        .eq("id", pledgeId);
      break;
  }
}

// ------- Dispatcher -------

async function handleEvent(event: { type: string; data: { object: any } }, env: StripeEnv) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object, env, env);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object, env);
      break;
    case "invoice.payment_succeeded":
    case "invoice.paid":
      await handleInvoicePaid(event.data.object, env, env);
      break;
    case "checkout.session.expired":
      await handleCheckoutSessionExpired(event.data.object, env);
      break;
    case "payment_intent.amount_capturable_updated":
    case "payment_intent.succeeded":
    case "payment_intent.canceled":
    case "payment_intent.payment_failed":
      await handlePledgeEvent(event, env);
      break;
    default:
      console.log("Unhandled event", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          const event = await verifyWebhook(request, rawEnv);
          await handleEvent(event, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
