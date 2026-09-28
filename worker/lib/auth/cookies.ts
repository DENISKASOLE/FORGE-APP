// Session cookie helpers. The raw session token only ever travels in the
// HttpOnly `forge_session` cookie (or an Authorization: Bearer header for
// non-browser callers); D1 stores its SHA-256.
import { isWellFormedToken } from "./crypto";

export const SESSION_COOKIE = "forge_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000;

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue; // first occurrence wins, like browsers send most-specific first
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/** Session token from the cookie, else from `Authorization: Bearer`. Null if absent or malformed. */
export function readSessionToken(headers: Headers): string | null {
  const fromCookie = parseCookies(headers.get("Cookie"))[SESSION_COOKIE];
  if (isWellFormedToken(fromCookie)) return fromCookie;
  const auth = headers.get("Authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(auth);
  if (match && isWellFormedToken(match[1])) return match[1];
  return null;
}

export function sessionCookie(token: string, maxAgeMs = SESSION_TTL_MS): string {
  const maxAge = Math.max(0, Math.floor(maxAgeMs / 1000));
  return `${SESSION_COOKIE}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
