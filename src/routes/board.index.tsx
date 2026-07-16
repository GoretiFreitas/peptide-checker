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
// Tier ladders per lab. Cumulative thresholds — a tier "unlocks" when
// pledged funds cross its threshold.
// -------------------------------------------------------------------
type Tier = { key: string; name: string; threshold_cents: number; free?: boolean };

const JANOSHIK_TIERS: Tier[] = [
  { key: "purity", name: "Purity + quantity", threshold_cents: 30000 },
  { key: "endotoxin", name: "+ Endotoxin (LAL)", threshold_cents: 48000 },
  { key: "heavy_metals", name: "+ Heavy metals (As, Cd, Pb, Hg)", threshold_cents: 55000 },
  { key: "sterility", name: "+ Sterility (TAMC + TYMC) — Full panel", threshold_cents: 82800 },
];

const FINNRICK_TIERS: Tier[] = [
  { key: "purity", name: "Purity + safety test", threshold_cents: 0, free: true },
  { key: "endotoxin", name: "+ Endotoxin analysis", threshold_cents: 11000 },
  { key: "heavy_metals", name: "+ Heavy metals analysis", threshold_cents: 18000 },
];

const PRESET_PLEDGES = [500, 1000, 2500, 5000] as const;
const DEFAULT_PLEDGE = 500;

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

function tiersFor(lab: string): Tier[] {
  return lab === "finnrick" ? FINNRICK_TIERS : JANOSHIK_TIERS;
}

