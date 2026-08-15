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
      <div className="mb-3 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
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
        className={`flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-foreground/40 bg-card"
            : "border-border bg-card/50 hover:border-foreground/30"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-sm text-foreground">{file.name}</div>
            <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFile(null);
                setError(null);
              }}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          </div>
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <div className="text-sm text-foreground">Select image or PDF</div>
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
      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}
