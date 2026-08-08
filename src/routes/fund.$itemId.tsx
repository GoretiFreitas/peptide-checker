import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { getItem, createPledgeCheckout } from "@/lib/board.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/fund/$itemId")({
  loader: async ({ params }) => {
    try {
      const res = await getItem({ data: { id: params.itemId } });
      return { productName: (res.item as { product_name?: string } | null)?.product_name ?? null };
    } catch {
      return { productName: null };
    }
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.productName;
    const title = name
      ? `${name} — Peptide Testing Fund`
      : "Peptide Testing Fund — Certificate Checker";
    const desc = name
      ? `Back the independent test of ${name}. Contributions are charged immediately and always fund independent testing.`
      : "Back an independent test of a peptide product on the community testing fund.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: `/fund/${params.itemId}` },
      ],
      links: [{ rel: "canonical", href: `/fund/${params.itemId}` }],
    };
  },
  component: ItemDetail,
  errorComponent: ({ error }) => (
    <div className="p-10 font-serif">Something went wrong: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-10">Item not found.</div>,
});

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

const stateStyle: Record<string, string> = {
  nominated: "bg-[#EDEBE3] text-[#4A4842]",
  funding: "bg-[#FBF0DC] text-[#7A4E12]",
  funded: "bg-[#E4F1EE] text-[#0F5A4F]",
  procuring: "bg-[#FBF0DC] text-[#7A4E12]",
  testing: "bg-[#FBF0DC] text-[#7A4E12]",
  published: "bg-[#E7F1EA] text-[#1E5637]",
  expired: "bg-[#F7E4E1] text-[#7C271E]",
};

function ItemDetail() {
  const { itemId } = Route.useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["board", itemId],
    queryFn: () => getItem({ data: { id: itemId } }),
  });

  const [amount, setAmount] = useState(2500);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  const pledge = useMutation({
    mutationFn: async () => {
      const res = await createPledgeCheckout({
        data: {
          item_id: itemId,
          amount_cents: amount,
          return_url: `${window.location.origin}/fund/${itemId}?pledged=1`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in res) throw new Error(res.error);
      return res.clientSecret;
    },
    onSuccess: (secret) => {
      setClientSecret(secret);
      setCheckoutError(null);
    },
    onError: (e: any) => setCheckoutError(e.message ?? "Could not start contribution"),
  });

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[900px] px-6 py-12 text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const item = query.data?.item;
  const totals = query.data?.totals as any;
  const stretch = query.data?.stretch ?? [];
  const result = query.data?.result as any;

  if (!item) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[900px] px-6 py-12">
          <div className="text-sm text-muted-foreground">Item not found.</div>
          <Link to="/fund" className="mt-4 inline-block text-sm underline">
            ← Back to fund
          </Link>
        </div>
      </div>
    );
  }

  const goal = item.goal_cents ?? 0;
  const pledged = totals?.pledged_cents ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((pledged / goal) * 100)) : 0;
  const fundable = item.state === "funding" || item.state === "nominated";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-6 py-10 md:px-10">
        <Link
          to="/fund"
          className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground"
        >
          ← Fund
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span
            className={`rounded-sm px-2 py-1 text-[10px] font-medium tracking-[0.18em] uppercase ${stateStyle[item.state] ?? "bg-secondary"}`}
          >
            {item.state}
          </span>
          {item.seller && (
            <span className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
              {item.seller}
            </span>
          )}
        </div>
        <h1 className="mt-3 font-serif text-5xl tracking-tight text-foreground">
          {item.product_name}
        </h1>
        {item.description && (
          <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-foreground">
            {item.description}
          </p>
        )}

        {goal > 0 && (
          <div className="mt-8 rounded-sm border border-border bg-card p-6">
            <div className="h-1 w-full overflow-hidden rounded-sm bg-secondary">
              <div className="h-full bg-foreground/80" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-foreground">
                <strong>{money(pledged)}</strong>{" "}
                <span className="text-muted-foreground">contributed of {money(goal)}</span>
              </span>
              <span className="text-muted-foreground">
                {totals?.backers ?? 0} backer{(totals?.backers ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-[11px] tracking-[0.14em] uppercase text-muted-foreground md:grid-cols-3">
              <div>
                Sample cost
                <div className="mt-1 font-sans text-sm normal-case tracking-normal text-foreground">
                  {money(item.sample_cost_cents ?? 0)}
                </div>
              </div>
              <div>
                Test cost
                <div className="mt-1 font-sans text-sm normal-case tracking-normal text-foreground">
                  {money(item.test_cost_cents ?? 0)}
                </div>
              </div>
              <div>
                Operations
                <div className="mt-1 font-sans text-sm normal-case tracking-normal text-foreground">
                  {money(item.operations_margin_cents ?? 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {stretch.length > 0 && (
          <div className="mt-6 rounded-sm border border-border bg-card p-6">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
              Stretch goals
            </div>
            <ul className="mt-3 space-y-2 text-sm text-foreground">
              {stretch.map((s: any) => (
                <li key={s.id} className="flex justify-between">
                  <span>{s.label}</span>
                  <span className="text-muted-foreground">{money(s.threshold_cents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {fundable && (
          <div className="mt-6 rounded-sm border border-border bg-card p-6">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
              Back this test
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Contributions are charged immediately and always fund independent testing. If this
              batch doesn&apos;t reach its goal by the deadline, your contribution rolls over to the
              most-backed active campaign and you receive that campaign&apos;s results.
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Charged immediately. Final — funds independent testing either way.
            </p>

            {!clientSecret && (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[1000, 2500, 5000, 10000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className={`rounded-sm border px-4 py-2 text-sm ${
                        amount === v
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {money(v)}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3">
                    <span className="text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      min={5}
                      max={5000}
                      value={amount / 100}
                      onChange={(e) => setAmount(Math.round(Number(e.target.value) * 100))}
                      className="w-20 bg-transparent py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
                {checkoutError && (
                  <div className="mt-3 text-sm text-destructive">{checkoutError}</div>
                )}
                <button
                  onClick={() => {
                    if (!signedIn) {
                      navigate({
                        to: "/auth",
                        search: { next: `/fund/${itemId}` },
                      });
                      return;
                    }
                    pledge.mutate();
                  }}
                  disabled={pledge.isPending || amount < 500}
                  className="mt-5 rounded-sm bg-foreground px-6 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background disabled:opacity-40"
                >
                  {pledge.isPending ? "…" : signedIn ? `Contribute ${money(amount)}` : "Sign in to contribute"}
                </button>
              </>
            )}
            {clientSecret && (
              <div className="mt-6">
                <EmbeddedCheckoutProvider
                  stripe={getStripe()}
                  options={{ fetchClientSecret: async () => clientSecret }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-sm border border-border bg-card p-6">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
              Test result — {result.verdict}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-foreground">{result.summary}</p>
            <div className="mt-4 text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Signed off {result.signed_off_at ? new Date(result.signed_off_at).toLocaleDateString() : "—"}
              {result.lab_name ? ` · ${result.lab_name}` : ""}
              {result.batch_id ? ` · batch ${result.batch_id}` : ""}
            </div>
            <Link
              to="/registry/$itemId"
              params={{ itemId: item.id }}
              className="mt-4 inline-block text-sm underline"
            >
              View full report →
            </Link>
          </div>
        )}

        <div className="mt-10 rounded-sm border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
          This describes an independent test of a specific batch of a product. It is not a
          statement that the product is safe to inject or consume, or that it is effective or
          approved.
        </div>
      </main>
    </div>
  );
}
