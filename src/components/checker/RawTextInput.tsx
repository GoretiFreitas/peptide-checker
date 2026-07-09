interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function RawTextInput({ value, onChange, disabled }: Props) {
  return (
    <div>
      <div className="mb-3 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
        Raw certificate text
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste the sequence text, batch number, or spectral data analysis here…"
        className="min-h-[220px] w-full resize-none rounded-md border border-dashed border-border bg-card/50 p-4 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none disabled:opacity-60"
      />
    </div>
  );
}
