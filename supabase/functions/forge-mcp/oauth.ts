// forge-mcp OAuth shim - a minimal, self-contained Authorization Code +
// PKCE layer wrapping Supabase Auth's password grant, so Claude can
// connect as a custom OAuth connector without any change to this
// project's existing Auth config (JWT signing algorithm, dynamic client
// registration, a frontend consent route). The "access token" Claude
// ends up holding is literally the coach's own Supabase JWT - every MCP
// tool call then runs through Supabase with that JWT, so RLS is the
// real access control, never this file. See forge-mcp-setup.md.
//
// Secret required: MCP_SIGNING_SECRET (any long random string you
// invent - signs the short-lived auth code; not a Supabase secret).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function b64url(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const enc = new TextEncoder();

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("MCP_SIGNING_SECRET");
  if (!secret) throw new Error("MCP_SIGNING_SECRET is not set.");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

type CodePayload = { at: string; rt: string; cc: string; ri: string; ci: string; exp: number };

export async function signCode(payload: CodePayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

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
export function decodeJwtSub(jwt: string): string | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(jwt.split(".")[1])));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch { return null; }
}

// Supabase Auth password grant, called server-side only - the coach's
// password is posted to this function, never stored, and never seen by
// Claude or any other party.
export async function passwordLogin(email: string, password: string): Promise<{ access_token: string; refresh_token: string } | { error: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) return { error: data?.error_description || data?.msg || "Invalid email or password." };
  return { access_token: data.access_token as string, refresh_token: data.refresh_token as string };
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

// Only a row in `trainers` may ever connect - a client account that
// finds its way to /authorize is rejected here, before any code is
// issued, using the client's OWN fresh JWT (never the service role key).
export async function isCoach(accessToken: string, userId: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trainers?id=eq.${userId}&select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function loginPage(params: Record<string, string>, error?: string): string {
  const hidden = Object.entries(params).map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}">`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Forge</title>
<style>
body{font-family:-apple-system,system-ui,sans-serif;background:#0B0E14;color:#F4F6FA;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
form{background:#151A26;border:1px solid #2A3042;border-radius:16px;padding:28px;width:100%;max-width:360px}
h1{font-size:18px;margin:0 0 4px}
p{color:#9AA3B5;font-size:13px;margin:0 0 20px}
label{display:block;font-size:12px;color:#9AA3B5;margin-bottom:6px}
input[type=email],input[type=password]{width:100%;box-sizing:border-box;background:#0B0E14;border:1px solid #2A3042;border-radius:10px;padding:10px 12px;color:#F4F6FA;margin-bottom:14px;font-size:14px}
button{width:100%;background:#4C8DFF;color:#fff;border:none;border-radius:10px;padding:11px;font-size:14px;font-weight:600;cursor:pointer}
.err{background:#3A1A1A;border:1px solid #6B2B2B;color:#FFB4B4;border-radius:8px;padding:10px 12px;font-size:13px;margin-bottom:14px}
</style></head><body>
<form method="POST">
<h1>Connect Claude to Forge</h1>
<p>Sign in with your coach account to let Claude read and manage your coaching data.</p>
${error ? `<div class="err">${escapeHtml(error)}</div>` : ""}
<label for="email">Email</label>
<input type="email" id="email" name="email" required autofocus>
<label for="password">Password</label>
<input type="password" id="password" name="password" required>
${hidden}
<button type="submit">Sign in</button>
</form></body></html>`;
}
