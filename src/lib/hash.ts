// Client-side SHA-256 helpers for the Authenticity Register.

function toHex(buffer: ArrayBuffer): string {
  const b = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < b.length; i++) hex += b[i].toString(16).padStart(2, "0");
  return hex;
}

export async function sha256Hex(input: ArrayBuffer | Uint8Array | string): Promise<string> {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  // Copy into a fresh ArrayBuffer to satisfy strict BufferSource typing.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return toHex(digest);
}

export function normalizeText(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256Hex(buf);
}

export async function hashText(t: string): Promise<{ raw: string; normalized: string }> {
  const raw = await sha256Hex(t);
  const normalized = await sha256Hex(normalizeText(t));
  return { raw, normalized };
}
