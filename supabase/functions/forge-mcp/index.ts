// Supabase Edge Function: forge-mcp
// Remote MCP server exposing Forge's coaching data as tools for Claude
// (claude.ai -> Settings -> Connectors -> Add custom connector). Follows
// forge-ai/forge-fatsecret's conventions: one function, one deploy, a
// CORS header block, Deno.serve. Unlike those, this one also hosts its
// own minimal OAuth layer (oauth.ts) - Supabase's native MCP-OAuth needs
// project-wide changes (asymmetric JWT signing, a frontend consent
// route, public dynamic client registration) not worth it for a
// single-coach admin tool, so this wraps Supabase Auth's password grant
// in a small Authorization Code + PKCE shim instead.
//
// Every tool call runs through Supabase using the CALLER's own JWT
// (obtained at /authorize, handed back to Claude as the MCP access
// token) - never the service role key - so Row Level Security is the
// real access control, identical to every other write path in this app.
//
// Secret required: MCP_SIGNING_SECRET (any long random string you
// invent - signs the short-lived auth code). SUPABASE_URL and
// SUPABASE_ANON_KEY are already provided automatically by the platform.
//
// Routes (all under /functions/v1/forge-mcp):
//   GET  /.well-known/oauth-authorization-server  - OAuth metadata
//   GET  /.well-known/oauth-protected-resource     - resource metadata
//   GET  /authorize   - login form
//   POST /authorize    - verifies the coach, issues a signed code
//   POST /token         - exchanges a code (or refresh_token) for a Supabase JWT
//   *    (anything else) - the MCP streamable HTTP endpoint
//
// See forge-mcp-setup.md for deploy steps and how to add this as a
// Claude custom connector.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { signCode, verifyCode, pkceMatches, passwordLogin, refreshLogin, isCoach, loginPage, decodeJwtExp, decodeJwtSub } from "./oauth.ts";
import { registerAllTools } from "./tools.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CODE_TTL_MS = 2 * 60 * 1000;

// Deliberately NOT derived from req.url: Supabase's gateway presents the
// function with a rewritten internal URL (http, no /functions/v1/
// prefix) that only matches the real public URL a client uses by
// accident. Built from SUPABASE_URL instead, which is always the real
// public origin, both locally (supabase functions serve) and in prod.
function baseUrl(): string {
  return `${SUPABASE_URL}/functions/v1/forge-mcp`;
}
function json(o: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(o), { status, headers: { ...CORS, ...extraHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname;
  const root = baseUrl();

  try {
    if (path.endsWith("/.well-known/oauth-authorization-server")) {
      return json({
        issuer: root,
        authorization_endpoint: `${root}/authorize`,
        token_endpoint: `${root}/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    }

    if (path.endsWith("/.well-known/oauth-protected-resource")) {
      return json({ resource: root, authorization_servers: [root] });
    }

    if (path.endsWith("/authorize") && req.method === "GET") {
      const p = Object.fromEntries(url.searchParams.entries());
      if (!p.redirect_uri || !p.client_id || p.response_type !== "code" || !p.code_challenge) {
        return new Response("Missing or invalid OAuth parameters.", { status: 400, headers: CORS });
      }
      return new Response(loginPage(p), { headers: { ...CORS, "Content-Type": "text/html" } });
    }

    if (path.endsWith("/authorize") && req.method === "POST") {
      const form = await req.formData();
      const email = String(form.get("email") || "");
      const password = String(form.get("password") || "");
      const p = {
        response_type: String(form.get("response_type") || ""),
        client_id: String(form.get("client_id") || ""),
        redirect_uri: String(form.get("redirect_uri") || ""),
        state: String(form.get("state") || ""),
        code_challenge: String(form.get("code_challenge") || ""),
        code_challenge_method: String(form.get("code_challenge_method") || ""),
      };
      const login = await passwordLogin(email, password);
      if ("error" in login) return new Response(loginPage(p, login.error), { status: 401, headers: { ...CORS, "Content-Type": "text/html" } });
      const sub = decodeJwtSub(login.access_token);
      if (!sub || !(await isCoach(login.access_token, sub))) {
        return new Response(loginPage(p, "This is a client account - only the coach's own login can connect Claude."), { status: 403, headers: { ...CORS, "Content-Type": "text/html" } });
      }
      const code = await signCode({ at: login.access_token, rt: login.refresh_token, cc: p.code_challenge, ri: p.redirect_uri, ci: p.client_id, exp: Date.now() + CODE_TTL_MS });
      const redirect = new URL(p.redirect_uri);
      redirect.searchParams.set("code", code);
      if (p.state) redirect.searchParams.set("state", p.state);
      return new Response(null, { status: 302, headers: { ...CORS, Location: redirect.toString() } });
    }

    if (path.endsWith("/token") && req.method === "POST") {
      const ct = req.headers.get("content-type") || "";
      const body: Record<string, any> = ct.includes("application/json") ? await req.json().catch(() => ({})) : Object.fromEntries((await req.formData()).entries());
      const grantType = String(body.grant_type || "");

      if (grantType === "authorization_code") {
        const payload = await verifyCode(String(body.code || ""));
        if (!payload) return json({ error: "invalid_grant", error_description: "Code is invalid or expired." }, 400);
        if (payload.ri !== String(body.redirect_uri || "") || payload.ci !== String(body.client_id || "")) {
          return json({ error: "invalid_grant", error_description: "redirect_uri/client_id mismatch." }, 400);
        }
        const verifier = String(body.code_verifier || "");
        if (!verifier || !(await pkceMatches(verifier, payload.cc))) {
          return json({ error: "invalid_grant", error_description: "PKCE verification failed." }, 400);
        }
        const exp = decodeJwtExp(payload.at);
        return json({ access_token: payload.at, token_type: "bearer", expires_in: exp ? Math.max(60, exp - Math.floor(Date.now() / 1000)) : 3600, refresh_token: payload.rt });
      }

      if (grantType === "refresh_token") {
        const refreshed = await refreshLogin(String(body.refresh_token || ""));
        if ("error" in refreshed) return json({ error: "invalid_grant", error_description: refreshed.error }, 400);
        const exp = decodeJwtExp(refreshed.access_token);
        return json({ access_token: refreshed.access_token, token_type: "bearer", expires_in: exp ? Math.max(60, exp - Math.floor(Date.now() / 1000)) : 3600, refresh_token: refreshed.refresh_token });
      }

      return json({ error: "unsupported_grant_type" }, 400);
    }

    // ---- MCP streamable HTTP endpoint ----
    const auth = req.headers.get("authorization") || "";
    const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      return json({ error: "unauthorized" }, 401, { "WWW-Authenticate": `Bearer resource_metadata="${root}/.well-known/oauth-protected-resource"` });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "forge-mcp", version: "1.0.0" });
      registerAllTools(server, supabase);
      return server;
    });
    const res = await handler.fetch(req);
    const headers = new Headers(res.headers);
    Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
    return new Response(res.body, { status: res.status, headers });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
