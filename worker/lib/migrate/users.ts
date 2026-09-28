// users step: copy Supabase auth.users into the D1 `users` table (0002,
// auth agent) WITHOUT passwords. Supabase bcrypt hashes are not portable
// to the Worker, so everyone gets a "set your password" email instead.
//
// Re-run safety: once a user has set a password in v2 (password_hash not
// NULL) their password, email and metadata are v2's and are never
// overwritten. email_verified_at is only ever filled in, never cleared.
import { toIsoTs } from "./transform";
import { clampPageSize, parseOffsetCursor } from "./cursor";
import type { AuthUserRecord } from "./supabase";
import type { StepContext, StepInput, StepResult } from "./types";

export const USERS_DEFAULT_PAGE = 50;
// D1 allows at most 100 bound parameters per query (the email lookup binds one per user).
export const USERS_MAX_PAGE = 90;

export const USERS_UPSERT_SQL =
  "INSERT INTO users (id, email, email_verified_at, user_metadata, created_at, updated_at) " +
  "VALUES (?, ?, ?, ?, ?, ?) " +
  "ON CONFLICT(id) DO UPDATE SET " +
  "email = CASE WHEN users.password_hash IS NULL THEN excluded.email ELSE users.email END, " +
  "user_metadata = CASE WHEN users.password_hash IS NULL THEN excluded.user_metadata ELSE users.user_metadata END, " +
  "updated_at = CASE WHEN users.password_hash IS NULL THEN excluded.updated_at ELSE users.updated_at END, " +
  "email_verified_at = COALESCE(users.email_verified_at, excluded.email_verified_at), " +
  "created_at = COALESCE(excluded.created_at, users.created_at)";

function userValues(u: AuthUserRecord, email: string): (string | null)[] {
  const meta = u.user_metadata ?? u.raw_user_meta_data ?? {};
  return [
    u.id,
    email,
    toIsoTs(u.email_confirmed_at ?? u.confirmed_at ?? null),
    JSON.stringify(meta),
    toIsoTs(u.created_at ?? null),
    toIsoTs(u.updated_at ?? null),
  ];
}

export async function runUsersStep(ctx: StepContext, input: StepInput): Promise<StepResult> {
  const { env, sb, budget } = ctx;
  const page = parseOffsetCursor(input.cursor, 1);
  const perPage = clampPageSize(input.pageSize, USERS_DEFAULT_PAGE, USERS_MAX_PAGE);
  const { users } = await sb.authUsers(page, perPage);
  const warnings: string[] = [];

  const candidates: { u: AuthUserRecord; email: string }[] = [];
  for (const u of users) {
    const email = (u.email ?? "").trim();
    if (!u.id || !email) {
      warnings.push(`users: ${u.id ?? "?"} has no email (phone-only?) and was skipped`);
      continue;
    }
    candidates.push({ u, email });
  }

  // A v2 account that already owns this email under a different id would
  // violate the unique email index; skip it and say so.
  const taken = new Map<string, string>();
  if (candidates.length) {
    budget.use(1);
    const placeholders = candidates.map(() => "?").join(", ");
    const { results } = await env.DB.prepare(
      `SELECT id, lower(email) AS e FROM users WHERE lower(email) IN (${placeholders})`,
    )
      .bind(...candidates.map((c) => c.email.toLowerCase()))
      .all<{ id: string; e: string }>();
    for (const r of results ?? []) taken.set(r.e, r.id);
  }

  const upsert = env.DB.prepare(USERS_UPSERT_SQL);
  const stmts: D1PreparedStatement[] = [];
  for (const { u, email } of candidates) {
    const owner = taken.get(email.toLowerCase());
    if (owner && owner !== u.id) {
      warnings.push(`users: ${email} already belongs to a different v2 account (${owner}); v1 user ${u.id} skipped`);
      continue;
    }
    stmts.push(upsert.bind(...userValues(u, email)));
  }
  if (stmts.length) {
    budget.use(1);
    await env.DB.batch(stmts);
  }

  const done = users.length < perPage;
  return { step: "users", done, nextCursor: done ? null : String(page + 1), processed: users.length, warnings };
}