function labBadge(lab: string, us_only: boolean) {
  if (lab === "finnrick") return { label: "Finnrick · US only", tone: "us" as const };
  return { label: "Janoshik · ships worldwide", tone: "intl" as const };
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
  const backersById = (board.data as any)?.backers ?? {};

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
            published for every backer.
          </p>
          <p className="mt-3 text-[13px] italic text-muted-foreground">
            Some batches fund in under 40 pledges.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/board/nominate"
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
                  <li>Purity — free (Finnrick‑funded)</li>
                  <li>Endotoxin — ~$110</li>
                  <li>Heavy metals — add‑on (~$70)</li>
                  <li className="text-muted-foreground">A handful of $5 backers can fully fund one Finnrick campaign.</li>
                </ul>
              </div>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Campaign goals equal the cumulative cost of the tier ladder plus sample procurement
              and operations. Any surplus rolls into the community fund and back into new tests.
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
                  totals={totalsById.get(item.id) ?? { pledged_cents: 0, backer_count: 0 }}
                  backers={backersById[item.id] ?? []}
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

type Backer = { amount_cents: number; created_at: string; initial: string };

function CampaignCard({
  item,
  totals,
  backers,
  onBack,
}: {
  item: any;
  totals: { pledged_cents: number; backer_count: number };
  backers: Backer[];
  onBack: () => void;
}) {
  const lab: string = item.lab ?? "janoshik";
  const usOnly: boolean = !!item.us_only;
  const tiers = tiersFor(lab);
  const badge = labBadge(lab, usOnly);

  const goal = item.goal_cents ?? tiers[tiers.length - 1].threshold_cents;
  const raised = totals.pledged_cents ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  const state = item.state as string;
  const stateBadge = stateStyle[state] ?? stateStyle.nominated;
  const canBack = state === "funding" || state === "nominated";
  const isPublished = state === "published";
  const isTesting = state === "testing" || state === "procuring" || state === "funded";

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[oklch(0.94_0.02_260)] to-[oklch(0.97_0.015_90)]">
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-6xl tracking-tight text-primary/25">
              {initials(item.product_name)}
            </span>
          </div>
        )}
        <div className="absolute left-4 top-4">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase ${stateBadge.className}`}>
            {stateBadge.label}
          </span>
        </div>
        <div className="absolute right-4 top-4">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase backdrop-blur-sm ${
              badge.tone === "us"
                ? "border-[color:var(--badge-warn-fg)]/30 bg-[color:var(--badge-warn-bg)]/80 text-[color:var(--badge-warn-fg)]"
                : "border-border bg-card/80 text-foreground"
            }`}
          >
            {badge.label}
          </span>
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
              {totals.backer_count ?? 0} backer{(totals.backer_count ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Backer strip */}
        {backers.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center -space-x-1.5">
              {backers.slice(0, 8).map((b, i) => (
                <span
                  key={i}
                  title={`${money(b.amount_cents)} · ${new Date(b.created_at).toLocaleDateString()}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-secondary text-[10px] font-medium text-foreground"
                >
                  {b.initial}
                </span>
              ))}
              {backers.length > 8 && (
                <span className="flex h-6 items-center justify-center rounded-full border border-card bg-secondary px-2 text-[10px] text-muted-foreground">
                  +{(totals.backer_count ?? backers.length) - 8}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tier ladder OR results */}
        {isPublished && item.findings ? (
          <ResultsPanel findings={item.findings} coa_url={item.coa_url} lab={lab} />
        ) : (
          <TierLadder tiers={tiers} raised={raised} state={state} />
        )}

        {/* Finnrick US-only note */}
        {usOnly && (
          <p className="mt-3 rounded-md border border-[color:var(--badge-warn-fg)]/20 bg-[color:var(--badge-warn-bg)]/50 px-3 py-2 text-[11px] leading-relaxed text-[color:var(--badge-warn-fg)]">
            Finnrick tests US‑resident samples only; the sealed vial must ship from within the US.
          </p>
        )}

        {/* Trust note */}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
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

function TierLadder({ tiers, raised, state }: { tiers: Tier[]; raised: number; state: string }) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
        Unlock ladder
      </div>
      <ul className="mt-2 space-y-1.5">
        {tiers.map((t) => {
          const unlocked =
            t.free ||
            raised >= t.threshold_cents ||
            state === "published" ||
            state === "testing" ||
            state === "procuring" ||
            state === "funded";
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
                  {t.free ? "$0 covered by lab" : money(t.threshold_cents)}
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

function ResultsPanel({
  findings,
  coa_url,
  lab,
}: {
  findings: any;
  coa_url?: string | null;
  lab: string;
}) {
  const rows: Array<[string, string]> = [
    ["Purity", findings.purity_pct ? `${findings.purity_pct}%` : "—"],
    ["Endotoxin", findings.endotoxin_eu_per_vial ?? "—"],
    ["Heavy metals", findings.heavy_metals_pass === undefined ? "—" : findings.heavy_metals_pass ? "Pass" : "Fail"],
    ["Sterility", findings.sterility_pass === undefined ? "—" : findings.sterility_pass ? "Pass" : "Fail"],
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
      {coa_url && (
        <a
          href={coa_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs underline"
        >
          {lab === "finnrick" ? "Vendor ranking entry →" : "Verifiable COA →"}
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
  const usOnly = !!item?.us_only;

  const [amount, setAmount] = useState<number>(DEFAULT_PLEDGE);
  const [customFocused, setCustomFocused] = useState(false);
  const [usAck, setUsAck] = useState(false);
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
          us_shipping_ack: usOnly ? usAck : undefined,
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

  const canSubmit = amount >= 500 && (!usOnly || usAck);

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
              <p className="mt-1 text-[11px] text-muted-foreground">
                $5 joins the pool — many small backers fund one test.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESET_PLEDGES.map((v) => {
                  const selected = amount === v && !customFocused;
                  const isDefault = v === DEFAULT_PLEDGE;
                  return (
                    <button
                      key={v}
                      onClick={() => {
                        setAmount(v);
                        setCustomFocused(false);
                      }}
                      className={`relative rounded-md border px-4 py-2 text-sm transition-colors ${
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : isDefault
                          ? "border-foreground/60 bg-card text-foreground hover:border-foreground"
                          : "border-border bg-card text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {money(v)}
                      {isDefault && !selected && (
                        <span className="ml-1 text-[9px] tracking-[0.14em] uppercase text-muted-foreground">
                          join pool
                        </span>
                      )}
                    </button>
                  );
                })}
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

            {usOnly && (
              <label className="mt-5 flex items-start gap-2 rounded-md border border-[color:var(--badge-warn-fg)]/20 bg-[color:var(--badge-warn-bg)]/40 px-3 py-2.5 text-[12px] leading-relaxed text-[color:var(--badge-warn-fg)]">
                <input
                  type="checkbox"
                  checked={usAck}
                  onChange={(e) => setUsAck(e.target.checked)}
                  className="mt-0.5 accent-current"
                />
                <span>
                  I understand this Finnrick campaign requires the sealed vial to ship from within
                  the US.
                </span>
              </label>
            )}

            {error && <div className="mt-4 text-sm text-destructive">{error}</div>}

            <button
              onClick={() => {
                if (!signedIn) {
                  navigate({ to: "/auth", search: { next: `/board` } });
                  return;
                }
                pledge.mutate();
              }}
              disabled={pledge.isPending || !canSubmit}
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
