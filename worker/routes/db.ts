// Route group /api/db - see docs/cloudflare/CONTRACTS.md for ownership.
//   POST /api/db/query       supabase-js-shaped query, RLS-equivalent policies
//   POST /api/db/rpc/:name   lookup_invite | claim_invite | claim_invite_by_email
import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { AppContext, AuthUser } from "../lib/env";
import { HttpError, fail, readJson } from "../lib/http";
import { loadUser, requireUser } from "../lib/session";
import { executeQuery } from "../lib/db/execute";
import { parseRequest } from "../lib/db/request";
import { claimInvite, claimInviteByEmail, isRpcName, lookupInvite } from "../lib/db/rpc";

type Ctx = Context<AppContext>;

const app = new Hono<AppContext>();

// Same mapping as worker/index.ts, so this group behaves identically when
// mounted on its own (tests) or under the main app.
app.onError((err, c) => {
  if (err instanceof HttpError) return fail(c, err.status, err.message, err.code);
  console.error("Unhandled /api/db error", c.req.method, c.req.path, err);
  return fail(c, 500, "Something went wrong. Please try again.", "internal");
});

// Uses a user already resolved earlier in the chain, else the session.
async function ensureUser(c: Ctx, next: Next) {
  if (c.get("user")) return next();
  return requireUser(c, next);
}

async function currentUser(c: Ctx): Promise<AuthUser | null> {
  return c.get("user") ?? (await loadUser(c));
}

async function limit(binding: RateLimit | undefined, key: string) {
  if (!binding) return; // binding absent (local tests): no limiting
  const { success } = await binding.limit({ key });
  if (!success) throw new HttpError(429, "Too many requests. Please wait a moment and try again.", "rate_limited");
}

const clientIp = (c: Ctx) => c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";

function argsOf(body: unknown): Record<string, unknown> {
  if (body === null || body === undefined) return {};
  if (typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "RPC arguments must be an object", "PGRST100");
  return body as Record<string, unknown>;
}

async function readBody(c: Ctx): Promise<unknown> {
  const text = await c.req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body", "bad_json");
  }
}

app.post("/query", ensureUser, async (c) => {
  const user = c.get("user")!;
  await limit(c.env.API_LIMITER, user.id);
  const req = parseRequest(await readJson(c));
  const data = await executeQuery(c.env.DB, req, { user, coachEmail: c.env.COACH_EMAIL || "" });
  return c.json({ data });
});

app.post("/rpc/:name", async (c) => {
  const name = c.req.param("name");
  if (!isRpcName(name)) return fail(c, 404, `Could not find the function public.${name.slice(0, 64)}`, "PGRST202");
  const args = argsOf(await readBody(c));

  if (name === "lookup_invite") {
    await limit(c.env.AUTH_LIMITER, `lookup_invite:${clientIp(c)}`);
    return c.json({ data: await lookupInvite(c.env.DB, args) });
  }
  if (name === "claim_invite") {
    await limit(c.env.AUTH_LIMITER, `claim_invite:${clientIp(c)}`);
    return c.json({ data: await claimInvite(c.env.DB, args, await currentUser(c)) });
  }
  const user = await currentUser(c);
  if (!user) return fail(c, 401, "Not signed in", "unauthorized");
  await limit(c.env.API_LIMITER, user.id);
  return c.json({ data: await claimInviteByEmail(c.env.DB, user) });
});

export default app;
