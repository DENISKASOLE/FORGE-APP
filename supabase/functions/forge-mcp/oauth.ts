// forge-mcp OAuth shim - verifies and exchanges the signed codes issued
// by api/authorize.js (a Vercel serverless function in this same repo,
// NOT part of this Edge Function - see index.ts's header comment for
// why the login page itself had to move there). This file only handles
// the /token side: verifying a signed code's HMAC + expiry, PKCE
// verification, and refreshing a Supabase session. MCP_SIGNING_SECRET
// must match the Vercel function's exactly, or codes it issues will
// fail verification here.
//
// The "access token" Claude ends up holding is literally the coach's
// own Supabase JWT - every MCP tool call then runs through Supabase
// with that JWT, so RLS is the real access control, never this file.
// See forge-mcp-setup.md.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function b64url(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const enc = new TextEncoder();

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("MCP_SIGNING_SECRET");
  if (!secret) throw new Error("MCP_SIGNING_SECRET is not set.");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
}

type CodePayload = { at: string; rt: string; cc: string; ri: string; ci: string; exp: number };

export async function verifyCode(code: string): Promise<CodePayload | null> {
  const dot = code.lastIndexOf(".");
  if (dot < 0) return null;
  const body = code.slice(0, dot), sig = code.slice(dot + 1);
  const key = await hmacKey();
  let ok: boolean;
  try { ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as CodePayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export async function pkceMatches(verifier: string, challenge: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(verifier));
  return b64url(new Uint8Array(digest)) === challenge;
}

export function decodeJwtExp(jwt: string): number | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(jwt.split(".")[1])));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch { return null; }
}

export async function refreshLogin(refresh_token: string): Promise<{ access_token: string; refresh_token: string } | { error: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) return { error: data?.error_description || data?.msg || "Could not refresh session." };
  return { access_token: data.access_token as string, refresh_token: data.refresh_token as string };
}
