export type FundingTotal = {
  item_id: string;
  pledged_cents: number;
  backer_count: number;
};

/**
 * Funding totals are aggregated server-side from `pledges` using the admin
 * client. Only anonymized aggregates (sum + count) leave the server, so no
 * pledge rows are exposed and no RLS-bypassing database view is required.
 */
export async function computeFundingTotals(itemId?: string): Promise<FundingTotal[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = (supabaseAdmin as any)
    .from("pledges")
    .select("item_id, amount_cents, status")
    .in("status", ["paid", "authorized", "captured"]);
  if (itemId) query = query.eq("item_id", itemId);
  const { data } = await query;
  const map = new Map<string, FundingTotal>();
  for (const row of ((data as any[]) ?? [])) {
    const t = map.get(row.item_id) ?? { item_id: row.item_id, pledged_cents: 0, backer_count: 0 };
    t.pledged_cents += Number(row.amount_cents ?? 0);
    t.backer_count += 1;
    map.set(row.item_id, t);
  }
  return [...map.values()];
}
