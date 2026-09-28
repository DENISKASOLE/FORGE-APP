// CONTRACT (owned by the auth agent - replace the body, keep the exports).
//
// loadUser: resolves the caller from the `forge_session` HttpOnly cookie
// (or `Authorization: Bearer <session id>` for non-browser callers) and
// returns null when there is no valid, unexpired session.
// requireUser: Hono middleware that 401s when loadUser returns null and
// otherwise sets c.var.user.
import type { Context, Next } from "hono";
import type { AppContext, AuthUser } from "./env";
import { fail } from "./http";

export async function loadUser(_c: Context<AppContext>): Promise<AuthUser | null> {
  return null; // implemented in Phase 5 (auth agent)
}

export async function requireUser(c: Context<AppContext>, next: Next) {
  const user = await loadUser(c);
  if (!user) return fail(c, 401, "Not signed in", "unauthorized");
  c.set("user", user);
  await next();
}
