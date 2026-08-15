import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { extractedCertificateSchema, NR, type ExtractedCertificate } from "./certificate-types";

const inputSchema = z.object({
  text: z.string().optional(),
  fileBase64: z.string().optional(),
  fileMime: z.string().optional(),
  fileName: z.string().optional(),
});

const SYSTEM = `You transcribe peptide Certificate of Analysis (CoA) documents.

Your ONLY job is to read the document and copy out what it says. You must not judge, score, grade, or decide whether anything passes, meets a spec, or is safe. Do not infer values that are not written. Do not compute anything.

For every field, if the certificate does not report it, use the EXACT string "not reported". Never write "N/A", "none", "-", or leave a field blank. Use "not reported" verbatim.

Return the fields as structured JSON matching the provided schema.

- productName: the peptide/product name as written.
- sequence: the amino acid sequence if stated (one-letter or three-letter as written), else "not reported".
- identity.result: what the identity/confirmation test reported (e.g. "Observed mass 1234.5 Da, matches theoretical 1234.6"). If absent, "not reported".
- identity.method: the technique named (e.g. "ESI-MS", "MALDI-TOF", "HPLC-MS"). If absent, "not reported".
- purity.percent: the chromatographic purity as a NUMBER only (e.g. 98.7). Null if not reported.
- purity.method: e.g. "RP-HPLC". "not reported" if absent.
- purity.wavelength: detection wavelength as written (e.g. "220 nm"). "not reported" if absent.
- netPeptideContent: verbatim value if stated (e.g. "82.3%"), else "not reported".
- endotoxins.result: verbatim (e.g. "<0.5 EU/mg", "Pass", "0.12"), else "not reported".
- endotoxins.units: verbatim units (e.g. "EU/mg"), else "not reported".
- sterility: verbatim result of any sterility or microbial test (e.g. "Sterile", "TAMC <10 CFU/g"), else "not reported".
- elementalImpurities: verbatim result (e.g. "Complies with ICH Q3D"), else "not reported".
- residualSolvents: verbatim result (e.g. "Complies with ICH Q3C"), else "not reported".
- issuingLab: the laboratory or company name issuing the certificate. "not reported" if unnamed.
- issueDate: as written, else "not reported".
- batchId: batch/lot number as written, else "not reported".
- rawNotes: a very short verbatim quote from the document supporting the most important extracted values, one per line.`;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "file"; data: string; mediaType: string; filename?: string };

const EMPTY: ExtractedCertificate = {
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
};

export const extractCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<ExtractedCertificate> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured.");

    const hasFile = !!(data.fileBase64 && data.fileMime);
    const hasText = !!(data.text && data.text.trim().length > 0);
    if (!hasFile && !hasText) throw new Error("Provide a file or paste certificate text.");

    const content: ContentPart[] = [
      {
        type: "text",
        text: hasFile
          ? "Extract the fields from this Certificate of Analysis. Use 'not reported' verbatim for anything absent."
          : `Extract the fields from this Certificate of Analysis text. Use 'not reported' verbatim for anything absent.\n\n---\n${data.text}`,
      },
    ];

    if (hasFile) {
      const dataUrl = `data:${data.fileMime};base64,${data.fileBase64}`;
      if (data.fileMime!.startsWith("image/")) {
        content.push({ type: "image", image: dataUrl });
      } else {
        content.push({
          type: "file",
          data: dataUrl,
          mediaType: data.fileMime!,
          filename: data.fileName || "certificate.pdf",
        });
      }
    }

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    try {
      const { output } = await generateText({
        model,
        system: SYSTEM,
        messages: [{ role: "user", content }],
        output: Output.object({ schema: extractedCertificateSchema }),
      });
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.error("Structured extraction failed:", error.text);
        try {
          const parsed = JSON.parse(error.text ?? "{}");
          return extractedCertificateSchema.parse({ ...EMPTY, ...parsed });
        } catch {
          return EMPTY;
        }
      }
      const err = error as { statusCode?: number; message?: string };
      if (err.statusCode === 429) {
        throw new Error("Rate limit reached. Please wait a moment and try again.");
      }
      if (err.statusCode === 402) {
        throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      }
      console.error(error);
      throw new Error(err.message ?? "Extraction failed.");
    }
  });
