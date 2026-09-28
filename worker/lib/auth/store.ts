// D1 access for users, sessions and single-use email tokens.
import type { AuthUser } from "../env";
import { randomToken, sha256Hex, type PasswordHash } from "./crypto";
import { SESSION_TTL_MS } from "./cookies";

export type TokenKind = "verify" | "recovery" | "email_change" | "setup";

const HOUR_MS = 60 * 60 * 1000;
export const TOKEN_TTL_MS: Record<TokenKind, number> = {
  verify: 24 * HOUR_MS,
  recovery: HOUR_MS,
  email_change: 24 * HOUR_MS,
  setup: HOUR_MS,
};
export const CUTOVER_SETUP_TTL_MS = 7 * 24 * HOUR_MS;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  password_salt: string | null;
  password_iterations: number | null;
  email_verified_at: string | null;
  user_metadata: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
}

export interface TokenRow {
  token_hash: string;
  user_id: string;
  kind: TokenKind;
  new_email: string | null;
  expires_at: string;
  used_at: string | null;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseMetadata(raw: string | null | undefined): AuthUser["user_metadata"] {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    email_verified: !!row.email_verified_at,
    user_metadata: parseMetadata(row.user_metadata),
  };
}

/** The user object sent to the browser: AuthUser plus the supabase-js User fields the app may read. */
export function toPublicUser(row: UserRow) {
  return {
    ...toAuthUser(row),
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    email_confirmed_at: row.email_verified_at,
    confirmed_at: row.email_verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
export type PublicUser = ReturnType<typeof toPublicUser>;

export function storedHash(row: UserRow): PasswordHash | null {
  if (!row.password_hash || !row.password_salt || !row.password_iterations) return null;
  return { hash: row.password_hash, salt: row.password_salt, iterations: row.password_iterations };
}

// ---- users ----------------------------------------------------------------

export function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE lower(email) = ?").bind(normalizeEmail(email)).first<UserRow>();
}

export function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export async function createUser(
  db: D1Database,
  input: { email: string; password: PasswordHash; metadata: Record<string, unknown> },
): Promise<UserRow> {
  const row = await db
    .prepare(
      `INSERT INTO users (id, email, password_hash, password_salt, password_iterations, user_metadata)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      crypto.randomUUID(),
      normalizeEmail(input.email),
      input.password.hash,
      input.password.salt,
      input.password.iterations,
      JSON.stringify(input.metadata),
    )
    .first<UserRow>();
  if (!row) throw new Error("User insert returned no row");
  return row;
}

export async function updateUserFields(
  db: D1Database,
  id: string,
  fields: Partial<Pick<UserRow, "email" | "password_hash" | "password_salt" | "password_iterations" | "email_verified_at" | "user_metadata">>,
): Promise<UserRow | null> {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) return findUserById(db, id);
  const sets = entries.map(([k]) => `${k} = ?`).join(", ");
  return db
    .prepare(`UPDATE users SET ${sets}, updated_at = ? WHERE id = ? RETURNING *`)
    .bind(...entries.map(([, v]) => v), new Date().toISOString(), id)
    .first<UserRow>();
}

export function setPassword(db: D1Database, id: string, password: PasswordHash) {
  return updateUserFields(db, id, {
    password_hash: password.hash,
    password_salt: password.salt,
    password_iterations: password.iterations,
  });
}

export async function markEmailVerified(db: D1Database, row: UserRow): Promise<UserRow> {
  if (row.email_verified_at) return row;
  return (await updateUserFields(db, row.id, { email_verified_at: new Date().toISOString() })) ?? row;
}

// ---- sessions -------------------------------------------------------------

export async function createSession(db: D1Database, userId: string, now = Date.now()) {
  const token = randomToken();
  const expiresAt = iso(now + SESSION_TTL_MS);
  // Opportunistic cleanup keeps the table small without a cron.
  await db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?").bind(userId, iso(now)).run();
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, iso(now), expiresAt, iso(now))
    .run();
  return { token, expiresAt };
}

export async function findSession(db: D1Database, token: string, now = Date.now()) {
  const row = await db
    .prepare(
      `SELECT s.token_hash, s.user_id, s.created_at, s.expires_at, s.last_seen_at,
              u.id, u.email, u.password_hash, u.password_salt, u.password_iterations,
              u.email_verified_at, u.user_metadata, u.created_at AS user_created_at, u.updated_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(await sha256Hex(token), iso(now))
    .first<SessionRow & UserRow & { user_created_at: string }>();
  if (!row) return null;
  const session: SessionRow = {
    token_hash: row.token_hash,
    user_id: row.user_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    last_seen_at: row.last_seen_at,
  };
  const user: UserRow = {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    password_salt: row.password_salt,
    password_iterations: row.password_iterations,
    email_verified_at: row.email_verified_at,
    user_metadata: row.user_metadata,
    created_at: row.user_created_at,
    updated_at: row.updated_at,
  };
  return { session, user };
}

/** Sliding refresh: returns the new expiry, or null when no refresh is due yet. */
export async function touchSession(db: D1Database, session: SessionRow, refreshMs: number, now = Date.now()) {
  if (now - Date.parse(session.last_seen_at) < refreshMs) return null;
  const expiresAt = iso(now + SESSION_TTL_MS);
  await db
    .prepare("UPDATE sessions SET expires_at = ?, last_seen_at = ? WHERE token_hash = ?")
    .bind(expiresAt, iso(now), session.token_hash)
    .run();
  return expiresAt;
}

export async function deleteSession(db: D1Database, token: string) {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
}

/** Revokes every session of a user except `keepToken` (after a password change). */
export async function deleteOtherSessions(db: D1Database, userId: string, keepToken: string | null) {
  const keep = keepToken ? await sha256Hex(keepToken) : "";
  await db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(userId, keep).run();
}

// ---- single-use email tokens ---------------------------------------------

export async function createAuthToken(
  db: D1Database,
  input: { userId: string; kind: TokenKind; newEmail?: string | null; ttlMs?: number },
  now = Date.now(),
): Promise<string> {
  const token = randomToken();
  await db
    .prepare("INSERT INTO auth_tokens (token_hash, user_id, kind, new_email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(
      await sha256Hex(token),
      input.userId,
      input.kind,
      input.newEmail ?? null,
      iso(now),
      iso(now + (input.ttlMs ?? TOKEN_TTL_MS[input.kind])),
    )
    .run();
  return token;
}

/** Atomically marks an unused, unexpired token as used and returns it; null otherwise. */
export async function consumeAuthToken(db: D1Database, token: string, now = Date.now()): Promise<TokenRow | null> {
  return db
    .prepare(
      `UPDATE auth_tokens SET used_at = ?
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
       RETURNING token_hash, user_id, kind, new_email, expires_at, used_at`,
    )
    .bind(iso(now), await sha256Hex(token), iso(now))
    .first<TokenRow>();
}

/** Invalidates outstanding tokens of the given kinds (e.g. old reset links after a password change). */
export async function revokeTokens(db: D1Database, userId: string, kinds: TokenKind[], now = Date.now()) {
  const marks = kinds.map(() => "?").join(", ");
  await db
    .prepare(`UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL AND kind IN (${marks})`)
    .bind(iso(now), userId, ...kinds)
    .run();
}
