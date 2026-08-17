import Stripe from "stripe";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

let _resolvedEnv: StripeEnv | undefined;

/**
 * The payments environment is a property of the *deployment*, never of the
 * request. It must never be taken from the client: a caller who can choose
 * "sandbox" can pay with a test card and still be granted the real entitlement.
 *
 * Resolution order:
 *   1. PAYMENTS_ENVIRONMENT ("live" | "sandbox") — explicit wins.
 *   2. The publishable client token prefix (pk_live_ / pk_test_).
 *   3. Whichever secret key is configured, when exactly one of the two is.
 */
export function resolvePaymentsEnv(): StripeEnv {
  if (_resolvedEnv) return _resolvedEnv;

  const explicit = process.env.PAYMENTS_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === "live" || explicit === "sandbox") {
    _resolvedEnv = explicit;
    return _resolvedEnv;
  }

  const token = process.env.VITE_PAYMENTS_CLIENT_TOKEN?.trim();
  if (token?.startsWith("pk_live_")) {
    _resolvedEnv = "live";
    return _resolvedEnv;
  }
  if (token?.startsWith("pk_test_")) {
    _resolvedEnv = "sandbox";
    return _resolvedEnv;
  }

  const hasLive = !!process.env.STRIPE_LIVE_API_KEY;
  const hasSandbox = !!process.env.STRIPE_SANDBOX_API_KEY;
  if (hasLive !== hasSandbox) {
    _resolvedEnv = hasLive ? "live" : "sandbox";
    return _resolvedEnv;
  }

  throw new Error(
    "Payments environment is ambiguous. Set PAYMENTS_ENVIRONMENT to 'live' or 'sandbox'.",
  );
}

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox" ? getEnv("STRIPE_SANDBOX_API_KEY") : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-03-25.dahlia",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            ).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const s = error as {
      message?: string;
      raw?: { message?: string };
    };
    return s.raw?.message ?? s.message ?? "Stripe request failed";
  }
  return "Stripe request failed";
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

/** Length-independent constant-time string compare. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ id: string; type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  // Buffer is not available on every worker runtime — hex-encode manually.
  const expected = toHex(signed);
  if (!v1Signatures.some((candidate) => timingSafeEqual(candidate, expected))) {
    throw new Error("Invalid webhook signature");
  }

  const event = JSON.parse(body) as { id?: string; type?: string; data?: { object: any } };
  if (!event?.id || !event.type) throw new Error("Malformed webhook payload");
  return event as { id: string; type: string; data: { object: any } };
}
