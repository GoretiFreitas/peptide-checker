import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { NR, type ExtractedCertificate } from "./certificate-types";
import { analyze, computeFlags, computeVerdict, scoreFields } from "./scoring";

/** A certificate with nothing reported; override only what a test cares about. */
function certificate(overrides: Partial<ExtractedCertificate> = {}): ExtractedCertificate {
  return {
    productName: NR,
    sequence: NR,
    identity: { result: NR, method: NR },
    purity: { percent: null, method: NR, wavelength: NR },
    netPeptideContent: NR,
    endotoxins: { result: NR, units: NR },
    sterility: NR,
    elementalImpurities: NR,
    residualSolvents: NR,
    issuingLab: NR,
    issueDate: NR,
    batchId: NR,
    rawNotes: "",
    ...overrides,
  };
}

/** A certificate that reports everything cleanly — the "consistent" baseline. */
function completeCertificate(overrides: Partial<ExtractedCertificate> = {}): ExtractedCertificate {
  return certificate({
    productName: "BPC-157",
    sequence: "GEPPPGKPADDAGLV",
    identity: { result: "Observed mass matches BPC-157", method: "ESI-MS" },
    purity: { percent: 99.1, method: "RP-HPLC", wavelength: "220 nm" },
    endotoxins: { result: "<0.5", units: "EU/mg" },
    sterility: "Sterile",
    elementalImpurities: "Complies with ICH Q3D",
    residualSolvents: "Complies with ICH Q3C",
    issuingLab: "Janoshik Analytical",
    batchId: "B-2026-041",
    ...overrides,
  });
}

describe("scoreFields — purity", () => {
  it("grades purity against the published bands", () => {
    const bands: Array<[number | null, string]> = [
      [99.5, "pass (premium)"],
      [98, "pass (premium)"],
      [97.4, "pass (research grade)"],
      [95, "pass (research grade)"],
      [94.9, "fail"],
      [12, "fail"],
    ];
    for (const [percent, expected] of bands) {
      const fields = scoreFields(certificate({ purity: { percent, method: NR, wavelength: NR } }));
      assert.equal(fields.purity, expected, `purity ${percent}`);
    }
  });

  it("treats an unreported purity as unknown rather than a failure", () => {
    assert.equal(scoreFields(certificate()).purity, "unknown");
  });
});

describe("scoreFields — identity", () => {
  it("passes when the identity result names the product", () => {
    const fields = scoreFields(
      certificate({
        productName: "Semaglutide",
        identity: { result: "Confirmed semaglutide, 4113.6 Da", method: "ESI-MS" },
      }),
    );
    assert.equal(fields.identity, "pass");
  });

  it("passes when the identity result quotes the sequence", () => {
    const fields = scoreFields(
      certificate({
        sequence: "GEPPPGKPADDAGLV",
        identity: { result: "Sequence GEPPPGKPADDAGLV confirmed", method: "MS/MS" },
      }),
    );
    assert.equal(fields.identity, "pass");
  });

  it("fails when a reference exists and the result matches neither", () => {
    const fields = scoreFields(
      certificate({
        productName: "BPC-157",
        identity: { result: "Observed mass matches TB-500", method: "ESI-MS" },
      }),
    );
    assert.equal(fields.identity, "fail");
  });

  it("is unknown when no identity method is reported", () => {
    const fields = scoreFields(
      certificate({ productName: "BPC-157", identity: { result: "Confirmed", method: NR } }),
    );
    assert.equal(fields.identity, "unknown");
  });
});

describe("scoreFields — transcription-only fields", () => {
  it("distinguishes a reported value from an absent one", () => {
    const fields = scoreFields(
      certificate({ sterility: "Sterile", endotoxins: { result: NR, units: NR } }),
    );
    assert.equal(fields.sterility, "reported (value shown)");
    assert.equal(fields.endotoxins, "not tested");
  });
});

