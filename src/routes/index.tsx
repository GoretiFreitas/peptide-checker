import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { extractCertificate } from "@/lib/extract-certificate.functions";
import { analyze } from "@/lib/scoring";
import { FileDropzone } from "@/components/checker/FileDropzone";
import { RawTextInput } from "@/components/checker/RawTextInput";
import { ResultsPanel } from "@/components/checker/ResultsPanel";
import type { AnalysisResult } from "@/lib/certificate-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Certificate Checker" },
      {
        name: "description",
        content:
          "Read a peptide Certificate of Analysis and see, field by field, what the document actually reports — and what it does not.",
      },
      { property: "og:title", content: "Certificate Checker" },
      {
        property: "og:description",
        content:
          "Read a peptide Certificate of Analysis and see, field by field, what the document actually reports — and what it does not.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: async (): Promise<AnalysisResult> => {
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
      return analyze(extracted);
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
    if (mutation.data) return { kind: "ok", result: mutation.data };
    return { kind: "idle" };
  }, [mutation.isPending, mutation.isError, mutation.error, mutation.data]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-10 md:grid-cols-[320px_1fr] md:gap-12 md:px-10 md:py-14">
        <aside className="flex flex-col justify-between md:sticky md:top-10 md:h-[calc(100vh-5rem)]">
          <div>
            <div className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
              Document review
            </div>
            <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight text-foreground md:text-5xl">
              Certificate Checker.
            </h1>
            <p className="mt-6 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
              Read a peptide Certificate of Analysis and see, field by field, what the document
              actually reports — and what it does not.
            </p>
            <div className="mt-8 h-px w-16 bg-border" />
          </div>

          <div className="mt-10 space-y-4">
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit}
              className="w-full rounded-sm bg-foreground/90 py-3 text-[11px] font-medium tracking-[0.22em] uppercase text-background transition-colors hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {mutation.isPending ? "Checking…" : "Check certificate"}
            </button>
            <div className="text-center text-[10px] leading-relaxed tracking-[0.12em] uppercase text-muted-foreground">
              Document-only review
              <br />
              No login · no personal data stored
            </div>
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
    </div>
  );
}
