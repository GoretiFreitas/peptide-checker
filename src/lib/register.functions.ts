import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

let _publicSupabase: SupabaseClient<Database> | undefined;

function publicSupabase(): SupabaseClient<Database> {
  if (!_publicSupabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase public credentials not configured");
    }
    _publicSupabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
  }
  return _publicSupabase;
}

const hashRe = /^[a-f0-9]{64}$/i;

export const registerCertificate = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
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
    // The register is append-only and world-readable, so writes are the abuse
    // surface: duplicate batch ids are surfaced on /verify as a red flag.
    const { callerIp, enforceRateLimit, optionalUserId } = await import("@/lib/rate-limit.server");
    const userId = await optionalUserId();
    await enforceRateLimit(
      userId
        ? {
            name: "register-certificate:user",
            key: userId,
            limit: 40,
            windowSeconds: 3600,
            message: "You have reached the hourly limit for register submissions.",
          }
        : {
            name: "register-certificate:ip",
            key: callerIp(),
            limit: 8,
            windowSeconds: 3600,
            message: "Too many register submissions from this network. Try again later.",
          },
    );

    const existing = await findRegisterEntry(data.sha256, data.normalized_sha256 ?? null);
    if (existing) return bumpAndReturn(existing);

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

    if (error) {
      // 23505: a concurrent submission of the same certificate won the race.
      // Treat it as the repeat sighting it is instead of failing the check.
      if ((error as { code?: string }).code === "23505") {
        const raced = await findRegisterEntry(data.sha256, data.normalized_sha256 ?? null);
        if (raced) return bumpAndReturn(raced);
      }
      throw new Error(error.message);
    }
    return { entry: row, status: "newly_registered" as const };
  });

/**
 * Match on either hash. The same certificate pasted with different whitespace
 * has a different raw hash but an identical normalized hash — registering it
 * twice under one batch id would make /verify report a conflict against itself.
 */
async function findRegisterEntry(sha256: string, normalized: string | null) {
  const sb = publicSupabase();
  const filters = [`sha256.eq.${sha256}`];
  if (normalized) {
    filters.push(`normalized_sha256.eq.${normalized}`, `sha256.eq.${normalized}`);
  }
  const { data } = await sb
    .from("certificate_register")
    .select("*")
    .or(filters.join(","))
    .order("first_seen_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function bumpAndReturn(entry: unknown) {
  const row = entry as { id: string; seen_count?: number };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: seen, error } = await (supabaseAdmin as any).rpc("bump_certificate_sighting", {
    p_id: row.id,
  });
  if (error) console.error("[register] could not bump sighting", error.message);
  return {
    entry: { ...row, seen_count: Number(seen ?? row.seen_count ?? 1) },
    status: "already_registered" as const,
  };
}

export const lookupRegister = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
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
