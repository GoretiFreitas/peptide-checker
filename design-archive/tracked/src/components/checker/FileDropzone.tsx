import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, FileText, X } from "lucide-react";

interface Props {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
}

const MAX = 12 * 1024 * 1024;

export function FileDropzone({ file, onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (f: File | undefined) => {
    if (!f) return;
    setError(null);
    if (f.size > MAX) {
      setError("File exceeds 12MB limit.");
      return;
    }
    const ok = f.type.startsWith("image/") || f.type === "application/pdf";
    if (!ok) {
      setError("Only image or PDF files are accepted.");
      return;
    }
    onFile(f);
  };

  return (
    <div>
      <div className="mb-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-foreground/70">
        Source file upload
      </div>
      <div
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          accept(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`clinical-card flex min-h-[220px] cursor-pointer flex-col items-center justify-center p-6 text-center transition-all ${
          dragOver
            ? "border-[#C59B6D] bg-white scale-[1.01]"
            : "hover:border-[rgba(200,165,125,0.5)]"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        {file ? (
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5EFEB] border border-[rgba(200,165,125,0.3)] text-[#B88B60]">
              <FileText className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="text-sm font-semibold text-foreground max-w-[240px] truncate">
              {file.name}
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFile(null);
                setError(null);
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground shadow-xs"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-[rgba(200,165,125,0.3)] text-[#B88B60] shadow-xs">
              <Upload className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="text-sm font-semibold text-foreground">Select image or PDF</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Drag and drop batch report (Max 12MB)
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => accept(e.target.files?.[0])}
        />
      </div>
      {error && <div className="mt-2 text-xs font-medium text-destructive">{error}</div>}
    </div>
  );
}
