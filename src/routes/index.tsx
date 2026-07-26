import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { extractCertificate } from "@/lib/extract-certificate.functions";
import { analyze } from "@/lib/scoring";
import { registerCertificate } from "@/lib/register.functions";
import { hashFile, hashText } from "@/lib/hash";
import { FileDropzone } from "@/components/checker/FileDropzone";
import { RawTextInput } from "@/components/checker/RawTextInput";
import { ResultsPanel } from "@/components/checker/ResultsPanel";
import { SiteHeader } from "@/components/SiteHeader";

import type { AnalysisResult } from "@/lib/certificate-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PeptidesCheck | Peptide Certificate of Analysis review" },
      {
        name: "description",
        content:
          "Read a peptide Certificate of Analysis and see, field by field, what the document actually reports, what it leaves out, and whether it can be trusted.",
      },
      { property: "og:title", content: "PeptidesCheck, by Descier Science" },
      {
        property: "og:description",
        content:
          "Independent and community-supported peptide Certificate of Analysis review, plus an append-only Authenticity Register.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://peptidescheck.xyz/" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://peptidescheck.xyz/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "PeptidesCheck",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web",
          description:
            "Peptide Certificate of Analysis (COA) review with per-field verdicts and an append-only Authenticity Register.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Index,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

interface RunResult {
  analysis: AnalysisResult;
  registerInfo: { sha256: string; status: "newly_registered" | "already_registered" } | null;
}

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const toolRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<RunResult> => {
      // Client-side hash first, for the Authenticity Register.
      let sha256: string;
      let normalized: string | null = null;
      if (file) {
        sha256 = await hashFile(file);
      } else {
        const h = await hashText(text.trim());
        sha256 = h.raw;
        normalized = h.normalized;
      }

      const payload: {
        text?: string;
        fileBase64?: string;
        fileMime?: string;
        fileName?: string;
      } = {};
      if (file) {
        payload.fileBase64 = await fileToBase64(file);
        payload.fileMime = file.type;
        payload.fileName = file.name;
      }
      if (text.trim()) payload.text = text.trim();

      const extracted = await extractCertificate({ data: payload });
      const analysis = analyze(extracted);

      let registerInfo: RunResult["registerInfo"] = null;
      try {
        const res = await registerCertificate({
          data: {
            sha256,
            normalized_sha256: normalized,
            batch_id: extracted.batchId !== "not reported" ? extracted.batchId : null,
            product_name: extracted.productName !== "not reported" ? extracted.productName : null,
            sequence: extracted.sequence !== "not reported" ? extracted.sequence : null,
            purity_percent: extracted.purity.percent ?? null,
            issuing_lab: extracted.issuingLab !== "not reported" ? extracted.issuingLab : null,
            issue_date: extracted.issueDate !== "not reported" ? extracted.issueDate : null,
          },
        });
        registerInfo = { sha256, status: res.status };
      } catch {
        // Registry failure must not break the checker.
        registerInfo = null;
      }

      return { analysis, registerInfo };
    },
  });

  const canSubmit = (!!file || text.trim().length > 0) && !mutation.isPending;

  const state = useMemo<React.ComponentProps<typeof ResultsPanel>["state"]>(() => {
    if (mutation.isPending) return { kind: "loading" };
    if (mutation.isError)
      return {
        kind: "error",
        message: mutation.error instanceof Error ? mutation.error.message : "Unknown error",
      };
    if (mutation.data)
      return { kind: "ok", result: mutation.data.analysis, registerInfo: mutation.data.registerInfo };
    return { kind: "idle" };
  }, [mutation.isPending, mutation.isError, mutation.error, mutation.data]);

  const scrollToTool = () =>
    toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-16 md:px-10 md:py-24">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            {"\n"}
          </div>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight text-foreground md:text-6xl">
            PeptidesCheck.
          </h1>
          <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-foreground md:text-lg">
            Read a peptide Certificate of Analysis (COA) and see, field by field, what the document
            actually reports, what it leaves out, and whether it can be trusted.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={scrollToTool}
              className="rounded-sm bg-foreground px-6 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background hover:bg-foreground/90"
            >
              Check a certificate
            </button>
            <Link
              to="/verify"
              search={{}}
              className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground hover:text-foreground"
            >
              Verify a batch →
            </Link>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Independent and community-supported. No login, and no personal data stored.
          </p>
        </div>
      </section>

      {/* Tool */}
      <section ref={toolRef} className="border-b border-border">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-12 md:grid-cols-[280px_1fr] md:gap-12 md:px-10 md:py-16">
          <aside className="md:sticky md:top-10 md:h-fit">
            <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
              Document review
            </div>
            <h2 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-foreground">
              Upload or paste.
            </h2>
            <p className="mt-4 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
              An image or a Portable Document Format (PDF) file up to 12 megabytes, or raw
              certificate text.
            </p>
            <div className="mt-6 h-px w-16 bg-border" />
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit}
              className="mt-6 w-full rounded-sm bg-foreground/90 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background transition-colors hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mutation.isPending ? "Checking…" : "Check certificate"}
            </button>
            <div className="mt-4 text-center text-[10px] leading-relaxed tracking-[0.12em] uppercase text-muted-foreground">
              Document-only review
              <br />
              No login, no personal data stored
            </div>
          </aside>

          <main className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FileDropzone file={file} onFile={setFile} disabled={mutation.isPending} />
              <RawTextInput value={text} onChange={setText} disabled={mutation.isPending} />
            </div>
            <ResultsPanel state={state} />
          </main>
        </div>
      </section>

      {/* What we check */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-[1100px] px-6 py-16 md:px-10 md:py-20">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            Method
          </div>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground md:text-4xl">
            What we check.
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <Item title="Purity claim versus method">
              Whether the stated method (for example reverse-phase high-performance liquid
              chromatography) actually supports the reported purity number, and whether wavelength
              and integration details are present.
            </Item>
            <Item title="Sequence, mass, and batch consistency">
              Cross-check the peptide sequence, the reported molecular mass, and the batch identity
              against one another for internal consistency.
            </Item>
            <Item title="Sterility and endotoxin testing">
              Whether sterility and bacterial endotoxin testing is present or missing. Missing is a
              red flag for anything intended to be injected.
            </Item>
            <Item title="Identity and impurities">
              Identity confirmation (for example by mass spectrometry) and the presence of counted
              impurities, residual solvents, and elemental impurities.
            </Item>
            <Item title="Signs of reuse or tampering">
              Duplicate hashes, reused batch identifiers with different content, and templated or
              obviously edited documents surface through the Authenticity Register.
            </Item>
            <Item title="Honest gaps">
              Fields the certificate simply does not report are shown as such, not silently passed.
            </Item>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-16 md:px-10 md:py-20">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            How it works
          </div>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground md:text-4xl">
            How the tool actually reads a certificate.
          </h2>
          <ol className="mt-8 space-y-6">
            <Step n={1} title="Read the document">
              An artificial intelligence (AI) reader extracts structured fields from the uploaded
              image, Portable Document Format (PDF), or pasted text. This step is heuristic.
            </Step>
            <Step n={2} title="Score with rules">
              Extracted fields are scored deterministically. Purity thresholds, missing safety tests,
              and internal inconsistencies are rule-based, not AI opinions.
            </Step>
            <Step n={3} title="Hash and cross-reference">
              The exact submitted content is hashed with the Secure Hash Algorithm 256-bit (SHA-256)
              in your browser and cross-referenced against the append-only Authenticity Register to
              detect duplicates and reuse.
            </Step>
            <Step n={4} title="Return a plain-language verdict">
              You get a per-field breakdown, a one-sentence overall summary with caveats, and a
              shareable verification link if the certificate is registered.
            </Step>
          </ol>
        </div>
      </section>

      {/* Authenticity register call-out */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-[1100px] px-6 py-16 md:px-10 md:py-20">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            Authenticity Register
          </div>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground md:text-4xl">
            Every check leaves a durable trace.
          </h2>
          <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-foreground md:text-base">
            Each certificate is hashed with SHA-256 and recorded in an append-only register.
            Entries cannot be edited or deleted. That lets the tool detect the same certificate being
            reused for a different batch, or the same batch identifier arriving with different
            content, which a single document reading cannot catch.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/verify"
              search={{}}
              className="rounded-sm bg-foreground px-5 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-background hover:bg-foreground/90"
            >
              Verify a batch or hash
            </Link>
          </div>
        </div>
      </section>

      {/* Honest limits */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-16 md:px-10 md:py-20">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            Honest limits
          </div>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground md:text-4xl">
            What a certificate review can and cannot tell you.
          </h2>
          <ul className="mt-8 space-y-4">
            <Limit>
              A document review checks the paper, not the vial. A genuine-looking certificate can
              still accompany an adulterated product.
            </Limit>
            <Limit>
              Purity is not safety. Most certificates never test sterility or bacterial endotoxins,
              which are the parts that make an injectable dangerous.
            </Limit>
            <Limit>
              For anything intended to go near a person, independent laboratory testing of the actual
              material is required. This tool does not replace it.
            </Limit>
          </ul>
        </div>
      </section>

      {/* Who this is for */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-[1100px] px-6 py-16 md:px-10 md:py-20">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            Audience
          </div>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground md:text-4xl">
            Who this is for.
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-5 md:gap-6">
            {["Researchers", "Clinics", "Compounders", "Distributors", "Buyers"].map((x) => (
              <div
                key={x}
                className="rounded-sm border border-border bg-background px-4 py-6 text-center text-sm text-foreground"
              >
                {x}
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-md border border-border bg-background p-6">
            <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
              Next step
            </div>
            <p className="mt-3 max-w-[70ch] text-sm text-foreground">
              Submit a batch for independent laboratory testing, or support the work. Both keep the
              tool independent.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/board"
                className="rounded-sm bg-foreground px-5 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-background hover:bg-foreground/90"
              >
                Community testing board
              </Link>
              <Link
                to="/support"
                search={{}}
                className="rounded-sm border border-border px-5 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-foreground hover:bg-card"
              >
                Support the work
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust and independence */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1100px] px-6 py-16 md:px-10 md:py-20">
          <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            Trust and independence
          </div>
          <h2 className="mt-3 font-serif text-3xl tracking-tight text-foreground md:text-4xl">
            Who runs this, and how it stays independent.
          </h2>
          <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-foreground md:text-base">
            PeptidesCheck is run by Descier Science and is independent and community-supported.
          </p>
            deliberately separate from any commercial venture-services arm, because the moment a
            verifier looks like the same owner grading paying clients, its credibility is gone. When
            independent laboratory partners are added, they will be named here by their real name.
          </p>
        </div>
      </section>
    </div>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-medium tracking-[0.18em] text-foreground">
        {n}
      </div>
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function Limit({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-sm border border-border bg-background p-4">
      <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[--badge-warn-fg]" />
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </li>
  );
}
