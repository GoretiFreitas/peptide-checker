import { FileText, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AnalysisResult, ExtractedCertificate, FieldResults, Flag } from "@/lib/certificate-types";
import { StatusBadge, VerdictBadge } from "./StatusBadge";


interface Props {
  state:
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ok"; result: AnalysisResult };
}

export function ResultsPanel({ state }: Props) {
  if (state.kind === "idle") {
    return (
      <PanelShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
            Analysis results pending
          </div>
          <div className="max-w-md text-xs text-muted-foreground">
            Input data and click check certificate to begin verification process.
          </div>
        </div>
      </PanelShell>
    );
  }

  if (state.kind === "loading") {
    return (
      <PanelShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
            Reading certificate
          </div>
        </div>
      </PanelShell>
    );
  }

  if (state.kind === "error") {
    return (
      <PanelShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" strokeWidth={1.5} />
          <div className="text-sm text-foreground">Something went wrong</div>
          <div className="max-w-md text-xs text-muted-foreground">{state.message}</div>
        </div>
      </PanelShell>
    );
  }

  return <Results result={state.result} />;
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed border-border bg-card/50 p-8">
      {children}
    </div>
  );
}

function Results({ result }: { result: AnalysisResult }) {
  const { extracted, fieldResults, flags, verdict } = result;

  return (
    <div className="space-y-8 rounded-md border border-border bg-card p-6 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
            Overall outcome
          </h2>
          <div className="mt-2">
            <VerdictBadge verdict={verdict} />
          </div>
          {verdict === "Document review — consistent" && (
            <div className="mt-2 text-xs text-muted-foreground">
              Based on the document only, not an independent test.
            </div>
          )}
        </div>
      </div>

      <FieldsList extracted={extracted} results={fieldResults} />

      <FlagsList flags={flags} />

      <DisclaimerBox />

      <HonestFraming productName={extracted.productName} />
    </div>
  );
}

function Row({
  label,
  value,
  status,
  hint,
}: {
  label: string;
  value: string;
  status?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-3 last:border-b-0 md:grid-cols-[220px_1fr_auto] md:items-center md:gap-4">
      <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
        {label}
      </div>
      <div>
        <div className="text-sm text-foreground">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="md:justify-self-end">{status}</div>
    </div>
  );
}

function FieldsList({
  extracted,
  results,
}: {
  extracted: ExtractedCertificate;
  results: FieldResults;
}) {
  const purityValue =
    extracted.purity.percent !== null
      ? `${extracted.purity.percent}%${
          extracted.purity.method && extracted.purity.method !== "not reported"
            ? ` · ${extracted.purity.method}`
            : ""
        }${
          extracted.purity.wavelength && extracted.purity.wavelength !== "not reported"
            ? ` @ ${extracted.purity.wavelength}`
            : ""
        }`
      : "not reported";

  return (
    <div>
      <h2 className="mb-2 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
        Extracted fields
      </h2>
      <div>
        <Row label="Product / peptide" value={extracted.productName} />
        <Row label="Sequence" value={extracted.sequence} />
        <Row
          label="Identity"
          value={extracted.identity.result}
          hint={
            extracted.identity.method !== "not reported"
              ? `Method: ${extracted.identity.method}`
              : undefined
          }
          status={<StatusBadge status={results.identity} />}
        />
        <Row
          label="Chromatographic purity"
          value={purityValue}
          status={<StatusBadge status={results.purity} />}
        />
        <Row
          label="Net peptide content"
          value={extracted.netPeptideContent}
          status={<StatusBadge status={results.netPeptideContent} />}
        />
        <Row
          label="Bacterial endotoxins"
          value={
            extracted.endotoxins.result === "not reported"
              ? "not reported"
              : `${extracted.endotoxins.result}${
                  extracted.endotoxins.units !== "not reported"
                    ? ` ${extracted.endotoxins.units}`
                    : ""
                }`
          }
          status={<StatusBadge status={results.endotoxins} />}
        />
        <Row
          label="Sterility / microbial"
          value={extracted.sterility}
          status={<StatusBadge status={results.sterility} />}
        />
        <Row
          label="Elemental impurities"
          value={extracted.elementalImpurities}
          status={<StatusBadge status={results.elementalImpurities} />}
        />
        <Row
          label="Residual solvents"
          value={extracted.residualSolvents}
          status={<StatusBadge status={results.residualSolvents} />}
        />
        <Row label="Issuing laboratory" value={extracted.issuingLab} />
        <Row label="Issue date" value={extracted.issueDate} />
        <Row label="Batch / lot" value={extracted.batchId} />
      </div>
      {extracted.rawNotes && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground">
            Verbatim quotes from certificate
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-sm border border-border bg-background/50 p-3 font-mono text-xs text-muted-foreground">
            {extracted.rawNotes}
          </pre>
        </details>
      )}
    </div>
  );
}

function FlagsList({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
          Flags
        </h2>
        <div className="text-sm text-muted-foreground">No flags raised.</div>
      </div>
    );
  }
  const order = { high: 0, medium: 1, low: 2 } as const;
  const sorted = [...flags].sort((a, b) => order[a.level] - order[b.level]);
  return (
    <div>
      <h2 className="mb-2 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
        Flags
      </h2>
      <ul className="space-y-3">
        {sorted.map((f, i) => (
          <li key={i} className="flex gap-3 rounded-sm border border-border bg-background/40 p-3">
            <LevelDot level={f.level} />
            <div className="flex-1">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {f.level} importance
              </div>
              <div className="text-sm text-foreground">{f.message}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelDot({ level }: { level: Flag["level"] }) {
  const color =
    level === "high"
      ? "bg-[--badge-fail-fg]"
      : level === "medium"
        ? "bg-[--badge-warn-fg]"
        : "bg-[--badge-neutral-fg]";
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function DisclaimerBox() {
  return (
    <div className="rounded-sm border border-border bg-background/60 p-4 text-sm text-foreground">
      This describes what the certificate reports about the contents of a product. It is not a
      statement that the product is safe to inject or consume, or that it is effective or approved.
    </div>
  );
}

function HonestFraming({ productName }: { productName: string }) {
  const q = productName && productName !== "not reported" ? `?product=${encodeURIComponent(productName)}` : "";
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        A document check is weaker than an independent test. A certificate can be fabricated, or
        produced from a different batch than the one that actually shipped. The strongest check is
        an independent test of a product bought anonymously — which is what the cooperative's
        community testing board funds.
      </p>
      <Link
        to="/board/nominate"
        search={{ product: productName && productName !== "not reported" ? productName : undefined }}
        className="inline-flex items-center rounded-sm bg-foreground px-4 py-2 text-[11px] font-medium tracking-[0.22em] uppercase text-background hover:bg-foreground/90"
      >
        Nominate for independent testing
      </Link>
      <span aria-hidden className="hidden">{q}</span>
    </div>
  );
}

