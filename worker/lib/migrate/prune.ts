// prune step: delete D1 rows whose primary key no longer exists in v1
// (deleted there since the last rehearsal). One table per call, children
// before parents. Never touches `payments` (v2-only) and never removes a
// user who has already set a password in v2.
import { clampPageSize, parseOffsetCursor } from "./cursor";
import { tableSpec } from "./tables";
import type { StepContext, StepInput, StepResult } from "./types";

export const PRUNE_ORDER = [
  "buddy_members",
  "buddy_pairs",
  "health_screenings",
  "client_data",
  "trainer_data",
  "exercise_library",
  "clients",
  "trainers",
  "users",
] as const;

const PK_PAGE = 1000;
/** Refuse to delete more than this share of a table unless {force:true}. */
const MAX_PRUNE_SHARE = 0.5;
const MIN_ROWS_FOR_SAFETY = 3;
const SEP = "\u0000";

async function sourceKeys(ctx: StepContext, table: string, pk: string[], pageSize: number): Promise<Set<string>> {
  const keys = new Set<string>();
  if (table === "users") {
    for (let page = 1; ; page++) {
      const { users } = await ctx.sb.authUsers(page, pageSize);
      for (const u of users) keys.add(String(u.id));
      if (users.length < pageSize) return keys;
    }
  }
  const order = pk.map((c) => `${c}.asc`).join(",");
  for (let offset = 0; ; offset += pageSize) {
    const rows = await ctx.sb.rest(table, { select: pk.join(","), order, limit: String(pageSize), offset: String(offset) });
    for (const r of rows) keys.add(pk.map((c) => String(r[c])).join(SEP));
    if (rows.length < pageSize) return keys;
  }
}

export async function runPruneStep(ctx: StepContext, input: StepInput): Promise<StepResult> {
  const { env, budget } = ctx;
  const index = parseOffsetCursor(input.cursor);
  const table = PRUNE_ORDER[index];
  const warnings: string[] = [];
  if (!table) return { step: "prune", done: true, nextCursor: null, processed: 0, warnings };

  const pk = table === "users" ? ["id"] : tableSpec(table)!.pk;
  const pageSize = clampPageSize(input.pageSize, PK_PAGE, PK_PAGE);
  const keep = await sourceKeys(ctx, table, pk, pageSize);

  budget.use(1);
  const targetSql =
    table === "users"
      ? "SELECT id FROM users WHERE password_hash IS NULL"
      : `SELECT ${pk.join(", ")} FROM ${table}`;
  const { results } = await env.DB.prepare(targetSql).all<Record<string, unknown>>();
  const target = results ?? [];
  const stale = target.filter((r) => !keep.has(pk.map((c) => String(r[c])).join(SEP)));

  let processed = 0;
  const tooMany = stale.length >= MIN_ROWS_FOR_SAFETY && stale.length > target.length * MAX_PRUNE_SHARE;
  if (tooMany && !input.force) {
    warnings.push(
      `prune ${table}: ${stale.length} of ${target.length} rows are missing in v1; skipped as a safety check ` +
        `(re-run the prune step with --force-prune if that is really expected)`,
    );
  } else if (stale.length) {
    const where = pk.map((c) => `${c} = ?`).join(" AND ");
    const extra = table === "users" ? " AND password_hash IS NULL" : "";
    const del = env.DB.prepare(`DELETE FROM ${table} WHERE ${where}${extra}`);
    budget.use(1);
    try {
      await env.DB.batch(stale.map((r) => del.bind(...pk.map((c) => r[c] as string))));
      processed = stale.length;
    } catch (err) {
      warnings.push(`prune ${table}: delete failed (${(err as Error).message}); nothing was removed from this table`);
    }
  }

  const next = index + 1;
  const done = next >= PRUNE_ORDER.length;
  return {
    step: "prune",
    done,
    nextCursor: done ? null : String(next),
    processed,
    warnings,
    details: { table, removed: processed, stale: stale.length },
  };
}
