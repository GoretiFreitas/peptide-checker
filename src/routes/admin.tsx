import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBoard,
  isAdmin,
  adminSetItem,
  adminCloseCampaign,
  adminFundMetrics,
  adminPublishResult,
} from "@/lib/board.functions";
import { applyStripeTaxCodes } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { getStripeEnvironment } from "@/lib/stripe-client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Certificate Checker" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "/admin" }],
  }),
  component: AdminPage,
});

const STATES = [
  "nominated",
  "funding",
  "funded",
  "procuring",
  "testing",
  "published",
  "expired",
] as const;

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState<"loading" | "ok" | "forbidden">("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth", search: { next: "/admin" }, replace: true });
        return;
      }
      const r = await isAdmin();
      setReady(r.admin ? "ok" : "forbidden");
    })();
  }, [navigate]);

  const board = useQuery({
    queryKey: ["board"],
    queryFn: () => getBoard(),
    enabled: ready === "ok",
  });

  const setItem = useMutation({
    mutationFn: (d: any) => adminSetItem({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board"] }),
  });

  const metrics = useQuery({
    queryKey: ["fund-metrics"],
    queryFn: () => adminFundMetrics(),
    enabled: ready === "ok",
  });

  const close = useMutation({
    mutationFn: (item_id: string) => adminCloseCampaign({ data: { item_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board"] });
      qc.invalidateQueries({ queryKey: ["fund-metrics"] });
    },
  });

  const publish = useMutation({
    mutationFn: (d: any) => adminPublishResult({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board"] }),
  });

  if (ready === "loading") return null;
  if (ready === "forbidden") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-[720px] px-6 py-16">
          <h1 className="font-serif text-4xl">Not authorized.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This area is restricted to cooperative administrators.
          </p>
          <Link to="/fund" className="mt-6 inline-block text-sm underline">
            ← Back to fund
          </Link>
        </main>
      </div>
    );
  }

  const items = board.data?.items ?? [];
  const totalsById = new Map((board.data?.totals ?? []).map((t: any) => [t.item_id, t]));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-6 py-10 md:px-10">
        <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
          Cooperative admin
        </div>
        <h1 className="mt-2 font-serif text-4xl tracking-tight text-foreground">
          Testing fund — admin.
        </h1>

        <TaxCodesButton />

        <MetricsPanel data={metrics.data} loading={metrics.isLoading} />


        <div className="mt-8 space-y-6">
          {items.map((item: any) => (
            <AdminRow
              key={item.id}
              item={item}
              totals={totalsById.get(item.id) as any}
              onSave={(patch) => setItem.mutate({ id: item.id, ...patch })}
              onClose={() => close.mutate(item.id)}
              onPublish={(payload) => publish.mutate({ item_id: item.id, ...payload })}
              busy={setItem.isPending || close.isPending || publish.isPending}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function usd(cents: number) {
  return `$${(Number(cents ?? 0) / 100).toFixed(2)}`;
}

function MetricsPanel({ data, loading }: { data: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-6 h-40 animate-pulse rounded-sm border border-border bg-card" />
    );
  }
  if (!data) return null;
  const tx: any[] = data.transactions ?? [];

  const methodLabel = (v: unknown) => {
    const t = String(v ?? "").toLowerCase();
    if (!t) return "—";
    if (t === "card") return "card";
    if (t.includes("crypto") || t.includes("stablecoin")) return "crypto (USDC)";
    return t.replace(/_/g, " ");
  };

  const exportCsv = () => {
    const header = [
      "created_at",
      "backer_email",
      "campaign",
      "amount_usd",
      "refunded_usd",
      "status",
      "payment_method_type",
      "stripe_payment_intent_id",
      "rolled_over",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = tx.map((r) =>
      [
        r.created_at,
        r.backer_email,
        r.campaign,
        (r.amount_cents / 100).toFixed(2),
        (r.refunded_cents / 100).toFixed(2),
        r.status,
        r.payment_method_type || "",
        r.stripe_payment_intent_id,
        r.rolled_over ? "yes" : "no",
      ]
        .map(esc)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contributions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-8 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Gross revenue", value: usd(data.gross_cents) },
          { label: "Net of refunds", value: usd(data.net_cents) },
          { label: "Unique paying backers", value: String(data.unique_backers) },
          { label: "Contributions", value: String(data.contributions) },
        ].map((c) => (
          <div key={c.label} className="rounded-sm border border-border bg-card p-4">
            <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
              {c.label}
            </div>
            <div className="mt-1 font-serif text-2xl text-foreground">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-4">
          <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            Per campaign
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
                <th className="py-1">Campaign</th>
                <th className="py-1 text-right">Gross</th>
                <th className="py-1 text-right">Contribs</th>
                <th className="py-1 text-right">Backers</th>
              </tr>
            </thead>
            <tbody>
              {(data.campaigns ?? []).map((c: any) => (
                <tr key={c.item_id} className="border-t border-border/60">
                  <td className="py-1.5 pr-2">{c.product_name}</td>
                  <td className="py-1.5 text-right">{usd(c.gross_cents)}</td>
                  <td className="py-1.5 text-right">{c.contributions}</td>
                  <td className="py-1.5 text-right">{c.unique_backers}</td>
                </tr>
              ))}
              {(data.campaigns ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-xs text-muted-foreground">
                    No paid contributions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-sm border border-border bg-card p-4">
          <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            Daily revenue (last 30 days with activity)
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {(data.daily ?? []).map((d: any) => (
                <tr key={d.day} className="border-t border-border/60">
                  <td className="py-1.5 font-mono text-xs">{d.day}</td>
                  <td className="py-1.5 text-right">{usd(d.cents)}</td>
                </tr>
              ))}
              {(data.daily ?? []).length === 0 && (
                <tr>
                  <td className="py-3 text-xs text-muted-foreground">No revenue yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-sm border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            Transactions — audit trail ({tx.length})
          </div>
          <button
            onClick={exportCsv}
            className="rounded-sm border border-foreground px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase hover:bg-foreground hover:text-background"
          >
            Export CSV
          </button>
        </div>
        <div className="mt-3 max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
                <th className="py-1">When</th>
                <th className="py-1">Backer</th>
                <th className="py-1">Campaign</th>
                <th className="py-1 text-right">Amount</th>
                <th className="py-1">Status</th>
                <th className="py-1">Method</th>
                <th className="py-1">Payment intent</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="py-1.5 pr-2 font-mono text-xs">
                    {String(r.created_at).slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="py-1.5 pr-2">{r.backer_email}</td>
                  <td className="py-1.5 pr-2">
                    {r.campaign}
                    {r.rolled_over && (
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                        (rolled over)
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right">{usd(r.amount_cents)}</td>
                  <td className="py-1.5">{r.status}</td>
                  <td className="py-1.5">{methodLabel(r.payment_method_type)}</td>
                  <td className="py-1.5 font-mono text-xs">{r.stripe_payment_intent_id}</td>
                </tr>
              ))}
              {tx.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-3 text-xs text-muted-foreground">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function TaxCodesButton() {

  const [state, setState] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setState(null);
    try {
      const res = await applyStripeTaxCodes({ data: { environment: getStripeEnvironment() } });
      if ("error" in res) setState({ msg: res.error, ok: false });
      else setState({ msg: `Updated ${res.updated.length} product(s).`, ok: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-6 rounded-sm border border-dashed border-border p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={busy}
          className="rounded-sm border border-foreground px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase hover:bg-foreground hover:text-background disabled:opacity-50"
        >
          {busy ? "Applying…" : "Apply Stripe tax codes"}
        </button>
        <span className="text-xs text-muted-foreground">
          Idempotent — assigns SaaS / digital-goods tax codes to all catalog products.
        </span>
      </div>
      {state && (
        <p className={`mt-2 text-xs ${state.ok ? "text-[#1E5637]" : "text-red-700"}`}>{state.msg}</p>
      )}
    </div>
  );
}

function AdminRow({
  item,
  totals,
  onSave,
  onClose,
  onPublish,
  busy,
}: {
  item: any;
  totals: any;
  onSave: (patch: any) => void;
  onClose: () => void;
  onPublish: (payload: any) => void;
  busy: boolean;
}) {
  const [state, setState] = useState(item.state);
  const [sample, setSample] = useState(item.sample_cost_cents ?? 0);
  const [test, setTest] = useState(item.test_cost_cents ?? 0);
  const [ops, setOps] = useState(item.operations_margin_cents ?? 0);
  const [deadline, setDeadline] = useState(item.funding_deadline ?? "");
  const [description, setDescription] = useState(item.description ?? "");

  const [publishOpen, setPublishOpen] = useState(false);
  const [verdict, setVerdict] = useState<
    "consistent" | "concerns" | "failed" | "insufficient"
  >("consistent");
  const [labName, setLabName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [summary, setSummary] = useState("");

  return (
    <div className="rounded-sm border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-serif text-2xl text-foreground">{item.product_name}</h2>
          <div className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
            {item.seller || "—"} · {(totals?.pledged_cents ?? 0) / 100 | 0} pledged /{" "}
            {(item.goal_cents ?? 0) / 100 | 0} · {totals?.backers ?? 0} backers
          </div>
        </div>
        <Link
          to="/fund/$itemId"
          params={{ itemId: item.id }}
          className="text-[11px] tracking-[0.14em] uppercase underline"
        >
          View public →
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-6">
        <label className="col-span-2 text-xs">
          <span className="tracking-[0.14em] uppercase text-muted-foreground">State</span>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="tracking-[0.14em] uppercase text-muted-foreground">Sample $</span>
          <input
            type="number"
            value={sample / 100}
            onChange={(e) => setSample(Math.round(Number(e.target.value) * 100))}
            className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="tracking-[0.14em] uppercase text-muted-foreground">Test $</span>
          <input
            type="number"
            value={test / 100}
            onChange={(e) => setTest(Math.round(Number(e.target.value) * 100))}
            className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="tracking-[0.14em] uppercase text-muted-foreground">Ops $</span>
          <input
            type="number"
            value={ops / 100}
            onChange={(e) => setOps(Math.round(Number(e.target.value) * 100))}
            className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="tracking-[0.14em] uppercase text-muted-foreground">Deadline</span>
          <input
            type="date"
            value={deadline ? deadline.slice(0, 10) : ""}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs">
        <span className="tracking-[0.14em] uppercase text-muted-foreground">Description</span>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() =>
            onSave({
              state,
              sample_cost_cents: sample,
              test_cost_cents: test,
              operations_margin_cents: ops,
              funding_deadline: deadline || null,
              description,
            })
          }
          className="rounded-sm bg-foreground px-4 py-2 text-[10px] font-medium tracking-[0.22em] uppercase text-background disabled:opacity-40"
        >
          Save
        </button>
        <button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                "Close this campaign? If the goal is met it is marked funded; otherwise every contribution rolls over to the most-backed active campaign. No refunds are issued.",
              )
            )
              onClose();
          }}
          className="rounded-sm border border-border px-4 py-2 text-[10px] font-medium tracking-[0.22em] uppercase text-foreground disabled:opacity-40"
        >
          Close campaign
        </button>
        <button
          onClick={() => setPublishOpen((v) => !v)}
          className="rounded-sm border border-border px-4 py-2 text-[10px] font-medium tracking-[0.22em] uppercase text-foreground"
        >
          {publishOpen ? "Close publish" : "Publish result"}
        </button>
      </div>

      {publishOpen && (
        <div className="mt-4 space-y-2 rounded-sm border border-dashed border-border p-4">
          <div className="grid gap-2 md:grid-cols-3">
            <label className="text-xs">
              <span className="tracking-[0.14em] uppercase text-muted-foreground">Verdict</span>
              <select
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as any)}
                className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="consistent">consistent</option>
                <option value="concerns">concerns</option>
                <option value="failed">failed</option>
                <option value="insufficient">insufficient</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="tracking-[0.14em] uppercase text-muted-foreground">Lab</span>
              <input
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs">
              <span className="tracking-[0.14em] uppercase text-muted-foreground">Batch</span>
              <input
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="block text-xs">
            <span className="tracking-[0.14em] uppercase text-muted-foreground">Summary</span>
            <textarea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <button
            disabled={busy || summary.trim().length < 10}
            onClick={() =>
              onPublish({
                verdict,
                lab_name: labName || undefined,
                batch_id: batchId || undefined,
                summary,
              })
            }
            className="rounded-sm bg-foreground px-4 py-2 text-[10px] font-medium tracking-[0.22em] uppercase text-background disabled:opacity-40"
          >
            Publish
          </button>
        </div>
      )}
    </div>
  );
}
