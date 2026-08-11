import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getItem } from "@/lib/board.functions";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/fund/$itemId/share")({
  loader: async ({ params }) => {
    try {
      const res = await getItem({ data: { id: params.itemId } });
      return {
        itemId: params.itemId,
        item: (res.item as Record<string, any> | null) ?? null,
        totals: (res.totals as Record<string, any> | null) ?? null,
        backers: (res.backers as any[]) ?? [],
      };
    } catch {
      return { itemId: params.itemId, item: null, totals: null, backers: [] };
    }
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.item?.product_name;
    const title = name
      ? `Share ${name} — Peptide Testing Fund`
      : "Share a campaign — Peptide Testing Fund";
    const desc = name
      ? `Help fund independent lab testing of ${name}. Share this campaign on X, Reddit, or Instagram.`
      : "Share a PeptidesCheck community testing campaign.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `/fund/${params.itemId}/share` },
      ],
      links: [{ rel: "canonical", href: `/fund/${params.itemId}/share` }],
    };
  },
  component: SharePage,
  errorComponent: ({ error }) => (
    <div className="p-10 font-serif">Something went wrong: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-10">Campaign not found.</div>,
});

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function SharePage() {
  const { itemId, item, totals } = Route.useLoaderData();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [subreddit, setSubreddit] = useState("DecentralizedSciences");

  const goal = (item?.goal_cents as number) ?? 0;
  const pledged = (totals?.pledged_cents as number) ?? 0;
  const pct = goal > 0 ? Math.min(100, Math.round((pledged / goal) * 100)) : 0;
  const campaignUrl = typeof window !== "undefined" ? `${window.location.origin}/fund/${itemId}` : "";
  const batchId = (item?.batch_id as string) ?? "";
  const productName = (item?.product_name as string) ?? "this campaign";

  const xText = `I just backed independent lab testing of ${productName}${batchId ? `, batch ${batchId}` : ""} on PeptidesCheck.xyz. ${money(pledged)} of ${money(goal)} funded — one test, results shared with everyone: ${campaignUrl}`;

  const redditTitle = `Back independent lab testing of ${productName}${batchId ? ` (batch ${batchId})` : ""}`;
  const redditBody = `I contributed to fund an independent lab test on PeptidesCheck.xyz: ${campaignUrl}\n\nThis is research-grade testing — not a claim of safety, efficacy, or approval for human use. Results are shared with all backers if the goal is met.`;

  const instagramCaption = `I just backed independent lab testing of ${productName}${batchId ? `, batch ${batchId}` : ""} on PeptidesCheck.xyz.\n\n${money(pledged)} of ${money(goal)} funded — one test, results shared with everyone.\n\nResearch-use only. Not a statement of safety, efficacy, or approval.\n\n${campaignUrl}`;

  useEffect(() => {
    if (!canvasRef.current || !item) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = 1080 * dpr;
    canvas.height = 1350 * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#F9F8F4";
    ctx.fillRect(0, 0, 1080, 1350);

    ctx.fillStyle = "#1E1E1E";
    ctx.font = "600 48px Inter, sans-serif";
    ctx.fillText("PeptidesCheck", 80, 110);
    ctx.fillStyle = "#5A5A5A";
    ctx.font = "400 28px Inter, sans-serif";
    ctx.fillText("Independent community testing", 80, 155);

    ctx.fillStyle = "#1E1E1E";
    ctx.font = "600 64px Instrument Serif, Georgia, serif";
    const title = productName;
    const words = title.split(" ");
    let line = "";
    let y = 340;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > 920) {
        ctx.fillText(line, 80, y);
        line = word;
        y += 76;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, 80, y);

    if (batchId) {
      ctx.fillStyle = "#6B6B6B";
      ctx.font = "400 32px Inter, sans-serif";
      ctx.fillText(`Batch ${batchId}`, 80, y + 60);
    }

    ctx.fillStyle = "#E2E0D8";
    ctx.fillRect(80, 620, 920, 24);
    ctx.fillStyle = "#2E5A4F";
    ctx.fillRect(80, 620, 920 * (pct / 100), 24);

    ctx.fillStyle = "#1E1E1E";
    ctx.font = "600 52px Inter, sans-serif";
    ctx.fillText(`${money(pledged)} of ${money(goal)}`, 80, 740);
    ctx.fillStyle = "#5A5A5A";
    ctx.font = "400 30px Inter, sans-serif";
    ctx.fillText(`${pct}% funded · ${(totals?.backers as number) ?? 0} backer${((totals?.backers as number) ?? 0) === 1 ? "" : "s"}`, 80, 790);

    ctx.fillStyle = "#6B6B6B";
    ctx.font = "400 26px Inter, sans-serif";
    const disclaimer = "Research use only. Not a statement of safety, efficacy, or approval.";
    ctx.fillText(disclaimer, 80, 1230);
    ctx.fillText("peptidescheck.xyz/fund", 80, 1270);
  }, [item, goal, pledged, pct, totals, productName, batchId]);

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `peptidescheck-${itemId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!item) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-[900px] px-6 py-12">
          <div className="text-sm text-muted-foreground">Campaign not found.</div>
          <Link to="/fund" className="mt-4 inline-block text-sm underline">← Back to fund</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-6 py-10 md:px-10">
        <Link to="/fund/$itemId" params={{ itemId }} className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground">
          ← Campaign
        </Link>
        <h1 className="mt-6 font-serif text-4xl tracking-tight text-foreground">Share this campaign</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {productName}{batchId ? ` · batch ${batchId}` : ""}
        </p>

        <div className="mt-8 space-y-6">
          <section className="rounded-sm border border-border bg-card p-6">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">X / Twitter</div>
            <textarea
              readOnly
              value={xText}
              className="mt-3 min-h-[120px] w-full rounded-sm border border-border bg-background p-3 text-sm text-foreground focus:outline-none"
            />
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(xText)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-sm bg-foreground px-4 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-background"
            >
              Post on X
            </a>
          </section>

          <section className="rounded-sm border border-border bg-card p-6">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Reddit</div>
            <div className="mt-3 grid gap-3">
              <div>
                <label className="block text-[11px] tracking-[0.14em] uppercase text-muted-foreground">Subreddit</label>
                <div className="mt-1 flex items-center rounded-sm border border-border bg-background px-3">
                  <span className="text-sm text-muted-foreground">r/</span>
                  <input
                    type="text"
                    value={subreddit}
                    onChange={(e) => setSubreddit(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    className="ml-1 w-full bg-transparent py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <input
                readOnly
                value={redditTitle}
                className="w-full rounded-sm border border-border bg-background p-3 text-sm text-foreground focus:outline-none"
              />
              <textarea
                readOnly
                value={redditBody}
                className="min-h-[140px] w-full rounded-sm border border-border bg-background p-3 text-sm text-foreground focus:outline-none"
              />
            </div>
            <a
              href={`https://www.reddit.com/r/${subreddit}/submit?title=${encodeURIComponent(redditTitle)}&text=${encodeURIComponent(redditBody)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-sm bg-foreground px-4 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-background"
            >
              Post on Reddit
            </a>
          </section>

          <section className="rounded-sm border border-border bg-card p-6">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Instagram</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Download this card and share it in a story or post.
            </p>
            <div className="mt-4 flex justify-center bg-secondary p-4">
              <canvas
                ref={canvasRef}
                style={{ width: 324, height: 405, maxWidth: "100%" }}
                className="rounded-sm shadow-sm"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={downloadCard}
                className="rounded-sm bg-foreground px-4 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-background"
              >
                Download card
              </button>
              <button
                onClick={() => copy(instagramCaption)}
                className="rounded-sm border border-border px-4 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-foreground"
              >
                {copied ? "Copied!" : "Copy caption"}
              </button>
            </div>
          </section>

          <section className="rounded-sm border border-border bg-card p-6">
            <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Copy link</div>
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={campaignUrl}
                className="w-full rounded-sm border border-border bg-background p-3 text-sm text-foreground focus:outline-none"
              />
              <button
                onClick={() => copy(campaignUrl)}
                className="shrink-0 rounded-sm border border-border px-4 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-foreground"
              >
                Copy
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
