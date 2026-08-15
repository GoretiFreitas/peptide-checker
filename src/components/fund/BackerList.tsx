import { useMemo } from "react";

export type Backer = {
  id: string;
  created_at: string;
  amount_cents: number;
  hide_amount: boolean;
  display_mode: "handle" | "initials" | "anonymous";
  handle: string | null;
  initials: string | null;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function dateLabel(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function initialsAvatar(seed: string) {
  const colors = ["#3B5A72", "#5E4B3A", "#2E5A4F", "#6B4C5A", "#4A5568"];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const color = colors[Math.abs(hash) % colors.length];
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {seed.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function BackerList({ backers }: { backers: Backer[] }) {
  const visible = useMemo(() => backers.filter((b) => b.display_mode !== "anonymous"), [backers]);
  const anonymousCount = backers.length - visible.length;

  if (backers.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-card p-6">
        <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Backers</div>
        <p className="mt-2 text-sm text-muted-foreground">No contributions yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">Backers</div>
        {anonymousCount > 0 && (
          <div className="text-[11px] text-muted-foreground">{anonymousCount} anonymous</div>
        )}
      </div>
      <ul className="mt-4 space-y-3">
        {visible.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-3">
              {b.display_mode === "handle" && b.handle ? (
                <>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-medium text-foreground">
                    @
                  </span>
                  <a
                    href={`https://x.com/${b.handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground hover:underline"
                  >
                    @{b.handle}
                  </a>
                </>
              ) : (
                <>
                  {initialsAvatar(b.initials ?? "?")}
                  <span className="text-muted-foreground">{b.initials ?? "?"}</span>
                </>
              )}
            </div>
            <div className="text-right">
              <div className="text-foreground">{b.hide_amount ? "—" : money(b.amount_cents)}</div>
              <div className="text-[11px] text-muted-foreground">{dateLabel(b.created_at)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
