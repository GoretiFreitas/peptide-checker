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

  // Missing-test flags.
  // `scoreIdentity` only ever returns pass | fail | unknown, so "unknown" is
  // the single case that means "no usable identity test was reported".
  if (f.identity === "unknown") {
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

/**
 * Endotoxin values only ever push a certificate to "Failed", so the bar is set
 * deliberately high. USP <85> parenteral limits are commonly around 0.5 EU/mg,
 * but this tool reads documents rather than testing product: it flags a hard
 * failure only at ten times that limit — a figure no compliant certificate
 * would ever report — and leaves everything below it to the flag system.
 */
const ENDOTOXIN_FAIL_THRESHOLD_EU = 5;

/** A number that is directly attached to an endotoxin unit, e.g. "0.12 EU/mg". */
const ENDOTOXIN_VALUE_WITH_UNIT = /([0-9]+(?:\.[0-9]+)?)\s*(?:eu|iu)\s*\/\s*(?:mg|ml|l)\b/;

/** Upper-bound or qualitative results, which cannot exceed a threshold. */
const ENDOTOXIN_QUALITATIVE = /\b(pass(?:e[sd])?|complies|conforms|negative|not detected|nd)\b/i;

function endotoxinExceedsLimit(e: ExtractedCertificate): boolean {
  const result = e.endotoxins.result.trim();
  if (!isReported(result)) return false;

  // "<0.5 EU/mg" and "Pass" are statements that the limit was met.
  if (/^[<≤]/.test(result)) return false;
  if (ENDOTOXIN_QUALITATIVE.test(result)) return false;

  // Read the number attached to the unit rather than the first number in the
  // string: certificates routinely quote the standard or the limit alongside
  // the result (e.g. "0.12 EU/mg, limit 0.5 per USP <85>").
  const raw = `${result} ${e.endotoxins.units}`.toLowerCase();
  const match = raw.match(ENDOTOXIN_VALUE_WITH_UNIT);
  if (!match) return false;

  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return false;
  return value > ENDOTOXIN_FAIL_THRESHOLD_EU;
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
