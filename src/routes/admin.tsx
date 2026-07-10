import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBoard,
  isAdmin,
  adminSetItem,
  adminSettlePledges,
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

  const settle = useMutation({
    mutationFn: (d: { item_id: string; action: "capture" | "cancel" }) =>
      adminSettlePledges({
        data: { ...d, environment: getStripeEnvironment() },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board"] }),
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
          <Link to="/board" className="mt-6 inline-block text-sm underline">
            ← Back to board
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
          Testing board — admin.
        </h1>

        <TaxCodesButton />


        <div className="mt-8 space-y-6">
          {items.map((item: any) => (
            <AdminRow
              key={item.id}
              item={item}
              totals={totalsById.get(item.id) as any}
              onSave={(patch) => setItem.mutate({ id: item.id, ...patch })}
              onSettle={(action) => settle.mutate({ item_id: item.id, action })}
              onPublish={(payload) => publish.mutate({ item_id: item.id, ...payload })}
              busy={setItem.isPending || settle.isPending || publish.isPending}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function AdminRow({
  item,
  totals,
  onSave,
  onSettle,
  onPublish,
  busy,
}: {
  item: any;
  totals: any;
  onSave: (patch: any) => void;
  onSettle: (action: "capture" | "cancel") => void;
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
          to="/board/$itemId"
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
          onClick={() => onSettle("capture")}
          className="rounded-sm border border-border px-4 py-2 text-[10px] font-medium tracking-[0.22em] uppercase text-foreground disabled:opacity-40"
        >
          Capture pledges
        </button>
        <button
          disabled={busy}
          onClick={() => onSettle("cancel")}
          className="rounded-sm border border-border px-4 py-2 text-[10px] font-medium tracking-[0.22em] uppercase text-foreground disabled:opacity-40"
        >
          Cancel pledges
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
