// WebCrypto-only primitives for auth. No JS hashing libraries: on the Workers
// free plan (10 ms CPU) only native crypto.subtle is fast enough (sow.md R1).

export const DEFAULT_PBKDF2_ITERATIONS = 100_000; // Workers' PBKDF2 maximum
const MIN_PBKDF2_ITERATIONS = 10_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const TOKEN_BYTES = 32;

const encoder = new TextEncoder();

export function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 32 random bytes, base64url (43 chars). Used for session and email tokens. */
export function randomToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  let hex = "";
  for (const b of digest) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Constant-time comparison: always walks the full length of `a`. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ (b[i] ?? 0);
  return diff === 0;
}

export function resolveIterations(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return DEFAULT_PBKDF2_ITERATIONS;
  return Math.min(DEFAULT_PBKDF2_ITERATIONS, Math.max(MIN_PBKDF2_ITERATIONS, n));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, HASH_BITS);
  return new Uint8Array(bits);
}

export interface PasswordHash {
  hash: string; // base64url
  salt: string; // base64url
  iterations: number;
}

export async function hashPassword(password: string, iterations: number): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, iterations);
  return { hash: bytesToBase64Url(hash), salt: bytesToBase64Url(salt), iterations };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const expected = base64UrlToBytes(stored.hash);
  const actual = await derive(password, base64UrlToBytes(stored.salt), stored.iterations);
  return timingSafeEqual(actual, expected);
}

/**
 * Burns the same CPU as a real verification so that "no such user" and
 * "wrong password" take the same time (no account-existence timing oracle).
 */
export async function dummyVerify(password: string, iterations: number): Promise<false> {
  await derive(password, new Uint8Array(SALT_BYTES), iterations);
  return false;
}
