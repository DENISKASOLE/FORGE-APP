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
//   POST /register      - Dynamic Client Registration (RFC 7591)
//   POST /token           - exchanges a code (or refresh_token) for a Supabase JWT
//   *    (anything else) - the MCP streamable HTTP endpoint
//
// NOTE: GET/POST /authorize (the login page) does NOT live here - it's
// a Vercel serverless function instead (api/authorize.js in this repo).
// Reason: Supabase Edge Functions on the default *.supabase.co domain
// always have a text/html response rewritten to text/plain (documented,
// deliberate anti-XSS platform behavior - confirmed live, a login page
// served from here rendered as raw unstyled source text). JSON
// responses are unaffected, so only that one HTML-rendering route
// moved; /register, /token, the .well-known docs, and /mcp all stay
// here. api/authorize.js signs/the code with the exact same
// MCP_SIGNING_SECRET this function verifies with below - keep both in
// sync if that secret ever rotates.
//
// IMPORTANT: Supabase only ever routes /functions/v1/<name>/* to an Edge
// Function - nothing can live at a project's bare domain root. Claude's
// connector flow (confirmed live) wants /authorize, /token, /register
// and the .well-known docs reachable at a bare root, not a sub-path -
// so those are additionally reverse-proxied from app.forgeperformance.online
// (the live app's own Vercel domain, which CAN serve arbitrary root
// paths - see vercel.json's rewrites) straight through to this same
// function (except /authorize, see above). All self-referential URLs
// below (issuer, MCP_RESOURCE, etc.) point at that domain, not at
// *.supabase.co, for exactly this reason - this function's own code
// never changes based on which domain actually reached it, since
// Vercel's proxy forwards the original path/method/body unchanged.
//
// See forge-mcp-setup.md for deploy steps and how to add this as a
// Claude custom connector.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyCode, pkceMatches, refreshLogin, decodeJwtExp } from "./oauth.ts";
import { registerAllTools } from "./tools.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Deliberately NOT derived from req.url: Supabase's gateway presents the
// function with a rewritten internal URL that doesn't match the real
// public URL a client uses. Also deliberately NOT the *.supabase.co
// function URL at all (see the big comment above) - this is the bare
// root of the live app's own domain, proxied to this function by
// vercel.json. Every OAuth endpoint (authorize/token/register/
// well-known) is advertised and reached through this domain.
const PUBLIC_ROOT = "https://app.forgeperformance.online";
const MCP_RESOURCE = `${PUBLIC_ROOT}/mcp`;
function json(o: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(o), { status, headers: { ...CORS, ...extraHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname;
  const root = PUBLIC_ROOT;

  try {
    if (path.includes("/.well-known/oauth-authorization-server")) {
      return json({
        issuer: root,
        authorization_endpoint: `${root}/authorize`,
        token_endpoint: `${root}/token`,
        registration_endpoint: `${root}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    }

    if (path.includes("/.well-known/oauth-protected-resource")) {
      return json({ resource: MCP_RESOURCE, authorization_servers: [root] });
    }

    // Dynamic Client Registration (RFC 7591) - Claude's connector flow
    // registers itself here before it can even show a login screen.
    // Stateless and open: nothing is persisted, any client_id this
    // issues grants no access on its own - the real gate is still the
    // coach login + isCoach check at /authorize. Registration only lets
    // a client obtain an id to use in the normal Authorization Code
    // flow, same security boundary as a hardcoded client_id would be.
    if (path.endsWith("/register") && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const client_id = crypto.randomUUID();
      return json({
        client_id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        client_name: body.client_name || "Claude",
      }, 201);
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
