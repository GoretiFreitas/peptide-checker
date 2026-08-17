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
import { ScientificBackground } from "@/components/parallax/ScientificBackground";
import { ShieldCheck, FileSearch, Lock, AlertTriangle, ArrowRight } from "lucide-react";

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
      return {
        kind: "ok",
        result: mutation.data.analysis,
        registerInfo: mutation.data.registerInfo,
      };
    return { kind: "idle" };
  }, [mutation.isPending, mutation.isError, mutation.error, mutation.data]);

  const scrollToTool = () =>
    toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Layered Scientific Parallax System */}
      <ScientificBackground />

      <div className="relative z-10">
        <SiteHeader />

        {/* Hero Section */}
        <section className="relative border-b border-[rgba(212,175,135,0.2)]">
          <div className="mx-auto max-w-[1200px] px-6 py-20 md:px-10 md:py-28">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(200,165,125,0.35)] bg-white/80 px-3.5 py-1.5 backdrop-blur-md shadow-xs mb-6">
              <span className="h-2 w-2 rounded-full bg-[#C59B6D] animate-pulse" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Independent Scientific CoA Analysis
              </span>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
              <div className="max-w-[720px]">
                <h1 className="font-sans text-5xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl md:text-7xl">
                  peptides<span className="font-light text-[#B88B60]">check</span>
                  <span className="text-[#C59B6D]">.</span>
                </h1>
                <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-foreground/80 md:text-xl font-normal">
                  Read a peptide Certificate of Analysis (COA) and see, field by field, what the
                  document actually reports, what it leaves out, and whether it can be trusted.
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <button
                    onClick={scrollToTool}
                    className="btn-primary flex items-center gap-2.5 rounded-full px-7 py-3.5 text-xs font-semibold tracking-[0.18em] shadow-md transition-all hover:shadow-lg"
                  >
                    <span>Check a certificate</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <Link
                    to="/verify"
                    search={{}}
                    className="btn-secondary rounded-full px-7 py-3.5 text-xs font-semibold tracking-[0.18em] transition-all"
                  >
                    Verify a batch →
                  </Link>
                </div>
                <div className="mt-8 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-[#B88B60]" /> Independent &amp;
                    community-supported
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-[#B88B60]" /> No login, no personal data
                    stored
                  </span>
                </div>
              </div>

              {/* Hero Visual Brand Presentation */}
              <div className="hidden lg:flex shrink-0 justify-center">
                <div className="relative rounded-3xl border border-[rgba(212,175,135,0.35)] bg-white/75 p-6 backdrop-blur-md shadow-[0_20px_50px_-15px_rgba(50,40,30,0.1)] transition-transform duration-300 hover:scale-[1.02]">
                  {/* Square mark, not the wordmark lockup: this frame is
                      square, and the lockup would letterbox into it while
                      repeating the heading text alongside. */}
                  <img
                    src="/brand/mark.webp"
                    alt="PeptidesCheck"
                    width={512}
                    height={512}
                    decoding="async"
                    className="h-64 w-64 rounded-2xl object-contain drop-shadow-sm"
                  />
                  <div className="mt-4 text-center">
                    <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                      Molecular Biology Grade
                    </div>
                    <div className="text-xs font-medium text-foreground mt-0.5">
                      Deterministic Verification Suite
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Tool Section */}
        <section
          ref={toolRef}
          className="relative border-b border-[rgba(212,175,135,0.2)] py-16 md:py-24"
        >
          <div className="mx-auto grid max-w-[1400px] gap-8 px-6 md:grid-cols-[300px_1fr] md:gap-12 md:px-10">
            <aside className="clinical-panel md:sticky md:top-24 md:h-fit p-6 sm:p-7">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] uppercase text-[#B88B60]">
                <FileSearch className="h-3.5 w-3.5" />
                <span>Document review</span>
              </div>
              <h2 className="mt-3 font-sans text-2xl font-bold leading-tight tracking-tight text-foreground">
                Upload or paste.
              </h2>
              <p className="mt-3 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
                An image or a Portable Document Format (PDF) file up to 12 megabytes, or raw
                certificate text.
              </p>
              <div className="my-6 h-px w-full bg-[rgba(212,175,135,0.25)]" />
              <button
                onClick={() => mutation.mutate()}
                disabled={!canSubmit}
                className="btn-primary w-full rounded-xl py-3.5 text-xs font-semibold tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {mutation.isPending ? "Checking…" : "Check certificate"}
              </button>
              <div className="mt-5 text-center text-[10px] leading-relaxed tracking-[0.14em] uppercase text-muted-foreground">
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
        <section className="relative border-b border-[rgba(212,175,135,0.2)] bg-white/40 backdrop-blur-xs py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-6 md:px-10">
            <div className="text-[11px] font-bold tracking-[0.24em] uppercase text-[#B88B60]">
              Method
            </div>
            <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              What we check.
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Item title="Purity claim versus method">
                Whether the stated method (for example reverse-phase high-performance liquid
                chromatography) actually supports the reported purity number, and whether wavelength
                and integration details are present.
              </Item>
              <Item title="Sequence, mass, and batch consistency">
                Cross-check the peptide sequence, the reported molecular mass, and the batch
                identity against one another for internal consistency.
              </Item>
              <Item title="Sterility and endotoxin testing">
                Whether sterility and bacterial endotoxin testing is present or missing. Missing is
                a red flag for anything intended to be injected.
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
                Fields the certificate simply does not report are shown as such, not silently
                passed.
              </Item>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="relative border-b border-[rgba(212,175,135,0.2)] py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-6 md:px-10">
            <div className="text-[11px] font-bold tracking-[0.24em] uppercase text-[#B88B60]">
              How it works
            </div>
            <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              How the tool actually reads a certificate.
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Step n={1} title="Read the document">
                An artificial intelligence (AI) reader extracts structured fields from the uploaded
                image, Portable Document Format (PDF), or pasted text. This step is heuristic.
              </Step>
              <Step n={2} title="Score with rules">
                Extracted fields are scored deterministically. Purity thresholds, missing safety
                tests, and internal inconsistencies are rule-based, not AI opinions.
              </Step>
              <Step n={3} title="Hash and cross-reference">
                The exact submitted content is hashed with the Secure Hash Algorithm 256-bit
                (SHA-256) in your browser and cross-referenced against the append-only Authenticity
                Register to detect duplicates and reuse.
              </Step>
              <Step n={4} title="Return a plain-language verdict">
                You get a per-field breakdown, a one-sentence overall summary with caveats, and a
                shareable verification link if the certificate is registered.
              </Step>
            </div>
          </div>
        </section>

        {/* Authenticity register call-out */}
        <section className="relative border-b border-[rgba(212,175,135,0.2)] bg-gradient-to-r from-white/60 via-white/80 to-white/60 backdrop-blur-md py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-6 md:px-10">
            <div className="clinical-panel p-8 sm:p-12 md:p-16 relative overflow-hidden">
              <div className="relative z-10 max-w-[760px]">
                <div className="text-[11px] font-bold tracking-[0.24em] uppercase text-[#B88B60]">
                  Authenticity Register
                </div>
                <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Every check leaves a durable trace.
                </h2>
                <p className="mt-5 text-base leading-relaxed text-foreground/80 md:text-lg">
                  Each certificate is hashed with SHA-256 and recorded in an append-only register.
                  Entries cannot be edited or deleted. That lets the tool detect the same
                  certificate being reused for a different batch, or the same batch identifier
                  arriving with different content, which a single document reading cannot catch.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    to="/verify"
                    search={{}}
                    className="btn-primary rounded-full px-7 py-3.5 text-xs font-semibold tracking-[0.18em] shadow-sm transition-all hover:shadow-md"
                  >
                    Verify a batch or hash
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Honest limits */}
        <section className="relative border-b border-[rgba(212,175,135,0.2)] py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-6 md:px-10">
            <div className="text-[11px] font-bold tracking-[0.24em] uppercase text-[#B88B60]">
              Honest limits
            </div>
            <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              What a certificate review can and cannot tell you.
            </h2>
            <ul className="mt-10 space-y-4">
              <Limit>
                A document review checks the paper, not the vial. A genuine-looking certificate can
                still accompany an adulterated product.
              </Limit>
              <Limit>
                Purity is not safety. Most certificates never test sterility or bacterial
                endotoxins, which are the parts that make an injectable dangerous.
              </Limit>
              <Limit>
                For anything intended to go near a person, independent laboratory testing of the
                actual material is required. This tool does not replace it.
              </Limit>
            </ul>
          </div>
        </section>

        {/* Who this is for */}
        <section className="relative border-b border-[rgba(212,175,135,0.2)] bg-white/40 backdrop-blur-xs py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-6 md:px-10">
            <div className="text-[11px] font-bold tracking-[0.24em] uppercase text-[#B88B60]">
              Audience
            </div>
            <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Who this is for.
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {["Researchers", "Clinics", "Compounders", "Distributors", "Buyers"].map((x) => (
                <div
                  key={x}
                  className="clinical-card flex items-center justify-center p-6 text-center text-sm font-semibold tracking-wide text-foreground hover:border-[#C59B6D]"
                >
                  {x}
                </div>
              ))}
            </div>

            <div className="clinical-panel mt-12 p-8 sm:p-10">
              <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-[#B88B60]">
                Next step
              </div>
              <p className="mt-3 max-w-[70ch] text-base leading-relaxed text-foreground">
                Submit a batch for independent laboratory testing, or support the work. Both keep
                the tool independent.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  to="/fund"
                  className="btn-primary rounded-full px-6 py-3 text-xs font-semibold tracking-[0.18em]"
                >
                  Community testing fund
                </Link>
                <Link
                  to="/support"
                  search={{}}
                  className="btn-secondary rounded-full px-6 py-3 text-xs font-semibold tracking-[0.18em]"
                >
                  Support the work
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Trust and independence */}
        <section className="relative py-20 md:py-28">
          <div className="mx-auto max-w-[1200px] px-6 md:px-10">
            <div className="text-[11px] font-bold tracking-[0.24em] uppercase text-[#B88B60]">
              Trust and independence
            </div>
            <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Who runs this, and how it stays independent.
            </h2>
            <p className="mt-4 max-w-[70ch] text-base leading-relaxed text-foreground/80 md:text-lg">
              PeptidesCheck is run by Descier Science and is independent and community-supported.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="clinical-card p-6 sm:p-7 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-[#C59B6D]" />
          <div className="text-base font-bold tracking-tight text-foreground">{title}</div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="clinical-card p-6 sm:p-7 flex flex-col">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-[rgba(200,165,125,0.4)] text-xs font-bold text-foreground shadow-xs mb-4">
        0{n}
      </div>
      <div className="text-base font-bold tracking-tight text-foreground">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Limit({ children }: { children: React.ReactNode }) {
  return (
    <li className="clinical-card flex gap-4 p-5 sm:p-6 items-start">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[--badge-warn-bg] text-[--badge-warn-fg]">
        <AlertTriangle className="h-3 w-3" />
      </div>
      <p className="text-sm leading-relaxed text-foreground font-normal">{children}</p>
    </li>
  );
}
