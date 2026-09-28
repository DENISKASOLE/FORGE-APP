// Resolves the caller from the `forge_session` HttpOnly cookie (or
// `Authorization: Bearer <session token>` for non-browser callers).
// loadUser returns null when there is no valid, unexpired session.
// requireUser is Hono middleware that 401s when loadUser returns null and
// otherwise sets c.var.user.
import type { Context, Next } from "hono";
import type { AppContext, AuthUser } from "./env";
import { fail } from "./http";
import { SESSION_REFRESH_MS, readSessionToken, sessionCookie } from "./auth/cookies";
import { findSession, toAuthUser, touchSession, type SessionRow, type UserRow } from "./auth/store";

export interface ResolvedSession {
  token: string;
  session: SessionRow;
  user: UserRow;
}

// One lookup per request, even when requireUser and the handler both ask.
const resolved = new WeakMap<Request, Promise<ResolvedSession | null>>();

async function resolve(c: Context<AppContext>): Promise<ResolvedSession | null> {
  const token = readSessionToken(c.req.raw.headers);
  if (!token) return null;
  const found = await findSession(c.env.DB, token);
  if (!found) return null;
  const refreshedUntil = await touchSession(c.env.DB, found.session, SESSION_REFRESH_MS);
  if (!refreshedUntil) return { token, ...found };
  // Only re-issue the cookie when it came from a cookie (not a Bearer caller).
  if (c.req.header("Cookie")?.includes(token)) {
    c.header("Set-Cookie", sessionCookie(token, Date.parse(refreshedUntil) - Date.now()), { append: true });
  }
  return { token, user: found.user, session: { ...found.session, expires_at: refreshedUntil } };
}

/** Full session lookup (user row + session row). Memoised per request. */
export function resolveSession(c: Context<AppContext>): Promise<ResolvedSession | null> {
  let pending = resolved.get(c.req.raw);
  if (!pending) {
    pending = resolve(c);
    resolved.set(c.req.raw, pending);
  }
  return pending;
}

/** Forget the memoised lookup (after login/logout changes the session mid-request). */
export function forgetSession(c: Context<AppContext>): void {
  resolved.delete(c.req.raw);
}

export async function loadUser(c: Context<AppContext>): Promise<AuthUser | null> {
  const found = await resolveSession(c);
  return found ? toAuthUser(found.user) : null;
}

export async function requireUser(c: Context<AppContext>, next: Next) {
  const user = await loadUser(c);
  if (!user) return fail(c, 401, "Not signed in", "unauthorized");
  c.set("user", user);
  await next();
}
