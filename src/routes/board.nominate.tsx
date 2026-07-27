import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { nominateItem } from "@/lib/board.functions";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/board/nominate")({
  head: () => ({
    meta: [
      { title: "Nominate a product — Certificate Checker" },
      {
        name: "description",
        content: "Suggest a peptide product for an independent, community-funded test.",
      },
      { property: "og:title", content: "Nominate a product — Certificate Checker" },
      {
        property: "og:description",
        content: "Suggest a peptide product for an independent, community-funded test.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/board/nominate" },
    ],
    links: [{ rel: "canonical", href: "/board/nominate" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    product: typeof s.product === "string" ? s.product : undefined,
  }),
  component: NominatePage,
});

type Lab = "janoshik" | "finnrick";

const TEST_OPTIONS: Record<Lab, { key: string; label: string }[]> = {
  janoshik: [
    { key: "purity", label: "Purity + quantity" },
    { key: "endotoxin", label: "Endotoxin (LAL)" },
    { key: "heavy_metals", label: "Heavy metals (As, Cd, Pb, Hg)" },
    { key: "sterility", label: "Sterility (TAMC + TYMC)" },
  ],
  finnrick: [
    { key: "purity", label: "Purity + safety test" },
    { key: "endotoxin", label: "Endotoxin analysis" },
    { key: "heavy_metals", label: "Heavy metals analysis" },
  ],
};

function NominatePage() {
  const { product } = Route.useSearch();
  const navigate = useNavigate();
  const [productName, setProductName] = useState(product ?? "");
  const [seller, setSeller] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [lab, setLab] = useState<Lab>("janoshik");
  const [tests, setTests] = useState<string[]>(["purity"]);
  const [consent, setConsent] = useState(false);
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

  const toggleTest = (key: string) => {
    setTests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const changeLab = (next: Lab) => {
    setLab(next);
    setTests((prev) => prev.filter((k) => TEST_OPTIONS[next].some((t) => t.key === k)));
  };

  const submit = useMutation({
    mutationFn: async () => {
      return await nominateItem({
        data: {
          product_name: productName.trim(),
          seller: seller.trim(),
          source_url: sourceUrl.trim() || undefined,
          description: description.trim() || undefined,
          lab,
          test_battery: tests,
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

          <div>
            <label className="mb-2 block text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
              Preferred lab
            </label>
            <div className="flex flex-col gap-3 rounded-sm border border-border bg-card p-3 sm:flex-row sm:gap-6">
              <LabOption
                id="lab-janoshik"
                value="janoshik"
                label="Janoshik International"
                note="Prague · ships worldwide"
                checked={lab === "janoshik"}
                onChange={() => changeLab("janoshik")}
              />
              <LabOption
                id="lab-finnrick"
                value="finnrick"
                label="Finnrick"
                note="US only"
                checked={lab === "finnrick"}
                onChange={() => changeLab("finnrick")}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
              Tests to include
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEST_OPTIONS[lab].map((t) => (
                <label
                  key={t.key}
                  className="flex items-center gap-3 rounded-sm border border-border bg-card p-3 text-sm text-foreground hover:border-foreground/40"
                >
                  <input
                    type="checkbox"
                    checked={tests.includes(t.key)}
                    onChange={() => toggleTest(t.key)}
                    className="h-4 w-4"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-sm border border-border bg-card p-3 text-sm leading-relaxed text-muted-foreground">
            A small initial pledge — even{" "}
            <span className="font-medium text-foreground">$5 USD</span> — from the person
            nominating the batch helps set the example and signals genuine interest to other
            backers. It is entirely optional, but campaigns that start with a first backer tend to
            fund faster.
          </div>

          <label className="flex items-start gap-3 rounded-sm border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              I consent to Descier Science storing the information above so administrators can review
              this nomination. Data is handled in line with Data Protection Laws ( LGPD and GDPR).
            </span>
          </label>
          {submit.isError && (
            <div className="text-sm text-destructive">
              {(submit.error as Error).message}
            </div>
          )}
          <button
            disabled={submit.isPending || productName.trim().length < 2 || !consent || tests.length === 0}
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

function LabOption({
  id,
  value,
  label,
  note,
  checked,
  onChange,
}: {
  id: string;
  value: string;
  label: string;
  note: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="radio"
        name="lab"
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4"
      />
      <div className="text-sm leading-snug">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{note}</div>
      </div>
    </label>
  );
}
