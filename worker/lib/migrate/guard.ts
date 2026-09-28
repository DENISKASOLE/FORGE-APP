// Guard for every /api/admin/* route:
//   - 404 unless MIGRATION_ENABLED === "true" (route looks absent otherwise)
//   - 503 if MIGRATION_ADMIN_TOKEN is missing or shorter than 32 chars
//   - 401 unless `Authorization: Bearer <MIGRATION_ADMIN_TOKEN>` (constant time)
import type { Context, Next } from "hono";
import type { AppContext } from "../env";
import { fail } from "../http";

export const MIN_TOKEN_LENGTH = 32;

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

/** Compares SHA-256 digests byte by byte, so timing leaks neither content nor length. */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function migrationGuard(c: Context<AppContext>, next: Next) {
  if (c.env.MIGRATION_ENABLED !== "true") return fail(c, 404, "Not found", "not_found");

  const secret = c.env.MIGRATION_ADMIN_TOKEN ?? "";
  if (secret.length < MIN_TOKEN_LENGTH) {
    return fail(c, 503, "Migration admin token is not configured (needs at least 32 characters)", "not_configured");
  }

  const header = c.req.header("Authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match || !(await constantTimeEqual(match[1], secret))) {
    return fail(c, 401, "Unauthorized", "unauthorized");
  }
  await next();
}
