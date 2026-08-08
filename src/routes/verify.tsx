import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { lookupRegister } from "@/lib/register.functions";
import { SiteHeader } from "@/components/SiteHeader";


export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a batch — PeptidesCheck" },
      {
        name: "description",
        content:
          "Look up a batch number or SHA-256 hash in the append-only Authenticity Register to see if a matching certificate has been submitted before.",
      },
      { property: "og:title", content: "Verify a batch — PeptidesCheck" },
      {
        property: "og:description",
        content:
          "Look up a batch or SHA-256 hash in the PeptidesCheck Authenticity Register.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://peptidescheck.xyz/verify" },
    ],
    links: [{ rel: "canonical", href: "https://peptidescheck.xyz/verify" }],
  }),
  validateSearch: (s: Record<string, unknown>): { hash?: string; batch?: string } => ({
    hash: typeof s.hash === "string" ? s.hash : undefined,
    batch: typeof s.batch === "string" ? s.batch : undefined,
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { hash, batch } = Route.useSearch();
  const initial = hash ?? batch ?? "";
  const [q, setQ] = useState(initial);

  const mutation = useMutation({
    mutationFn: (query: string) => lookupRegister({ data: { query } }),
  });

  useEffect(() => {
    if (initial.trim().length > 0) mutation.mutate(initial.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-6 py-12 md:px-10 md:py-16">
        <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
          Authenticity Register
        </div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight text-foreground md:text-5xl">
          Verify a batch.
        </h1>
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-foreground md:text-base">
          Paste a batch number or a Secure Hash Algorithm 256-bit (SHA-256) hash. The register is
          append-only, so entries can never be edited or deleted.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) mutation.mutate(q.trim());
          }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Batch number or SHA-256 hash"
            className="flex-1 rounded-sm border border-border bg-card px-3 py-3 font-mono text-sm text-foreground focus:border-foreground/40 focus:outline-none"
          />
          <button
            disabled={mutation.isPending || q.trim().length === 0}
            className="rounded-sm bg-foreground px-6 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background disabled:opacity-40"
          >
            {mutation.isPending ? "Looking up…" : "Look up"}
          </button>
        </form>

        <div className="mt-10">
          {mutation.isError && (
            <div className="text-sm text-destructive">
              {(mutation.error as Error).message}
            </div>
          )}
          {mutation.data && <VerifyResult data={mutation.data} />}
        </div>

        <div className="mt-16 rounded-md border border-border bg-card/40 p-6">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            How to read results
          </div>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            <li><strong>Registered and unaltered.</strong> The exact certificate content matches an existing register entry.</li>
            <li><strong>Seen before under a different batch.</strong> The batch identifier appears more than once with different contents. Treat with caution.</li>
            <li><strong>Not in the register.</strong> No matching submission. This does not mean the certificate is fake, only that no one has run it through PeptidesCheck yet.</li>
          </ul>
        </div>

        <div className="mt-8">
          <Link
            to="/"
            className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground"
          >
            ← Back to the checker
          </Link>
        </div>
      </main>
    </div>
  );
}

function VerifyResult({ data }: { data: Awaited<ReturnType<typeof lookupRegister>> }) {
  if (data.result === "not_found") {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <div className="text-sm font-medium text-foreground">Not in the register.</div>
        <p className="mt-2 text-sm text-muted-foreground">
          No matching submission was found. Run the certificate through the checker to add it.
        </p>
      </div>
    );
  }

  if (data.result === "conflict") {
    return (
      <div className="rounded-md border border-[--badge-fail-fg]/40 bg-[--badge-fail-fg]/5 p-6">
        <div className="text-sm font-medium text-foreground">
          Seen before under a different batch, or the same batch with different contents.
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.matches.length} distinct entries share this identifier. This is a red flag.
        </p>
        <ul className="mt-4 space-y-3">
          {data.matches.map((m: any) => (
            <EntryRow key={m.id} m={m} />
          ))}
        </ul>
      </div>
    );
  }

  const m: any = data.entry;
  return (
    <div className="rounded-md border border-border bg-card p-6">
      <div className="text-sm font-medium text-foreground">Registered and unaltered.</div>
      <p className="mt-2 text-sm text-muted-foreground">
        This exact certificate content is on file. It has been seen {m.seen_count} time
        {m.seen_count === 1 ? "" : "s"}.
      </p>
      <div className="mt-4">
        <EntryRow m={m} />
      </div>
    </div>
  );
}

function EntryRow({ m }: { m: any }) {
  return (
    <div className="rounded-sm border border-border bg-background p-4 text-xs">
      <div className="font-mono text-muted-foreground">
        SHA-256: {m.sha256.slice(0, 10)}…{m.sha256.slice(-6)}
      </div>
      <div className="mt-2 grid gap-1 text-foreground sm:grid-cols-2">
        {m.product_name && <div>Product: {m.product_name}</div>}
        {m.batch_id && <div>Batch: {m.batch_id}</div>}
        {m.issuing_lab && <div>Laboratory: {m.issuing_lab}</div>}
        {m.issue_date && <div>Issue date: {m.issue_date}</div>}
        {m.purity_percent !== null && m.purity_percent !== undefined && (
          <div>Purity: {m.purity_percent}%</div>
        )}
        <div>First seen: {new Date(m.first_seen_at).toLocaleDateString()}</div>
        <div>Last seen: {new Date(m.last_seen_at).toLocaleDateString()}</div>
      </div>
    </div>
  );
}
