import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { getBoard, getFundTotal, getItem, createPledgeCheckout } from "@/lib/board.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";
import { supabase } from "@/integrations/supabase/client";

// -------------------------------------------------------------------
// Config — edit tier thresholds and default lab pricing here.
// Cumulative thresholds mirror Janoshik's à la carte pricing.
// -------------------------------------------------------------------
type Tier = { key: string; name: string; threshold_cents: number; hint: string };
const TIERS: Tier[] = [
  { key: "purity", name: "Purity + quantity", threshold_cents: 30000, hint: "HPLC assay" },
  { key: "endotoxin", name: "+ Endotoxin (LAL)", threshold_cents: 48000, hint: "Limulus amebocyte lysate" },
  { key: "heavy_metals", name: "+ Heavy metals (As, Cd, Pb, Hg)", threshold_cents: 55000, hint: "ICP-MS" },
  { key: "sterility", name: "+ Sterility (TAMC + TYMC) — Full panel", threshold_cents: 82800, hint: "Complete safety panel" },
];

const PRESET_PLEDGES = [1000, 2500, 5000, 10000] as const;

const DEFAULT_LAB = "Janoshik International";

// -------------------------------------------------------------------

export const Route = createFileRoute("/board/")({
  head: () => ({
    meta: [
      { title: "Crowdfunded Peptide Testing Board — Hyperlatitude" },
      {
        name: "description",
        content:
          "Pool funds, test the batch once, share the intel. Back independent lab tests of specific peptide batches — only charged if the goal is met.",
      },
      { property: "og:title", content: "Crowdfunded Peptide Testing Board" },
      {
        property: "og:description",
        content:
          "Pool funds, test the batch once, share the intel — so nobody has to gamble on an untested vial.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/board" },
    ],
    links: [{ rel: "canonical", href: "/board" }],
  }),
  component: BoardIndex,
});

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const stateStyle: Record<string, { label: string; className: string }> = {
  nominated: { label: "Nominated", className: "bg-[color:var(--badge-neutral-bg)] text-[color:var(--badge-neutral-fg)]" },
  funding: { label: "Funding", className: "bg-[color:var(--badge-warn-bg)] text-[color:var(--badge-warn-fg)]" },
  funded: { label: "Funded", className: "bg-[color:var(--badge-ok-bg)] text-[color:var(--badge-ok-fg)]" },
  procuring: { label: "Procuring sample", className: "bg-[color:var(--badge-warn-bg)] text-[color:var(--badge-warn-fg)]" },
  testing: { label: "Testing in progress", className: "bg-[color:var(--badge-warn-bg)] text-[color:var(--badge-warn-fg)]" },
  published: { label: "Results published", className: "bg-[color:var(--badge-ok-bg)] text-[color:var(--badge-ok-fg)]" },
  expired: { label: "Expired", className: "bg-[color:var(--badge-fail-bg)] text-[color:var(--badge-fail-fg)]" },
};

