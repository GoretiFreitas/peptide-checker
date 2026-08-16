import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePledgeIdentity } from "@/lib/board.functions";
import { useServerFn } from "@tanstack/react-start";

export type PledgeIdentityDraft = {
  x_handle: string | null;
  display_initials: string | null;
  display_mode: "handle" | "initials" | "anonymous";
  hide_amount: boolean;
};

export function PledgeIdentityForm({
  pledgeId,
  draftKey,
  initial,
}: {
  /** Null before the contribution exists — the choice is saved as a draft and applied after payment. */
  pledgeId: string | null;
  draftKey?: string;
  initial?: {
    x_handle?: string | null;
    display_initials?: string | null;
    display_mode?: "handle" | "initials" | "anonymous";
    hide_amount?: boolean;
  };
}) {

  const queryClient = useQueryClient();
  const updateFn = useServerFn(updatePledgeIdentity);
  const [handle, setHandle] = useState(initial?.x_handle ?? "");
  const [initials, setInitials] = useState(initial?.display_initials ?? "");
  const [mode, setMode] = useState<"handle" | "initials" | "anonymous">(
    initial?.display_mode ?? "initials",
  );
  const [hideAmount, setHideAmount] = useState(initial?.hide_amount ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Sync when the saved identity arrives after first render.
  useEffect(() => {
    if (!initial) return;
    setHandle(initial.x_handle ?? "");
    setInitials(initial.display_initials ?? "");
    setMode(initial.display_mode ?? "initials");
    setHideAmount(initial.hide_amount ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial?.x_handle,
    initial?.display_initials,
    initial?.display_mode,
    initial?.hide_amount,
    pledgeId,
  ]);

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setSaved(false);
      if (mode === "handle" && handle.trim().length === 0) {
        throw new Error("Enter your X handle or pick another option");
      }
      if (!pledgeId) {
        // No contribution yet — keep the choice locally and apply it once payment confirms.
        if (draftKey && typeof window !== "undefined") {
          const draft: PledgeIdentityDraft = {
            x_handle: handle || null,
            display_initials: initials || null,
            display_mode: mode,
            hide_amount: hideAmount,
          };
          window.localStorage.setItem(draftKey, JSON.stringify(draft));
        }
        return null;
      }
      return await updateFn({
        data: {
          pledge_id: pledgeId,
          x_handle: handle || "",
          display_initials: initials || "",
          display_mode: mode,
          hide_amount: hideAmount,
        },
      });
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["item"] });
      queryClient.invalidateQueries({ queryKey: ["backers"] });
      queryClient.invalidateQueries({ queryKey: ["my-pledges"] });
      queryClient.invalidateQueries({ queryKey: ["pledge-identity"] });
    },
    onError: (e: any) => setError(e?.message ?? "Could not update"),
  });


  const handleInput = (value: string) => {
    setHandle(
      value
        .replace(/^@/, "")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 15),
    );
  };

  return (
    <div className="mt-6 rounded-sm border border-border bg-card p-6">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
        Your public backer identity
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {pledgeId
          ? "Choose how you appear on this campaign's backer list. You can change this later while signed in."
          : "Choose how you appear on this campaign's backer list. We'll apply it to your contribution right after payment, and you can change it any time."}
      </p>


      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          {[
            { value: "initials", label: "Show initials only" },
            { value: "handle", label: "Show my X handle" },
            { value: "anonymous", label: "Anonymous" },
          ].map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={`display-${pledgeId}`}
                value={opt.value}
                checked={mode === opt.value}
                onChange={() => setMode(opt.value as any)}
                className="h-4 w-4"
              />
              {opt.label}
            </label>
          ))}
        </div>

        {mode === "initials" && (
          <div>
            <label className="block text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              Initials shown on the backer list
            </label>
            <input
              type="text"
              value={initials}
              onChange={(e) =>
                setInitials(
                  e.target.value
                    .replace(/[^a-zA-Z0-9]/g, "")
                    .slice(0, 3)
                    .toUpperCase(),
                )
              }
              placeholder="AB"
              maxLength={3}
              className="mt-1 w-24 rounded-sm border border-border bg-background px-3 py-2 text-sm focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Up to 3 letters or numbers. Leave empty to use your account initial.
            </p>
          </div>
        )}

        {mode === "handle" && (
          <div>
            <label className="block text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              X handle (shown on this campaign&apos;s backer list)
            </label>
            <div className="mt-1 flex items-center rounded-sm border border-border bg-background px-3">
              <span className="text-sm text-muted-foreground">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="handle"
                maxLength={15}
                className="ml-1 w-full bg-transparent py-2 text-sm focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Self-reported and unverified. 1–15 letters, numbers or underscores.
            </p>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideAmount}
            onChange={(e) => setHideAmount(e.target.checked)}
            className="h-4 w-4"
          />
          Hide my amount on the backer list
        </label>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {saved && !error && (
          <div className="text-sm text-muted-foreground">Saved — your backer list entry updated.</div>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-sm bg-foreground px-4 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-background disabled:opacity-40"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
