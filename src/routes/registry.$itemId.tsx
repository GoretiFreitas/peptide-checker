import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getItem } from "@/lib/board.functions";
import { getFullReport } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/registry/$itemId")({
  loader: async ({ params }) => {
    try {
      const res = await getItem({ data: { id: params.itemId } });
      return {
        productName: (res.item as { product_name?: string } | null)?.product_name ?? null,
        hasResult: !!res.result,
      };
    } catch {
      return { productName: null, hasResult: false };
    }
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.productName;
    const title = name ? `${name} — Independent Test Report` : "Test Report — Certificate Checker";
    const desc = name ? `Published independent test report for ${name}.` : "Published independent test report.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/registry/${params.itemId}` },
      ],
      links: [{ rel: "canonical", href: `/registry/${params.itemId}` }],
    };
  },
  component: RegistryPage,
  errorComponent: ({ error }) => (
    <div className="p-10 font-serif">Something went wrong: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-10">Report not found.</div>,
});

const verdictStyle: Record<string, string> = {
  consistent: "bg-[#E7F1EA] text-[#1E5637]",
  concerns: "bg-[#FBF0DC] text-[#7A4E12]",
  failed: "bg-[#F7E4E1] text-[#7C271E]",
  insufficient: "bg-[#EDEBE3] text-[#4A4842]",
};

function truncate(s: string, n: number) {
  if (!s || s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

function RegistryPage() {
  const navigate = useNavigate();
  const { itemId } = Route.useParams();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: s } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setUserId(session?.user?.id ?? null);
    });
    return () => s.subscription.unsubscribe();
  }, []);

  const { isRegistryMember, isAdmin } = useUserRoles(userId);
  const hasAccess = isRegistryMember || isAdmin;

  const publicQ = useQuery({
    queryKey: ["registry", itemId],
    queryFn: () => getItem({ data: { id: itemId } }),
  });

  const fullQ = useQuery({
    queryKey: ["registry-full", itemId, userId],
    queryFn: () => getFullReport({ data: { itemId } }),
    enabled: !!userId && hasAccess,
  });

  const item = publicQ.data?.item as { product_name?: string; seller?: string } | undefined;
  const publicResult = publicQ.data?.result as
    | {
        verdict: string;
        summary: string;
        lab_name?: string | null;
        batch_id?: string | null;
        signed_off_at?: string | null;
      }
    | undefined;
  const full = (fullQ.data && "report" in fullQ.data ? fullQ.data.report : null) as
    | { item: unknown; result: { raw_findings: unknown; summary: string; verdict: string } }
    | null;

  const downloadJson = () => {
    if (!full) return;
    const blob = new Blob([JSON.stringify(full, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${itemId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[820px] px-6 py-12 md:px-10">
        <Link to="/fund" className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground">
          ← Board
        </Link>
        {publicQ.isLoading && <div className="mt-6 text-sm text-muted-foreground">Loading…</div>}
        {item && (
          <>
            <div className="mt-6 text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
              Independent test report
            </div>
            <h1 className="mt-2 font-serif text-5xl tracking-tight text-foreground">{item.product_name}</h1>
            {item.seller && <div className="mt-2 text-sm text-muted-foreground">Sold as — {item.seller}</div>}

            {publicResult ? (
              <>
                <div className="mt-8 inline-block rounded-sm px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] uppercase">
                  <span className={`rounded-sm px-2 py-1 ${verdictStyle[publicResult.verdict] ?? "bg-secondary"}`}>
                    Verdict — {publicResult.verdict}
                  </span>
                </div>

                <div className="mt-6 rounded-sm border border-border bg-card p-6">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {hasAccess && full
                      ? full.result.summary
                      : truncate(publicResult.summary ?? "", 260)}
                  </p>
                  {!hasAccess && (publicResult.summary ?? "").length > 260 && (
                    <div className="mt-4 rounded-sm border border-dashed border-border bg-secondary/40 p-4 text-xs">
                      <p className="tracking-[0.14em] uppercase text-muted-foreground">Members only</p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground">
                        The full summary, raw findings table, and downloadable report are available to
                        Registry members.
                      </p>
                      {userId ? (
                        <Link
                          to="/support"
                          search={{}}
                          className="mt-3 inline-block rounded-sm border border-foreground px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase hover:bg-foreground hover:text-background"
                        >
                          Unlock registry access — $500
                        </Link>
                      ) : (
                        <button
                          onClick={() => navigate({ to: "/auth", search: { redirect: `/registry/${itemId}` } as any })}
                          className="mt-3 inline-block rounded-sm border border-foreground px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase hover:bg-foreground hover:text-background"
                        >
                          Sign in
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <dl className="mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                  <div>
                    <dt className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Lab</dt>
                    <dd className="mt-1 text-foreground">{publicResult.lab_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Batch</dt>
                    <dd className="mt-1 text-foreground">{publicResult.batch_id ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Signed off</dt>
                    <dd className="mt-1 text-foreground">
                      {publicResult.signed_off_at ? new Date(publicResult.signed_off_at).toLocaleDateString() : "—"}
                    </dd>
                  </div>
                </dl>

                {hasAccess && full && (
                  <div className="mt-8 rounded-sm border border-border bg-card p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-serif text-2xl">Raw findings</h2>
                      <button
                        onClick={downloadJson}
                        className="rounded-sm border border-foreground px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase hover:bg-foreground hover:text-background"
                      >
                        Download JSON
                      </button>
                    </div>
                    <pre className="mt-4 overflow-auto rounded-sm bg-secondary/40 p-4 text-xs leading-relaxed">
                      {JSON.stringify(full.result.raw_findings, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-8 rounded-sm border border-dashed border-border p-8 text-sm text-muted-foreground">
                No published result yet.
              </div>
            )}

            <div className="mt-10 rounded-sm border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
              This describes an independent test of a specific batch of a product. It is not a
              statement that the product is safe to inject or consume, or that it is effective or
              approved.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
