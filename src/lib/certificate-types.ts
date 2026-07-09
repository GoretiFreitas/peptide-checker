import { z } from "zod";

export const NR = "not reported" as const;

export const extractedCertificateSchema = z.object({
  productName: z.string(),
  sequence: z.string(),
  identity: z.object({
    result: z.string(),
    method: z.string(),
  }),
  purity: z.object({
    percent: z.number().nullable(),
    method: z.string(),
    wavelength: z.string(),
  }),
  netPeptideContent: z.string(),
  endotoxins: z.object({
    result: z.string(),
    units: z.string(),
  }),
  sterility: z.string(),
  elementalImpurities: z.string(),
  residualSolvents: z.string(),
  issuingLab: z.string(),
  issueDate: z.string(),
  batchId: z.string(),
  rawNotes: z.string(),
});

export type ExtractedCertificate = z.infer<typeof extractedCertificateSchema>;

export type FieldStatus =
  | "pass"
  | "pass (premium)"
  | "pass (research grade)"
  | "fail"
  | "unknown"
  | "reported (value shown)"
  | "not tested";

export interface FieldResults {
  identity: FieldStatus;
  purity: FieldStatus;
  netPeptideContent: FieldStatus;
  endotoxins: FieldStatus;
  sterility: FieldStatus;
  elementalImpurities: FieldStatus;
  residualSolvents: FieldStatus;
}

export interface Flag {
  level: "high" | "medium" | "low";
  message: string;
}

export type Verdict =
  | "Document review — consistent"
  | "Document review — concerns"
  | "Failed"
  | "Insufficient evidence";

export interface AnalysisResult {
  extracted: ExtractedCertificate;
  fieldResults: FieldResults;
  flags: Flag[];
  verdict: Verdict;
}