describe("computeFlags", () => {
  it("raises scope-overreach when purity stands alone", () => {
    const e = certificate({ purity: { percent: 99, method: "RP-HPLC", wavelength: NR } });
    const flags = computeFlags(e, scoreFields(e));
    assert.ok(
      flags.some((f) => f.message.includes("peptide-related impurities only")),
      "expected the scope-overreach flag",
    );
  });

  it("flags a missing identity test exactly once", () => {
    const e = certificate({ purity: { percent: 99, method: NR, wavelength: NR } });
    const flags = computeFlags(e, scoreFields(e));
    const identityFlags = flags.filter((f) => f.message.startsWith("No identity test reported"));
    assert.equal(identityFlags.length, 1);
  });

  it("flags an unnamed issuing laboratory", () => {
    const e = completeCertificate({ issuingLab: NR });
    const flags = computeFlags(e, scoreFields(e));
    assert.ok(flags.some((f) => f.message.includes("issuing laboratory is not named")));
  });

  it("raises no flags for a fully reported certificate", () => {
    const e = completeCertificate();
    assert.deepEqual(computeFlags(e, scoreFields(e)), []);
  });
});

describe("computeVerdict", () => {
  function verdictFor(e: ExtractedCertificate) {
    const fields = scoreFields(e);
    return computeVerdict(e, fields, computeFlags(e, fields));
  }

  it("returns insufficient evidence when almost nothing is reported", () => {
    assert.equal(verdictFor(certificate({ productName: "BPC-157" })), "Insufficient evidence");
  });

  it("returns consistent for a complete, clean certificate", () => {
    assert.equal(verdictFor(completeCertificate()), "Document review — consistent");
  });

  it("returns failed when purity is below the research-grade band", () => {
    const e = completeCertificate({ purity: { percent: 80, method: "RP-HPLC", wavelength: NR } });
    assert.equal(verdictFor(e), "Failed");
  });

  it("returns failed on an identity mismatch", () => {
    const e = completeCertificate({
      productName: "BPC-157",
      sequence: NR,
      identity: { result: "Observed mass matches TB-500", method: "ESI-MS" },
    });
    assert.equal(verdictFor(e), "Failed");
  });

  it("downgrades to concerns when a contaminant test is missing", () => {
    const e = completeCertificate({ sterility: NR });
    assert.equal(verdictFor(e), "Document review — concerns");
  });

  it("prefers Failed over concerns when both apply", () => {
    const e = completeCertificate({
      sterility: NR,
      purity: { percent: 50, method: "RP-HPLC", wavelength: NR },
    });
    assert.equal(verdictFor(e), "Failed");
  });
});

describe("endotoxin interpretation", () => {
  function verdictFor(result: string, units: string) {
    const e = completeCertificate({ endotoxins: { result, units } });
    const fields = scoreFields(e);
    return computeVerdict(e, fields, computeFlags(e, fields));
  }

  it("does not fail an upper-bound result", () => {
    assert.equal(verdictFor("<0.5", "EU/mg"), "Document review — consistent");
    assert.equal(verdictFor("≤ 0.25 EU/mg", "EU/mg"), "Document review — consistent");
  });

  it("does not fail a qualitative pass", () => {
    assert.equal(verdictFor("Pass", "EU/mg"), "Document review — consistent");
    assert.equal(verdictFor("Complies with USP <85>", "EU/mg"), "Document review — consistent");
  });

  it("does not read the standard's number as the result", () => {
    // Regression: the previous parser took the *first* number in the string, so
    // a certificate that cites the standard before the value read "85" out of
    // "USP <85>" and was reported as Failed despite passing at 0.12 EU/mg.
    assert.equal(
      verdictFor("USP <85> limit 0.5 — result 0.12 EU/mg", "EU/mg"),
      "Document review — consistent",
    );
    assert.equal(
      verdictFor("Complies with USP <85>. Result 0.12 EU/mg", "EU/mg"),
      "Document review — consistent",
    );
  });

  it("fails only an egregious reported value", () => {
    assert.equal(verdictFor("12.4", "EU/mg"), "Failed");
  });

  it("ignores a value with no interpretable units", () => {
    assert.equal(verdictFor("12.4", NR), "Document review — consistent");
  });
});

describe("analyze", () => {
  it("returns the extracted input alongside the derived verdict", () => {
    const e = completeCertificate();
    const result = analyze(e);
    assert.equal(result.extracted, e);
    assert.equal(result.verdict, "Document review — consistent");
    assert.equal(result.fieldResults.identity, "pass");
    assert.deepEqual(result.flags, []);
  });

  it("is deterministic for the same input", () => {
    const e = completeCertificate({ sterility: NR });
    assert.deepEqual(analyze(e), analyze(e));
  });
});
