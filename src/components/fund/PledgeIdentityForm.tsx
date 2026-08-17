import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPledgeIdentity, updatePledgeIdentity } from "@/lib/board.functions";
import { useServerFn } from "@tanstack/react-start";

export function PledgeIdentityForm({ pledgeId }: { pledgeId: string }) {
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updatePledgeIdentity);
  const loadFn = useServerFn(getPledgeIdentity);

  const identity = useQuery({
    queryKey: ["pledge-identity", pledgeId],
    queryFn: () => loadFn({ data: { pledge_id: pledgeId } }),
  });

  const [handle, setHandle] = useState("");
  const [initials, setInitials] = useState("");
  const [mode, setMode] = useState<"handle" | "initials" | "anonymous">("initials");
  const [hideAmount, setHideAmount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const d = identity.data;
    if (!d) return;
    setHandle(d.x_handle ?? "");
    setInitials(d.display_initials ?? "");
    setMode((d.display_mode as any) ?? "initials");
    setHideAmount(!!d.hide_amount);
  }, [identity.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      setSaved(false);
      return updateFn({
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
      queryClient.invalidateQueries({ queryKey: ["my-pledges"] });
      queryClient.invalidateQueries({ queryKey: ["pledge-identity", pledgeId] });
    },
    onError: (e: any) => setError(e?.message ?? "Could not update"),
  });

  const handleInput = (value: string) => {
    setSaved(false);
    setHandle(value.replace(/^@/, "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15));
  };

  return (
    <div className="mt-6 rounded-sm border border-border bg-card p-6">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
        Your public backer identity
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose how you appear on this campaign&apos;s backer list. You can change this later while
        signed in.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          {[
            { value: "initials", label: "Show initials only" },
            { value: "handle", label: "Show my X username" },
            { value: "anonymous", label: "Anonymous" },
          ].map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name={`display-${pledgeId}`}
                value={opt.value}
                checked={mode === opt.value}
                onChange={() => {
                  setSaved(false);
                  setMode(opt.value as any);
                }}
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
              onChange={(e) => {
                setSaved(false);
                setInitials(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase());
              }}
              placeholder="e.g. MF"
              maxLength={3}
              className="mt-1 w-28 rounded-sm border border-border bg-background px-3 py-2 text-sm focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              1–3 letters or numbers. Leave blank to use your account initial.
            </p>
          </div>
        )}

        {mode === "handle" && (
          <div>
            <label className="block text-[11px] tracking-[0.14em] uppercase text-muted-foreground">
              X username (shown on this campaign&apos;s backer list)
            </label>
            <div className="mt-1 flex items-center rounded-sm border border-border bg-background px-3">
              <span className="text-sm text-muted-foreground">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="username"
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
            onChange={(e) => {
              setSaved(false);
              setHideAmount(e.target.checked);
            }}
            className="h-4 w-4"
          />
          Hide my amount on the backer list
        </label>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {saved && !error && (
          <div className="text-sm text-muted-foreground">Saved — your backer list entry is updated.</div>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || identity.isLoading}
          className="rounded-sm bg-foreground px-4 py-2.5 text-[11px] font-medium tracking-[0.22em] uppercase text-background disabled:opacity-40"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
