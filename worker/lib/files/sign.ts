// HMAC-SHA256 signed URLs for /api/files/raw. The signed message is
// "<bucket>/<path>:<exp>" where exp is a unix timestamp in seconds.
import { HttpError } from "../http";
import { MAX_SIGNED_URL_SECONDS, DEFAULT_SIGNED_URL_SECONDS, type Bucket } from "./config";
import { encodePath } from "./paths";

const MIN_SECRET_LENGTH = 32;
const encoder = new TextEncoder();
let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function hmacKey(secret: string | undefined): Promise<CryptoKey> {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new HttpError(500, "File links are not configured yet.", "files_not_configured");
  }
  if (cachedKey?.secret !== secret) {
    const key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    cachedKey = { secret, key };
  }
  return cachedKey.key;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signature(secret: string | undefined, bucket: Bucket, path: string, exp: number): Promise<string> {
  const key = await hmacKey(secret);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${bucket}/${path}:${exp}`)));
}

export function timingSafeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function clampExpiresIn(raw: unknown): number {
  const n = raw === undefined || raw === null ? DEFAULT_SIGNED_URL_SECONDS : Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, "expiresIn must be a positive number of seconds", "invalid_expires");
  return Math.min(Math.floor(n) || 1, MAX_SIGNED_URL_SECONDS);
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function createSignedUrl(
  secret: string | undefined,
  bucket: Bucket,
  path: string,
  expiresIn: number,
  now = nowSeconds(),
): Promise<{ signedUrl: string; exp: number }> {
  const exp = now + expiresIn;
  const sig = await signature(secret, bucket, path, exp);
  return { signedUrl: `/api/files/raw/${bucket}/${encodePath(path)}?exp=${exp}&sig=${sig}`, exp };
}

// Returns the seconds remaining on a valid link, or throws 403.
export async function verifySignedUrl(
  secret: string | undefined,
  bucket: Bucket,
  path: string,
  expRaw: string | undefined,
  sigRaw: string | undefined,
  now = nowSeconds(),
): Promise<number> {
  const exp = Number(expRaw);
  const invalid = new HttpError(403, "This file link is invalid or has expired.", "invalid_signature");
  if (!expRaw || !/^\d{1,12}$/.test(expRaw) || !sigRaw || !/^[0-9a-f]{64}$/.test(sigRaw)) throw invalid;
  const expected = await signature(secret, bucket, path, exp);
  if (!timingSafeEqual(expected, sigRaw)) throw invalid;
  if (exp <= now || exp > now + MAX_SIGNED_URL_SECONDS + 60) throw invalid;
  return exp - now;
}
