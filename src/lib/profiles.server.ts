import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  const { data } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, handle")
    .in("id", ids);
  const map: Record<string, string | null> = {};
  for (const row of ((data as any[]) ?? [])) map[row.id] = row.handle ?? null;
  return map;
}
