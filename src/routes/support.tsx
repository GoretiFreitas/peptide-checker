import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { SiteHeader } from "@/components/SiteHeader";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";
import { createSupportCheckout, createPortalSession } from "@/lib/payments.functions";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/support")({
  validateSearch: (s: Record<string, unknown>) => ({
    checkout: typeof s.checkout === "string" ? s.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Support — Certificate Checker" },
      {
        name: "description",
        content:
          "Support independent peptide testing through a monthly or yearly membership, a one-time donation, or by unlocking full registry access.",
      },
      { property: "og:title", content: "Support — Certificate Checker" },
      {
        property: "og:description",
        content: "Fund independent peptide testing. Membership, donations, and registry access.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/support" },
    ],
    links: [{ rel: "canonical", href: "/support" }],
  }),
  component: SupportPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-10 font-serif">
      <p>Something went wrong: {error.message}</p>
      <button onClick={reset} className="underline">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-10">Not found</div>,
});

const OPTIONS: Array<{
  id: string;
  priceId: string;
  title: string;
  price: string;
  blurb: string;
  kind: "sub" | "one";
}> = [
  {
    id: "supporter_monthly",
    priceId: "supporter_monthly",
    title: "Supporter — Monthly",
    price: "$5 / month",
    blurb: "Recurring support. Cancel anytime, access continues until period end.",
    kind: "sub",
  },
  {
    id: "supporter_yearly",
    priceId: "supporter_yearly",
    title: "Supporter — Yearly",
    price: "$50 / year",
    blurb: "Two months free. Same benefits as monthly.",
    kind: "sub",
  },
  { id: "donate_10", priceId: "donate_10", title: "Donate $10", price: "$10", blurb: "One-time contribution to the testing fund.", kind: "one" },
  { id: "donate_25", priceId: "donate_25", title: "Donate $25", price: "$25", blurb: "One-time contribution to the testing fund.", kind: "one" },
  { id: "donate_100", priceId: "donate_100", title: "Donate $100", price: "$100", blurb: "One-time contribution to the testing fund.", kind: "one" },
  {
    id: "registry_full_500",
    priceId: "registry_full_500",
    title: "Registry Full Access",
    price: "$500",
    blurb: "Unlocks every published independent test report and archive download in the registry.",
    kind: "one",
  },
];

function SupportPage() {
  const navigate = useNavigate();
  const { checkout } = Route.useSearch();
  const [userId, setUserId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState(checkout === "success");
  const { sub, isActive, isPastDue } = useSubscription(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: s } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setUserId(session?.user?.id ?? null);
    });
    return () => s.subscription.unsubscribe();
  }, []);

  // On return from Stripe, clear the checkout iframe and celebrate briefly.
  useEffect(() => {
    if (checkout === "success") {
      setClientSecret(null);
      setSelecting(null);
      setJustPurchased(true);
      // Strip the query param so a refresh doesn't re-trigger the banner.
      navigate({ to: "/support", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  const openCheckout = async (priceId: string) => {
    setError(null);
    if (!userId) {
      navigate({ to: "/auth", search: { redirect: "/support" } as any });
      return;
    }
    setSelecting(priceId);
    try {
      const env = getStripeEnvironment();
      const returnUrl = `${window.location.origin}/support?checkout=success`;
      const res = await createSupportCheckout({ data: { priceId, returnUrl, environment: env } });
      if ("error" in res) throw new Error(res.error);
      setClientSecret(res.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setSelecting(null);
    }
  };

  const openPortal = async () => {
    try {
      const env = getStripeEnvironment();
      const returnUrl = `${window.location.origin}/support`;
      const res = await createPortalSession({ data: { returnUrl, environment: env } });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <SiteHeader />
      <main className="mx-auto max-w-[1000px] px-6 py-16 md:px-10">
        <h1 className="font-serif text-5xl tracking-tight md:text-6xl">Support the cooperative.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          The cooperative funds independent testing of peptide products. Every contribution goes to
          the community testing fund, minus payment-processor fees.
        </p>

        {justPurchased && (
          <div className="mt-8 rounded-md border border-dashed border-emerald-600/40 bg-emerald-50/40 p-4 text-sm text-emerald-900">
            Thank you — your payment went through. Access and receipts will appear here in a moment
            (they arrive from Stripe via webhook).
            <button
              className="ml-3 underline"
              onClick={() => setJustPurchased(false)}
            >
              Dismiss
            </button>
          </div>
        )}


        {isPastDue && (
          <div className="mt-8 rounded-md border border-dashed border-yellow-600/40 bg-yellow-50/40 p-4 text-sm">
            Your last payment did not go through. Stripe is retrying automatically — your access
            stays active for now.{" "}
            <button onClick={openPortal} className="underline">Update payment method</button>.
          </div>
        )}

        {isActive && sub && (
          <div className="mt-8 rounded-md border border-border bg-secondary/40 p-5">
            <p className="text-sm">
              You&apos;re a supporter ({sub.price_id.replace("supporter_", "")}).{" "}
              {sub.cancel_at_period_end && sub.current_period_end && (
                <span>Access continues until {new Date(sub.current_period_end).toLocaleDateString()}. </span>
              )}
            </p>
            <button onClick={openPortal} className="mt-3 text-xs uppercase tracking-[0.18em] underline">
              Manage subscription
            </button>
          </div>
        )}

        {clientSecret ? (
          <div className="mt-10">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
            <button
              className="mt-6 text-xs uppercase tracking-[0.18em] underline"
              onClick={() => {
                setClientSecret(null);
                setSelecting(null);
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {OPTIONS.map((o) => (
              <div key={o.id} className="rounded-md border border-dashed border-border p-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-serif text-2xl">{o.title}</h2>
                  <span className="text-sm text-muted-foreground">{o.price}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{o.blurb}</p>
                <button
                  disabled={selecting === o.priceId}
                  onClick={() => openCheckout(o.priceId)}
                  className="mt-5 rounded-sm border border-foreground px-4 py-2 text-xs uppercase tracking-[0.18em] hover:bg-foreground hover:text-background disabled:opacity-50"
                >
                  {selecting === o.priceId ? "Loading…" : o.kind === "sub" ? "Subscribe" : "Contribute"}
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

        <p className="mt-16 text-xs text-muted-foreground">
          <Link to="/board" className="underline">Or fund a specific product test on the board →</Link>
        </p>
      </main>
    </div>
  );
}
