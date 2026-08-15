import {
  NR,
  type ExtractedCertificate,
  type FieldResults,
  type FieldStatus,
  type Flag,
  type Verdict,
} from "./certificate-types";

const isReported = (v: string) => v.trim().toLowerCase() !== NR && v.trim() !== "";

function scoreIdentity(e: ExtractedCertificate): FieldStatus {
  const result = e.identity.result;
  const method = e.identity.method;
  if (!isReported(result) || !isReported(method)) return "unknown";
  const r = result.toLowerCase();
  const name = e.productName.toLowerCase();
  const seq = e.sequence.toLowerCase();

  // If the identity result explicitly names a different peptide, fail.
  // Heuristic: reported name/sequence appears in the identity result → pass.
  const matchesName = isReported(e.productName) && name.length > 2 && r.includes(name);
  const matchesSeq = isReported(e.sequence) && seq.length > 3 && r.includes(seq);
  if (matchesName || matchesSeq) return "pass";

  // If we have a reference name/sequence and neither appears in the result,
  // treat as fail (a mismatch). If we have no reference, we can't judge.
  if (isReported(e.productName) || isReported(e.sequence)) return "fail";
  return "unknown";
}

function scorePurity(e: ExtractedCertificate): FieldStatus {
  const p = e.purity.percent;
  if (p === null || Number.isNaN(p)) return "unknown";
  if (p >= 98) return "pass (premium)";
  if (p >= 95) return "pass (research grade)";
  return "fail";
}

function scoreReported(v: string): FieldStatus {
  return isReported(v) ? "reported (value shown)" : "not tested";
}

export function scoreFields(e: ExtractedCertificate): FieldResults {
  return {
    identity: scoreIdentity(e),
    purity: scorePurity(e),
    netPeptideContent: scoreReported(e.netPeptideContent),
    endotoxins: scoreReported(e.endotoxins.result),
    sterility: scoreReported(e.sterility),
    elementalImpurities: scoreReported(e.elementalImpurities),
    residualSolvents: scoreReported(e.residualSolvents),
  };
}

export function computeFlags(e: ExtractedCertificate, f: FieldResults): Flag[] {
  const flags: Flag[] = [];

  // Scope-overreach
  if (
    e.purity.percent !== null &&
    f.endotoxins === "not tested" &&
    f.sterility === "not tested" &&
    f.elementalImpurities === "not tested" &&
    f.residualSolvents === "not tested"
  ) {
    flags.push({
      level: "high",
      message:
        "The purity figure describes peptide-related impurities only. It says nothing about bacterial endotoxins, microbial contamination, elemental impurities, or residual solvents — the contaminants that matter for anything injected.",
    });
  }

  // Missing-test flags
  if (f.identity === "not tested" || f.identity === "unknown") {
    flags.push({
      level: "high",
      message:
        "No identity test reported. Without an identity method (e.g. mass spectrometry), nothing confirms the vial actually contains the named peptide rather than a different or unrelated compound.",
    });
  }
  if (f.endotoxins === "not tested") {
    flags.push({
      level: "high",
      message:
        "No bacterial endotoxin result reported. This omission blocks any claim of suitability for injection — endotoxins are pyrogenic contaminants that a purity number cannot detect.",
    });
  }
  if (f.sterility === "not tested") {
    flags.push({
      level: "high",
      message:
        "No sterility or microbial result reported. This omission blocks verification that the product is free of microbial contamination.",
    });
  }

  // Provenance
  if (!isReported(e.issuingLab)) {
    flags.push({
      level: "medium",
      message:
        "The issuing laboratory is not named on the certificate. An unnamed lab cannot be checked, contacted, or held accountable.",
    });
  }

  // Consistency (identity fail = named mismatch)
  if (f.identity === "fail") {
    flags.push({
      level: "high",
      message:
        "The identity result does not appear to match the named peptide or sequence on the certificate.",
    });
  }

  return flags;
}

function endotoxinExceedsLimit(e: ExtractedCertificate): boolean {
  const raw = `${e.endotoxins.result} ${e.endotoxins.units}`.toLowerCase();
  if (!isReported(e.endotoxins.result)) return false;
  // Pull first numeric value; USP <85> limit for parenteral is commonly <0.5 EU/mg for many peptides.
  const m = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return false;
  const value = parseFloat(m[1]);
  // Only treat as fail if units clearly indicate EU/mg or EU/ml AND value > 5 (a very permissive floor).
  if (/(eu\s*\/\s*mg|eu\s*\/\s*ml|iu\s*\/\s*mg)/.test(raw) && value > 5) return true;
  return false;
}

export function computeVerdict(e: ExtractedCertificate, f: FieldResults, flags: Flag[]): Verdict {
  const reportedCount = [
    isReported(e.productName),
    isReported(e.identity.result),
    e.purity.percent !== null,
    isReported(e.batchId),
    isReported(e.issuingLab),
  ].filter(Boolean).length;

  if (reportedCount < 2) return "Insufficient evidence";

  if (f.identity === "fail" || f.purity === "fail" || endotoxinExceedsLimit(e)) {
    return "Failed";
  }

  const hasHighOrMedium = flags.some((fl) => fl.level === "high" || fl.level === "medium");
  if (hasHighOrMedium) return "Document review — concerns";

  if (
    f.identity === "pass" &&
    (f.purity === "pass (premium)" || f.purity === "pass (research grade)")
  ) {
    return "Document review — consistent";
  }

  return "Document review — concerns";
}

export function analyze(e: ExtractedCertificate) {
  const fieldResults = scoreFields(e);
  const flags = computeFlags(e, fieldResults);
  const verdict = computeVerdict(e, fieldResults, flags);
  return { extracted: e, fieldResults, flags, verdict };
}
