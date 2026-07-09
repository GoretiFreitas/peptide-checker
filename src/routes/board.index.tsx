import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBoard, getFundTotal } from "@/lib/board.functions";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/board/")({
  head: () => ({
    meta: [
      { title: "Testing Board — Certificate Checker" },
      {
        name: "description",
        content:
          "Community-funded independent tests of peptide products. Pledge to back a test; you're only charged if the goal is met.",
      },
      { property: "og:title", content: "Testing Board — Certificate Checker" },
      {
        property: "og:description",
        content: "Community-funded independent tests of peptide products.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/board" },
    ],
    links: [{ rel: "canonical", href: "/board" }],
  }),
  component: BoardIndex,
});

const stateStyle: Record<string, string> = {
  nominated: "bg-[#EDEBE3] text-[#4A4842]",
  funding: "bg-[#FBF0DC] text-[#7A4E12]",
  funded: "bg-[#E4F1EE] text-[#0F5A4F]",
  procuring: "bg-[#FBF0DC] text-[#7A4E12]",
  testing: "bg-[#FBF0DC] text-[#7A4E12]",
  published: "bg-[#E7F1EA] text-[#1E5637]",
  expired: "bg-[#F7E4E1] text-[#7C271E]",
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function BoardIndex() {
  const board = useQuery({ queryKey: ["board"], queryFn: () => getBoard() });
  const fund = useQuery({ queryKey: ["fund"], queryFn: () => getFundTotal() });

  const items = board.data?.items ?? [];
  const totalsById = new Map((board.data?.totals ?? []).map((t: any) => [t.item_id, t]));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-6 py-12 md:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
              Test this next
            </div>
            <h1 className="mt-2 font-serif text-5xl tracking-tight text-foreground">
              Community testing board.
            </h1>
            <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
              Buyers pool money to fund independent tests of specific peptide products. Pledges
              are authorized upfront and only captured if the funding goal is reached before the
              deadline. If it isn't, no one is charged.
            </p>
          </div>
          <Link
            to="/board/nominate"
            search={{}}
            className="inline-flex items-center justify-center rounded-sm bg-foreground px-5 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background hover:bg-foreground/90"
          >
            Nominate a product
          </Link>
        </div>

        {fund.data !== undefined && fund.data > 0 && (
          <div className="mt-8 rounded-sm border border-border bg-card px-5 py-4 text-sm text-foreground">
            <span className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
              Community fund
            </span>{" "}
            · {money(fund.data)} available to help kick off high-priority tests.
          </div>
        )}

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {board.isLoading && (
            <div className="text-sm text-muted-foreground">Loading board…</div>
          )}
          {items.map((item: any) => {
            const totals: any = totalsById.get(item.id) ?? { pledged_cents: 0, backers: 0 };
            const goal = item.goal_cents ?? 0;
            const pct = goal > 0 ? Math.min(100, Math.round((totals.pledged_cents / goal) * 100)) : 0;
            return (
              <Link
                key={item.id}
                to="/board/$itemId"
                params={{ itemId: item.id }}
                className="block rounded-sm border border-border bg-card p-5 transition-colors hover:border-foreground/30"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-sm px-2 py-1 text-[10px] font-medium tracking-[0.18em] uppercase ${stateStyle[item.state] ?? "bg-secondary text-foreground"}`}
                  >
                    {item.state}
                  </span>
                  {item.seller && (
                    <span className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
                      {item.seller}
                    </span>
                  )}
                </div>
                <h2 className="mt-4 font-serif text-2xl leading-tight tracking-tight text-foreground">
                  {item.product_name}
                </h2>
                {item.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
                {goal > 0 && (
                  <>
                    <div className="mt-5 h-1 w-full overflow-hidden rounded-sm bg-secondary">
                      <div
                        className="h-full bg-foreground/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] tracking-[0.12em] uppercase text-muted-foreground">
                      <span>
                        {money(totals.pledged_cents)} / {money(goal)}
                      </span>
                      <span>
                        {totals.backers ?? 0} backer{(totals.backers ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>
                  </>
                )}
              </Link>
            );
          })}
          {!board.isLoading && items.length === 0 && (
            <div className="rounded-sm border border-dashed border-border p-8 text-sm text-muted-foreground">
              No items yet. Nominate the first product.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
