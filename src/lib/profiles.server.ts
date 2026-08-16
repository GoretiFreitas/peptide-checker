import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CampaignBacker = {
  id: string;
  created_at: string;
  amount_cents: number;
  hide_amount: boolean;
  display_mode: "handle" | "initials" | "anonymous";
  handle: string | null;
  initials: string | null;
};

/**
 * Map user_id -> profile handle. Done as a separate query because PostgREST has
 * no foreign-key relationship between `pledges` and `profiles` (both point at
 * auth.users), so an embedded select fails with PGRST200.
 */
export async function fetchProfileHandles(
  userIds: Array<string | null | undefined>,
): Promise<Record<string, string | null>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return {};
  const { data } = await (supabaseAdmin as any).from("profiles").select("id, handle").in("id", ids);
  const map: Record<string, string | null> = {};
  for (const row of (data as any[]) ?? []) map[row.id] = row.handle ?? null;
  return map;
}

export async function listCampaignBackers(itemId: string): Promise<CampaignBacker[]> {
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("pledges")
    .select(
      "id, amount_cents, created_at, user_id, x_handle, display_mode, hide_amount, display_initials",
    )
    .eq("item_id", itemId)
    .in("status", ["paid", "captured", "authorized"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) console.error("[backers] query failed", error.message);

  const list = (rows as any[]) ?? [];
  const handles = await fetchProfileHandles(list.map((r) => r.user_id));

  return list.map((r) => {
    const mode = (r.display_mode ?? "initials") as CampaignBacker["display_mode"];
    const xHandle = typeof r.x_handle === "string" ? r.x_handle.trim() : null;
    const profileHandle = handles[r.user_id] ?? null;
    const custom = typeof r.display_initials === "string" ? r.display_initials.trim() : "";
    const initials = (custom || profileHandle?.[0] || "?").toUpperCase();
    return {
      id: r.id as string,
      created_at: r.created_at as string,
      amount_cents: Number(r.amount_cents ?? 0),
      hide_amount: !!r.hide_amount,
      display_mode: mode,
      handle: mode === "handle" && xHandle ? xHandle : null,
      initials: mode === "initials" ? initials : null,
    };
  });
}

