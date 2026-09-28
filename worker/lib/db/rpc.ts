// Ports of the v1 Postgres RPCs used by the app (SECURITY DEFINER in v1,
// so they bypass the table policies on purpose, exactly like here).
import type { AuthUser } from "../env";
import { HttpError } from "../http";
import { mapDbError } from "./execute";

const MAX_CODE_LENGTH = 64;
const MAX_EMAIL_LENGTH = 320;

function readString(args: Record<string, unknown>, key: string, max: number, required = true): string {
  const value = args[key];
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `Missing ${key}`, "PGRST100");
    return "";
  }
  if (typeof value !== "string" || value.length > max) throw new HttpError(400, `Invalid ${key}`, "PGRST100");
  return value.trim();
}

/**
 * lookup_invite({p_code}) - PUBLIC (runs before sign-up). Returns only the
 * fields LoginScreen reads (name, email) and only for invites whose row is
 * not yet linked to an account, so a used code can't be replayed to learn
 * a client's email.
 */
export async function lookupInvite(db: D1Database, args: Record<string, unknown>) {
  const code = readString(args, "p_code", MAX_CODE_LENGTH);
  const row = await db
    .prepare("SELECT name, email FROM clients WHERE invite_code = ? AND client_user_id IS NULL LIMIT 1")
    .bind(code)
    .first<{ name: string; email: string }>();
  return row ? [{ name: row.name, email: row.email }] : [];
}

/**
 * claim_invite({p_code, p_email}) - callable without a session (sign-up
 * happens before email verification, see supabase/migrations/
 * 20260901090000_claim_invite_by_email.sql). Marks the invite accepted.
 * When a session exists it also links client_user_id = uid, but only if the
 * session's email matches the invited email (or the invite has none) and
 * the account isn't already linked elsewhere; otherwise linking is left to
 * claim_invite_by_email on first verified login. Returns null like v1.
 */
export async function claimInvite(db: D1Database, args: Record<string, unknown>, user: AuthUser | null) {
  const code = readString(args, "p_code", MAX_CODE_LENGTH);
  const email = readString(args, "p_email", MAX_EMAIL_LENGTH, false);
  const uid = user?.id ?? null;
  const sessionEmail = (user?.email || "").trim();
  try {
    await db
      .prepare(
        `UPDATE clients
            SET invite_status = 'accepted',
                client_user_id = CASE
                  WHEN ?1 IS NOT NULL
                   AND (email = '' OR lower(email) = lower(?2))
                   AND NOT EXISTS (SELECT 1 FROM clients x WHERE x.client_user_id = ?1)
                  THEN ?1 ELSE client_user_id END
          WHERE invite_code = ?3
            AND client_user_id IS NULL
            AND (email = '' OR lower(email) = lower(?4))`,
      )
      .bind(uid, sessionEmail, code, email)
      .run();
  } catch (err) {
    throw mapDbError(err);
  }
  return null;
}

/**
 * claim_invite_by_email() - requires a session with a VERIFIED email (the
 * v1 function trusted the confirmed JWT email). Links the oldest unlinked
 * client row whose email matches, unless this account is already linked
 * (client_user_id is UNIQUE). Returns [{id}] of the linked row, or [].
 */
export async function claimInviteByEmail(db: D1Database, user: AuthUser) {
  if (!user.email_verified) throw new HttpError(403, "Verify your email address first.", "email_not_verified");
  const email = (user.email || "").trim();
  if (!email) return [];
  try {
    const { results } = await db
      .prepare(
        `UPDATE clients
            SET client_user_id = ?1, invite_status = 'accepted'
          WHERE id = (
            SELECT c.id FROM clients c
             WHERE lower(c.email) = lower(?2) AND c.email <> '' AND c.client_user_id IS NULL
               AND NOT EXISTS (SELECT 1 FROM clients x WHERE x.client_user_id = ?1)
             ORDER BY c.created_at ASC LIMIT 1)
          RETURNING id`,
      )
      .bind(user.id, email)
      .all<{ id: string }>();
    return (results || []).map((r) => ({ id: r.id }));
  } catch (err) {
    throw mapDbError(err);
  }
}

export const RPC_NAMES = ["lookup_invite", "claim_invite", "claim_invite_by_email"] as const;
export type RpcName = (typeof RPC_NAMES)[number];
export const isRpcName = (n: string): n is RpcName => (RPC_NAMES as readonly string[]).includes(n);
