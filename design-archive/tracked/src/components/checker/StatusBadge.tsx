import type { FieldStatus, Verdict } from "@/lib/certificate-types";

const STATUS_STYLES: Record<FieldStatus, string> = {
  pass: "bg-[--badge-ok-bg] text-[--badge-ok-fg] border border-[--badge-ok-fg]/20",
  "pass (premium)":
    "bg-[--badge-ok-bg] text-[--badge-ok-fg] border border-[--badge-ok-fg]/20 font-semibold",
  "pass (research grade)":
    "bg-[--badge-ok-bg] text-[--badge-ok-fg] border border-[--badge-ok-fg]/20",
  fail: "bg-[--badge-fail-bg] text-[--badge-fail-fg] border border-[--badge-fail-fg]/25 font-semibold",
  unknown:
    "bg-[--badge-neutral-bg] text-[--badge-neutral-fg] border border-[--badge-neutral-fg]/20",
  "reported (value shown)":
    "bg-[--badge-ok-bg] text-[--badge-ok-fg] border border-[--badge-ok-fg]/20",
  "not tested":
    "bg-[--badge-warn-bg] text-[--badge-warn-fg] border border-[--badge-warn-fg]/25 font-medium",
};

export function StatusBadge({ status }: { status: FieldStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide shadow-2xs ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

const VERDICT_STYLES: Record<Verdict, string> = {
  "Document review — consistent":
    "bg-[--badge-ok-bg] text-[--badge-ok-fg] border border-[--badge-ok-fg]/30 shadow-xs",
  "Document review — concerns":
    "bg-[--badge-warn-bg] text-[--badge-warn-fg] border border-[--badge-warn-fg]/35 shadow-xs",
  Failed:
    "bg-[--badge-fail-bg] text-[--badge-fail-fg] border border-[--badge-fail-fg]/35 shadow-xs",
  "Insufficient evidence":
    "bg-[--badge-neutral-bg] text-[--badge-neutral-fg] border border-[--badge-neutral-fg]/30 shadow-xs",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide ${VERDICT_STYLES[verdict]}`}
    >
      {verdict}
    </span>
  );
}
