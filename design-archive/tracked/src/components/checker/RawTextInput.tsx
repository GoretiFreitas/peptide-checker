interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function RawTextInput({ value, onChange, disabled }: Props) {
  return (
    <div>
      <div className="mb-2.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-foreground/70">
        Raw certificate text
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste the sequence text, batch number, or spectral data analysis here…"
        className="clinical-card min-h-[220px] w-full resize-none p-5 font-mono text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-[#C59B6D] focus:outline-none focus:ring-2 focus:ring-[#C59B6D]/20 disabled:opacity-60"
      />
    </div>
  );
}
