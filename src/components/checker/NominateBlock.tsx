import { useState } from "react";

interface Nomination {
  productName: string;
  at: string;
}

const KEY = "certificate-checker.nominations";

export function NominateBlock({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!name.trim()) return;
    try {
      const raw = localStorage.getItem(KEY);
      const list: Nomination[] = raw ? JSON.parse(raw) : [];
      list.push({ productName: name.trim(), at: new Date().toISOString() });
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-sm border border-border bg-background/60 p-3 text-sm text-foreground">
        Thank you. Your nomination has been recorded locally and will be considered for the
        independent testing queue.
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border bg-background/60 p-3">
      <label className="mb-2 block text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
        Product name
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Semaglutide 5mg"
          className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/40 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="rounded-sm bg-foreground px-4 py-2 text-xs font-medium tracking-wide text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit nomination
        </button>
      </div>
    </div>
  );
}
