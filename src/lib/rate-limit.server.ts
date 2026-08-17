import { getRequest } from "@tanstack/react-start/server";

/**
 * Best-effort caller identity for rate limiting. Behind the Lovable/Cloudflare
 * edge the client address arrives in a forwarded header; `unknown` is a shared
 * bucket, which is the conservative outcome.
 */
export function callerIp(): string {
  const headers = getRequest()?.headers;
  if (!headers) return "unknown";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "unknown";
}

/**
 * Resolve the signed-in user without requiring one. Used to give authenticated
 * callers a larger budget than anonymous ones on otherwise-public endpoints.
 */
export async function optionalUserId(): Promise<string | null> {
  try {
    const headers = getRequest()?.headers;
    const authHeader = headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice("Bearer ".length);
    if (token.split(".").length !== 3) return null;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return String(data.claims.sub);
  } catch {
    return null;
  }
}

export interface RateLimitOptions {
  /** Namespace, so two endpoints never share a bucket. */
  name: string;
  /** Caller identity within the namespace (user id or IP). */
  key: string;
  limit: number;
  windowSeconds: number;
  message: string;
}

/**
 * Fixed-window limiter backed by `public.consume_rate_limit`.
 *
 * Fails OPEN: if the limiter itself errors (migration not yet applied, database
 * unreachable) we log and allow the call rather than taking the public tool
 * offline. The limiter is abuse control, not an authorization boundary.
 */
export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { rpc: RpcFn };
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: `${options.name}:${options.key}`,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });

    if (error) {
      console.error("[rate-limit] limiter unavailable, allowing call", error.message);
      return;
    }
    if (data === false) throw new RateLimitError(options.message);
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    console.error("[rate-limit] limiter threw, allowing call", error);
  }
}

export class RateLimitError extends Error {
  readonly statusCode = 429;
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

type RpcFn = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
