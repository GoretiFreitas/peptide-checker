import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { extractCertificate } from "@/lib/extract-certificate.functions";
import { analyze } from "@/lib/scoring";

export default defineTool({
  name: "check_certificate",
  title: "Check peptide Certificate of Analysis",
  description:
    "Extract fields from a peptide Certificate of Analysis (identity, purity, endotoxins, sterility, contaminants) and return a deterministic verdict, per-field results, and flags. Accepts pasted certificate text.",
  inputSchema: {
    text: z
      .string()
      .min(20)
      .describe("Full text of the certificate as pasted or OCR-extracted."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ text }) => {
    const extracted = await extractCertificate({ data: { text } });
    const { fields, flags, verdict } = analyze(extracted);
    return {
      content: [
        {
          type: "text",
          text: `Verdict: ${verdict}\n\n${JSON.stringify({ extracted, fields, flags }, null, 2)}`,
        },
      ],
      structuredContent: { extracted, fields, flags, verdict },
    };
  },
});
