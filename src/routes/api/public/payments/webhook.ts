import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";

async function getAdmin() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function handleEvent(event: { type: string; data: { object: any } }, env: StripeEnv) {
  const obj = event.data.object;
  const admin = await getAdmin();

  const pledgeId =
    obj?.metadata?.pledge_id ??
    obj?.payment_intent?.metadata?.pledge_id ??
    (obj?.payment_intent && typeof obj.payment_intent === "object"
      ? obj.payment_intent.metadata?.pledge_id
      : undefined);

  switch (event.type) {
    case "checkout.session.completed": {
      // For manual-capture sessions, this fires when auth succeeds.
      const paymentIntentId =
        typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id;
      const pid = obj.metadata?.pledge_id;
      if (pid) {
        await admin
          .from("pledges")
          .update({
            status: "authorized",
            stripe_payment_intent_id: paymentIntentId ?? null,
            environment: env,
          })
          .eq("id", pid);
      }
      break;
    }
    case "payment_intent.amount_capturable_updated": {
      const pid = obj.metadata?.pledge_id;
      if (pid) {
        await admin
          .from("pledges")
          .update({ status: "authorized", stripe_payment_intent_id: obj.id })
          .eq("id", pid);
      }
      break;
    }
    case "payment_intent.succeeded": {
      if (pledgeId) {
        await admin
          .from("pledges")
          .update({ status: "captured", stripe_payment_intent_id: obj.id })
          .eq("id", pledgeId);
      }
      break;
    }
    case "payment_intent.canceled":
    case "payment_intent.payment_failed": {
      if (pledgeId) {
        await admin
          .from("pledges")
          .update({
            status: event.type === "payment_intent.canceled" ? "cancelled" : "failed",
          })
          .eq("id", pledgeId);
      }
      break;
    }
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
