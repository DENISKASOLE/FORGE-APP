// Vercel serverless function: /authorize (forge-mcp OAuth login page)
//
// This lives here, not in the forge-mcp Supabase Edge Function, because
// of a documented, unchangeable Supabase platform behavior: Edge
// Functions on the default *.supabase.co domain always have a
// text/html response rewritten to text/plain (an anti-XSS measure for
// their shared domain - real HTML only works with a paid custom-domain
// add-on). Confirmed directly: the function's own text/html header was
// preserved all the way to the response, but Supabase's gateway
// rewrote it anyway - a login FORM rendered as unstyled source text
// instead of an actual page. JSON endpoints (/token, /register,
// /.well-known/*) are unaffected, so only this one HTML-rendering route
// moved - everything else stays on forge-mcp as before, reached via
// vercel.json's existing rewrites.
//
// This must produce byte-for-byte the same signed-code format forge-mcp's
// /token endpoint on Supabase verifies, so MCP_SIGNING_SECRET here MUST
// be set to the exact same value as the Supabase secret of that name
// (Vercel Project Settings -> Environment Variables). SUPABASE_URL/
// SUPABASE_ANON_KEY below are the same public, already-client-exposed
// values as .env's VITE_ prefixed ones - safe to inline.

const SUPABASE_URL = "https://rjzfyfgymkcaffazzpff.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Qdb11LbLJGIC4vr323_PgQ_6QEx5rtV";

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}
function b64urlDecode(s) {
  return new Uint8Array(Buffer.from(s, "base64url"));
}
const enc = new TextEncoder();

async function hmacKey() {
  const secret = process.env.MCP_SIGNING_SECRET;
  if (!secret) throw new Error("MCP_SIGNING_SECRET is not set.");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
async function signCode(payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}
function decodeJwtSub(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch { return null; }
}

async function passwordLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) return { error: data?.error_description || data?.msg || "Invalid email or password." };
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}
async function isCoach(accessToken, userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trainers?id=eq.${userId}&select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function loginPage(params, error) {
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

const CODE_TTL_MS = 2 * 60 * 1000;

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const p = Object.fromEntries(Object.entries(req.query || {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || ""]));
      if (!p.redirect_uri || !p.client_id || p.response_type !== "code" || !p.code_challenge) {
        res.status(400).send("Missing or invalid OAuth parameters.");
        return;
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(loginPage(p));
      return;
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const email = String(body.email || "");
      const password = String(body.password || "");
      const p = {
        response_type: String(body.response_type || ""),
        client_id: String(body.client_id || ""),
        redirect_uri: String(body.redirect_uri || ""),
        state: String(body.state || ""),
        code_challenge: String(body.code_challenge || ""),
        code_challenge_method: String(body.code_challenge_method || ""),
      };
      const login = await passwordLogin(email, password);
      if ("error" in login) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(401).send(loginPage(p, login.error));
        return;
      }
      const sub = decodeJwtSub(login.access_token);
      if (!sub || !(await isCoach(login.access_token, sub))) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(403).send(loginPage(p, "This is a client account - only the coach's own login can connect Claude."));
        return;
      }
      const code = await signCode({ at: login.access_token, rt: login.refresh_token, cc: p.code_challenge, ri: p.redirect_uri, ci: p.client_id, exp: Date.now() + CODE_TTL_MS });
      const redirect = new URL(p.redirect_uri);
      redirect.searchParams.set("code", code);
      if (p.state) redirect.searchParams.set("state", p.state);
      res.writeHead(302, { Location: redirect.toString() });
      res.end();
      return;
    }

    res.status(405).send("Method not allowed.");
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
