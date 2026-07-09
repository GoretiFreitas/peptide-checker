import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getItem } from "@/lib/board.functions";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/registry/$itemId")({
  head: () => ({
    meta: [
      { title: "Registry — Cooperative" },
      {
        name: "description",
        content: "Published independent test report.",
      },
    ],
  }),
  component: RegistryPage,
});

const verdictStyle: Record<string, string> = {
  consistent: "bg-[#E7F1EA] text-[#1E5637]",
  concerns: "bg-[#FBF0DC] text-[#7A4E12]",
  failed: "bg-[#F7E4E1] text-[#7C271E]",
  insufficient: "bg-[#EDEBE3] text-[#4A4842]",
};

function RegistryPage() {
  const { itemId } = Route.useParams();
  const query = useQuery({
    queryKey: ["registry", itemId],
    queryFn: () => getItem({ data: { id: itemId } }),
  });

  const item = query.data?.item;
  const result = query.data?.result as any;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[820px] px-6 py-12 md:px-10">
        <Link
          to="/board"
          className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground"
        >
          ← Board
        </Link>
        {query.isLoading && <div className="mt-6 text-sm text-muted-foreground">Loading…</div>}
        {item && (
          <>
            <div className="mt-6 text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
              Independent test report
            </div>
            <h1 className="mt-2 font-serif text-5xl tracking-tight text-foreground">
              {item.product_name}
            </h1>
            {item.seller && (
              <div className="mt-2 text-sm text-muted-foreground">Sold as — {item.seller}</div>
            )}

            {result ? (
              <>
                <div className="mt-8 inline-block rounded-sm px-3 py-1.5 text-[11px] font-medium tracking-[0.18em] uppercase">
                  <span className={`rounded-sm px-2 py-1 ${verdictStyle[result.verdict] ?? "bg-secondary"}`}>
                    Verdict — {result.verdict}
                  </span>
                </div>
                <div className="mt-6 rounded-sm border border-border bg-card p-6">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {result.summary}
                  </p>
                </div>
                <dl className="mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                  <div>
                    <dt className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                      Lab
                    </dt>
                    <dd className="mt-1 text-foreground">{result.lab_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                      Batch
                    </dt>
                    <dd className="mt-1 text-foreground">{result.batch_id ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                      Signed off
                    </dt>
                    <dd className="mt-1 text-foreground">
                      {result.signed_off_at
                        ? new Date(result.signed_off_at).toLocaleDateString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
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
