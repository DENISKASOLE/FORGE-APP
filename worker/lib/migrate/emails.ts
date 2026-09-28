// send-password-setup step: email every migrated user who has no v2
// password yet, exactly once. Each send is recorded in migration_log
// (key email:<user id>) right after it succeeds, so a crash never causes a
// duplicate. Resend's free tier allows 100 emails/day, shared with the
// app's own reset/invite mail, so this stops at a daily max (default 90).
import { sendPasswordSetupEmail } from "../auth/email";
import { nowIso } from "../http";
import { clampPageSize } from "./cursor";
import { logSetStatement } from "./log";
import type { StepContext, StepInput, StepResult } from "./types";

export const EMAILS_PER_CALL_DEFAULT = 8;
export const EMAILS_PER_CALL_MAX = 10;
export const DEFAULT_DAILY_MAX = 90;
/** Resend fetch + an allowance for token writes inside sendPasswordSetupEmail + our log write. */
const SEND_COST = 4;

export function dailyMax(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_MAX;
}

function utcDayStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

const PENDING_WHERE =
  "u.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM migration_log m WHERE m.key = 'email:' || u.id)";

export async function runSendPasswordSetupStep(ctx: StepContext, input: StepInput): Promise<StepResult> {
  const { env, budget, origin } = ctx;
  const max = dailyMax(env.MIGRATION_EMAIL_DAILY_MAX);
  const warnings: string[] = [];

  budget.use(1);
  const counts = await env.DB.prepare(
    "SELECT (SELECT count(*) FROM migration_log WHERE key LIKE 'email:%' AND updated_at >= ?) AS today, " +
      `(SELECT count(*) FROM users u WHERE ${PENDING_WHERE}) AS pending`,
  )
    .bind(utcDayStart())
    .first<{ today: number; pending: number }>();
  const sentBefore = Number(counts?.today ?? 0);
  const pending = Number(counts?.pending ?? 0);
  const leftToday = Math.max(0, max - sentBefore);

  const perCall = Math.min(
    clampPageSize(input.pageSize, EMAILS_PER_CALL_DEFAULT, EMAILS_PER_CALL_MAX),
    leftToday,
    Math.floor((budget.remaining - 1) / SEND_COST),
  );

  let sent = 0;
  let failed = 0;
  if (perCall > 0 && pending > 0) {
    budget.use(1);
    const { results } = await env.DB.prepare(
      `SELECT u.id, u.email, u.user_metadata FROM users u WHERE ${PENDING_WHERE} ORDER BY u.created_at, u.id LIMIT ?`,
    )
      .bind(perCall)
      .all<{ id: string; email: string; user_metadata: string | null }>();

    for (const row of results ?? []) {
      let meta: unknown = {};
      try {
        meta = row.user_metadata ? JSON.parse(row.user_metadata) : {};
      } catch {
        meta = {};
      }
      budget.use(SEND_COST - 1);
      try {
        await sendPasswordSetupEmail(env, { id: row.id, email: row.email, user_metadata: meta }, origin);
      } catch (err) {
        failed += 1;
        warnings.push(`send-password-setup: ${row.email} failed (${(err as Error).message}); will retry on the next run`);
        continue;
      }
      budget.use(1);
      await logSetStatement(env.DB, `email:${row.id}`, { email: row.email, sentAt: nowIso() }).run();
      sent += 1;
    }
  }

  const remaining = pending - sent;
  const sentToday = sentBefore + sent;
  const capReached = remaining > 0 && sentToday >= max;
  if (capReached) {
    warnings.push(
      `send-password-setup: daily limit of ${max} reached; ${remaining} user(s) still need an email. Run it again tomorrow (UTC).`,
    );
  }
  // Failures alone must not loop forever: stop once nothing went out this call.
  const done = remaining <= 0 || capReached || (sent === 0 && failed > 0);
  return {
    step: "send-password-setup",
    done,
    nextCursor: null,
    processed: sent,
    warnings,
    details: { sent, failed, remaining, sentToday, dailyMax: max },
  };
}
