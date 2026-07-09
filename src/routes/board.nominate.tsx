import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { nominateItem } from "@/lib/board.functions";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/board/nominate")({
  head: () => ({
    meta: [
      { title: "Nominate a product — Cooperative" },
      {
        name: "description",
        content: "Suggest a peptide product for an independent, community-funded test.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    product: typeof s.product === "string" ? s.product : undefined,
  }),
  component: NominatePage,
});

function NominatePage() {
  const { product } = Route.useSearch();
  const navigate = useNavigate();
  const [productName, setProductName] = useState(product ?? "");
  const [seller, setSeller] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({
          to: "/auth",
          search: { next: `/board/nominate${product ? `?product=${encodeURIComponent(product)}` : ""}` },
          replace: true,
        });
      } else {
        setReady(true);
      }
    });
  }, [navigate, product]);

  const submit = useMutation({
    mutationFn: async () => {
      return await nominateItem({
        data: {
          product_name: productName.trim(),
          seller: seller.trim(),
          source_url: sourceUrl.trim() || undefined,
          description: description.trim() || undefined,
        },
      });
    },
    onSuccess: (row: any) => {
      navigate({ to: "/board/$itemId", params: { itemId: row.id } });
    },
  });

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-6 py-12 md:px-10">
        <Link
          to="/board"
          className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground"
        >
          ← Board
        </Link>
        <h1 className="mt-4 font-serif text-4xl tracking-tight text-foreground">
          Nominate a product.
        </h1>
        <p className="mt-3 max-w-[60ch] text-sm text-muted-foreground">
          Suggest a specific product and seller for an independent test. Administrators review
          nominations and open them for funding.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="mt-8 space-y-5"
        >
          <Field label="Product name">
            <input
              required
              minLength={2}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Seller or brand">
            <input
              value={seller}
              onChange={(e) => setSeller(e.target.value)}
              className="input"
              placeholder="e.g. example vendor"
            />
          </Field>
          <Field label="Source URL (optional)">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="input"
              placeholder="https://…"
            />
          </Field>
          <Field label="Why this product?">
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input resize-none"
              placeholder="Briefly: who's buying it, and what specifically would an independent test settle?"
            />
          </Field>
          {submit.isError && (
            <div className="text-sm text-destructive">
              {(submit.error as Error).message}
            </div>
          )}
          <button
            disabled={submit.isPending || productName.trim().length < 2}
            className="rounded-sm bg-foreground px-6 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background disabled:opacity-40"
          >
            {submit.isPending ? "…" : "Submit nomination"}
          </button>
        </form>
      </main>
      <style>{`.input { width:100%; border:1px solid var(--color-border); background:var(--color-card); padding:0.6rem 0.75rem; border-radius:0.125rem; font-size:0.875rem; }
      .input:focus { outline: none; border-color: color-mix(in oklab, var(--color-foreground) 40%, transparent); }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
