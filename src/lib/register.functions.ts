import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicSupabase() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

const hashRe = /^[a-f0-9]{64}$/i;

export const registerCertificate = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        sha256: z.string().regex(hashRe),
        normalized_sha256: z.string().regex(hashRe).optional().nullable(),
        batch_id: z.string().max(200).optional().nullable(),
        product_name: z.string().max(200).optional().nullable(),
        sequence: z.string().max(2000).optional().nullable(),
        purity_percent: z.number().optional().nullable(),
        issuing_lab: z.string().max(200).optional().nullable(),
        issue_date: z.string().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    const { data: existing } = await sb
      .from("certificate_register")
      .select("*")
      .eq("sha256", data.sha256)
      .maybeSingle();

    if (existing) {
      // Bump seen_count via server role (bookkeeping-only fields allowed by trigger).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any)
        .from("certificate_register")
        .update({
          seen_count: (existing as any).seen_count + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", (existing as any).id);
      return { entry: existing, status: "already_registered" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("certificate_register")
      .insert({
        sha256: data.sha256,
        normalized_sha256: data.normalized_sha256 ?? null,
        batch_id: data.batch_id ?? null,
        product_name: data.product_name ?? null,
        sequence: data.sequence ?? null,
        purity_percent: data.purity_percent ?? null,
        issuing_lab: data.issuing_lab ?? null,
        issue_date: data.issue_date ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry: row, status: "newly_registered" as const };
  });

export const lookupRegister = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        query: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    const q = data.query.trim();
    const isHash = hashRe.test(q);

    if (isHash) {
      const lower = q.toLowerCase();
      const { data: byHash } = await sb
        .from("certificate_register")
        .select("*")
        .or(`sha256.eq.${lower},normalized_sha256.eq.${lower}`)
        .limit(1)
        .maybeSingle();
      if (byHash) return { result: "registered" as const, entry: byHash, matches: [byHash] };
      return { result: "not_found" as const, entry: null, matches: [] };
    }

    // Batch id lookup
    const { data: rows } = await sb
      .from("certificate_register")
      .select("*")
      .eq("batch_id", q)
      .order("first_seen_at", { ascending: true });

    const matches = rows ?? [];
    if (matches.length === 0) return { result: "not_found" as const, entry: null, matches: [] };
    if (matches.length === 1) return { result: "registered" as const, entry: matches[0], matches };
    return { result: "conflict" as const, entry: matches[0], matches };
  });
