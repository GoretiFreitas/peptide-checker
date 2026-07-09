import type { FieldStatus, Verdict } from "@/lib/certificate-types";

const STATUS_STYLES: Record<FieldStatus, string> = {
  pass: "bg-[--badge-ok-bg] text-[--badge-ok-fg]",
  "pass (premium)": "bg-[--badge-ok-bg] text-[--badge-ok-fg]",
  "pass (research grade)": "bg-[--badge-ok-bg] text-[--badge-ok-fg]",
  fail: "bg-[--badge-fail-bg] text-[--badge-fail-fg]",
  unknown: "bg-[--badge-neutral-bg] text-[--badge-neutral-fg]",
  "reported (value shown)": "bg-[--badge-ok-bg] text-[--badge-ok-fg]",
  "not tested": "bg-[--badge-warn-bg] text-[--badge-warn-fg]",
};

export function StatusBadge({ status }: { status: FieldStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

const VERDICT_STYLES: Record<Verdict, string> = {
  "Document review — consistent": "bg-[--badge-ok-bg] text-[--badge-ok-fg]",
  "Document review — concerns": "bg-[--badge-warn-bg] text-[--badge-warn-fg]",
  Failed: "bg-[--badge-fail-bg] text-[--badge-fail-fg]",
  "Insufficient evidence": "bg-[--badge-neutral-bg] text-[--badge-neutral-fg]",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-3 py-1 text-sm font-medium ${VERDICT_STYLES[verdict]}`}
    >
      {verdict}
    </span>
  );
}