function BoardIndex() {
  const board = useQuery({ queryKey: ["board"], queryFn: () => getBoard() });
  const fund = useQuery({ queryKey: ["fund"], queryFn: () => getFundTotal() });

  const items = board.data?.items ?? [];
  const totalsById = useMemo(
    () => new Map((board.data?.totals ?? []).map((t: any) => [t.item_id, t])),
    [board.data?.totals],
  );

  const [pledgeFor, setPledgeFor] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-6 py-12 md:px-10">
        {/* Mission header */}
        <section className="max-w-[70ch]">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            Crowdfunded peptide testing
          </div>
          <h1 className="mt-3 font-serif text-5xl leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Pool funds. Test the batch once.
            <br />
            <span className="text-muted-foreground">Share the intel.</span>
          </h1>
          <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-foreground">
            Each campaign funds an independent lab test of one specific peptide batch. Back a
            campaign and — if it hits its goal — the batch is sent to a third‑party lab, results
            published for every backer. Nobody has to gamble on an untested vial.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/board/nominate"
              search={{}}
              className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background shadow-sm transition-colors hover:bg-foreground/90"
            >
              Nominate a batch
            </Link>
            <button
              type="button"
              onClick={() => setHowOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-foreground transition-colors hover:border-foreground/40"
            >
              How funding targets are set
              <span aria-hidden className={`transition-transform ${howOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>
            {fund.data !== undefined && fund.data > 0 && (
              <span className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                Community fund: <span className="text-foreground">{money(fund.data)}</span>
              </span>
            )}
          </div>
        </section>

        {/* Expandable pricing reference */}
        {howOpen && (
          <section className="mt-6 animate-fade-in rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                  Janoshik International · Prague · ships worldwide
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                  <li>Basic purity blind test — ~$300</li>
                  <li>Endotoxin (LAL) — $180</li>
                  <li>Heavy metals — ~$60–80</li>
                  <li>Sterility add-on (TAMC + TYMC)</li>
                  <li className="font-medium">Full panel — ~$828</li>
                  <li className="text-muted-foreground">Turnaround: 5–10 business days · expedite +100%</li>
                </ul>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                  Finnrick · US only
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                  <li>Purity — free</li>
                  <li>Endotoxin — ~$110</li>
                  <li>Heavy metals — add‑on</li>
                </ul>
              </div>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Campaign goals equal the cumulative cost of the full 4‑tier panel plus sample
              procurement and operations. Any surplus rolls into the community fund and back into
              new tests.
            </p>
          </section>
        )}

        {/* Grid */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl tracking-tight text-foreground">Active campaigns</h2>
            <span className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
              {items.length} batch{items.length === 1 ? "" : "es"}
            </span>
          </div>

          {board.isLoading ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-xl border border-border bg-card" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No active campaigns yet. Be the first to nominate a batch.
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item: any) => (
                <CampaignCard
                  key={item.id}
                  item={item}
                  totals={totalsById.get(item.id) ?? { pledged_cents: 0, backers: 0 }}
                  onBack={() => setPledgeFor(item.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Global trust footer */}
        <section className="mt-16 rounded-xl border border-border bg-card p-6 text-xs leading-relaxed text-muted-foreground">
          Results describe a specific batch tested by an independent lab. They are not a
          statement that the product is safe to inject, consume, effective, or approved. All
          samples analysed are for molecular biology grade research use only.
        </section>
      </main>

      {pledgeFor && (
        <PledgeModal itemId={pledgeFor} onClose={() => setPledgeFor(null)} />
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Campaign card
// -------------------------------------------------------------------

function CampaignCard({
  item,
  totals,
  onBack,
}: {
  item: any;
  totals: { pledged_cents: number; backers: number };
  onBack: () => void;
}) {
  const goal = item.goal_cents ?? TIERS[TIERS.length - 1].threshold_cents;
  const raised = totals.pledged_cents ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  const state = item.state as string;
  const badge = stateStyle[state] ?? stateStyle.nominated;
  const canBack = state === "funding" || state === "nominated";
  const isPublished = state === "published";
  const isTesting = state === "testing" || state === "procuring" || state === "funded";

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[oklch(0.94_0.02_260)] to-[oklch(0.97_0.015_90)]">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-serif text-6xl tracking-tight text-primary/25">
            {initials(item.product_name)}
          </span>
        </div>
        <div className="absolute left-4 top-4">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <div className="absolute right-4 top-4 text-right text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
          {item.lab_name || DEFAULT_LAB}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <Link
          to="/board/$itemId"
          params={{ itemId: item.id }}
          className="font-serif text-xl leading-tight tracking-tight text-foreground hover:underline"
        >
          {item.product_name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {item.seller && <span>{item.seller}</span>}
          {item.batch_id && <><span>·</span><span className="font-mono">Batch {item.batch_id}</span></>}
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between text-sm">
            <span className="text-foreground">
              <strong>{money(raised)}</strong>
              <span className="text-muted-foreground"> / {money(goal)}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {totals.backers ?? 0} backer{(totals.backers ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Tier ladder OR results */}
        {isPublished && item.results ? (
          <ResultsPanel results={item.results} />
        ) : (
          <TierLadder raised={raised} state={state} />
        )}

        {/* Trust note */}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          The batch is sent as sealed, unopened vials to prevent contamination before analysis.
        </p>

        {/* Action */}
        <div className="mt-5 flex items-center gap-3">
          {canBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-md bg-foreground px-4 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-background transition-colors hover:bg-foreground/90"
            >
              Back this test
            </button>
          ) : isTesting ? (
            <Link
              to="/board/$itemId"
              params={{ itemId: item.id }}
              className="flex-1 rounded-md border border-border bg-card px-4 py-2.5 text-center text-[11px] font-medium tracking-[0.22em] uppercase text-foreground transition-colors hover:border-foreground/40"
            >
              Follow progress
            </Link>
          ) : isPublished ? (
            <Link
              to="/board/$itemId"
              params={{ itemId: item.id }}
              className="flex-1 rounded-md bg-primary px-4 py-2.5 text-center text-[11px] font-medium tracking-[0.22em] uppercase text-primary-foreground transition-colors hover:bg-primary/90"
            >
              View report
            </Link>
          ) : (
            <span className="flex-1 rounded-md border border-dashed border-border px-4 py-2.5 text-center text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
              Not accepting pledges
            </span>
          )}
        </div>
        {canBack && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            You're charged only if the campaign reaches its goal. Funds cover independent lab
            testing; results are shared with all backers.
          </p>
        )}
      </div>
    </article>
  );
}

// -------------------------------------------------------------------
// Tier ladder
// -------------------------------------------------------------------

function TierLadder({ raised, state }: { raised: number; state: string }) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
        Unlock ladder
      </div>
      <ul className="mt-2 space-y-1.5">
        {TIERS.map((t) => {
          const unlocked = raised >= t.threshold_cents || state === "published" || state === "testing";
          return (
            <li key={t.key} className="flex items-center gap-2.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition-all duration-500 ${
                  unlocked
                    ? "bg-[color:var(--badge-ok-bg)] text-[color:var(--badge-ok-fg)] scale-100"
                    : "bg-secondary text-muted-foreground scale-95"
                }`}
                aria-hidden
              >
                {unlocked ? "✓" : "🔒"}
              </span>
              <div className="flex flex-1 items-center justify-between text-xs">
                <span className={unlocked ? "text-foreground" : "text-muted-foreground"}>
                  {t.name}
                </span>
                <span className={`font-mono tabular-nums ${unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                  {money(t.threshold_cents)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// -------------------------------------------------------------------
// Results panel (when published)
// -------------------------------------------------------------------

function ResultsPanel({ results }: { results: any }) {
  const rows: Array<[string, string]> = [
    ["Purity", results.purity_pct ? `${results.purity_pct}%` : "—"],
    ["Endotoxin", results.endotoxin_eu_per_vial ?? "—"],
    ["Heavy metals", results.heavy_metals_pass ? "Pass" : "Fail"],
    ["Sterility", results.sterility_pass ? "Pass" : "Fail"],
  ];
  return (
    <div className="mt-5 rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Findings</div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      {results.coa_url && (
        <a
          href={results.coa_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs underline"
        >
          Verifiable COA →
        </a>
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Pledge modal (embedded Stripe Checkout)
// -------------------------------------------------------------------

function PledgeModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const detail = useQuery({
    queryKey: ["board", itemId],
    queryFn: () => getItem({ data: { id: itemId } }),
  });
  const item = detail.data?.item as any;

  const [amount, setAmount] = useState(2500);
  const [customFocused, setCustomFocused] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pledge = useMutation({
    mutationFn: async () => {
      const res = await createPledgeCheckout({
        data: {
          item_id: itemId,
          amount_cents: amount,
          return_url: `${window.location.origin}/board/${itemId}?pledged=1`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in res) throw new Error(res.error);
      return res.clientSecret;
    },
    onSuccess: (secret) => {
      setClientSecret(secret);
      setError(null);
    },
    onError: (e: any) => setError(e.message ?? "Could not start pledge"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="mt-10 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
              Back this test
            </div>
            <h3 className="mt-1 font-serif text-2xl leading-tight tracking-tight text-foreground">
              {item?.product_name ?? "Loading…"}
            </h3>
            {(item?.seller || item?.batch_id) && (
              <div className="mt-1 text-xs text-muted-foreground">
                {item?.seller}
                {item?.seller && item?.batch_id ? " · " : ""}
                {item?.batch_id && <span className="font-mono">Batch {item.batch_id}</span>}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!clientSecret ? (
          <>
            <div className="mt-6">
              <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                Pledge amount
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESET_PLEDGES.map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setAmount(v);
                      setCustomFocused(false);
                    }}
                    className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                      amount === v && !customFocused
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:border-foreground/40"
                    }`}
                  >
                    {money(v)}
                  </button>
                ))}
                <div
                  className={`flex items-center gap-1 rounded-md border bg-card px-3 transition-colors ${
                    customFocused ? "border-foreground" : "border-border"
                  }`}
                >
                  <span className="text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={5}
                    max={5000}
                    value={amount / 100}
                    onFocus={() => setCustomFocused(true)}
                    onChange={(e) => setAmount(Math.round(Number(e.target.value) * 100))}
                    className="w-20 bg-transparent py-2 text-sm focus:outline-none"
                    aria-label="Custom pledge amount"
                  />
                </div>
              </div>
            </div>

            {error && <div className="mt-4 text-sm text-destructive">{error}</div>}

            <button
              onClick={() => {
                if (!signedIn) {
                  navigate({ to: "/auth", search: { next: `/board` } });
                  return;
                }
                pledge.mutate();
              }}
              disabled={pledge.isPending || amount < 500}
              className="mt-6 w-full rounded-md bg-foreground px-6 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
            >
              {pledge.isPending
                ? "…"
                : signedIn
                ? `Authorize ${money(amount)} pledge`
                : "Sign in to pledge"}
            </button>

            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              You're charged only if the campaign reaches its goal. Funds cover independent lab
              testing; results are shared with all backers. If the goal isn't met by the
              deadline, the authorization is released and no one is charged.
            </p>
          </>
        ) : (
          <div className="mt-4">
            <EmbeddedCheckoutProvider
              stripe={getStripe()}
              options={{ fetchClientSecret: async () => clientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  );
}
