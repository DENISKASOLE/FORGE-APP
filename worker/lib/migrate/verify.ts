// verify step: compare v1 counts with D1/R2 and return a table of
// {name, source, target, ok}. Tables must match exactly. `users` may have
// more rows in D1 (people who signed up in v2). Supabase Storage has no
// count API, so the bucket "source" is the object count recorded by the
// last complete files:<bucket> pass; R2 may hold extra objects that were
// deleted in v1 after they were copied (harmless, reported as a note).
import { logGet, logSet } from "./log";
import { BUCKETS } from "./files";
import { TABLE_SPECS } from "./tables";
import type { StepContext, StepResult } from "./types";
import { nowIso } from "../http";

export interface VerifyRow {
  name: string;
  source: number | null;
  target: number;
  ok: boolean;
  note?: string;
}

async function r2Count(ctx: StepContext, prefix: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  do {
    ctx.budget.use(1);
    const page = await ctx.env.FILES.list({ prefix, cursor, limit: 1000 });
    count += page.objects.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return count;
}

async function authUserCount(ctx: StepContext): Promise<number> {
  const first = await ctx.sb.authUsers(1, 1);
  if (first.total != null) return first.total;
  // No X-Total-Count header: page through ids instead.
  let total = 0;
  for (let page = 1; ; page++) {
    const { users } = await ctx.sb.authUsers(page, 1000);
    total += users.length;
    if (users.length < 1000) return total;
  }
}

export async function runVerifyStep(ctx: StepContext): Promise<StepResult> {
  const { env, sb, budget } = ctx;
  const rows: VerifyRow[] = [];
  const warnings: string[] = [];

  budget.use(1);
  const countSql = [...TABLE_SPECS.map((t) => t.table), "users"]
    .map((t) => `SELECT '${t}' AS name, count(*) AS n FROM ${t}`)
    .join(" UNION ALL ");
  const { results } = await env.DB.prepare(countSql).all<{ name: string; n: number }>();
  const d1 = new Map((results ?? []).map((r) => [r.name, Number(r.n)]));

  for (const spec of TABLE_SPECS) {
    const source = await sb.count(spec.table, spec.pk[0]);
    const target = d1.get(spec.table) ?? 0;
    rows.push({ name: spec.table, source, target, ok: source === target });
  }

  const usersSource = await authUserCount(ctx);
  const usersTarget = d1.get("users") ?? 0;
  rows.push({
    name: "users",
    source: usersSource,
    target: usersTarget,
    ok: usersTarget >= usersSource,
    note: usersTarget > usersSource ? "D1 has extra users (v2 sign-ups)" : undefined,
  });

  for (const bucket of BUCKETS) {
    const last = await logGet<{ objects: number; at: string }>(env.DB, budget, `bucketcount:${bucket}`);
    const target = await r2Count(ctx, `${bucket}/`);
    if (!last) {
      rows.push({ name: `bucket:${bucket}`, source: null, target, ok: false, note: `run files:${bucket} first` });
      continue;
    }
    rows.push({
      name: `bucket:${bucket}`,
      source: last.objects,
      target,
      ok: target >= last.objects,
      note:
        (target > last.objects ? `${target - last.objects} extra in R2 (deleted in v1 after copy). ` : "") +
        `source counted by the files pass at ${last.at}`,
    });
  }

  const failed = rows.filter((r) => !r.ok);
  for (const r of failed) warnings.push(`verify: ${r.name} source=${r.source ?? "?"} target=${r.target}`);
  if (budget.canAfford(1)) await logSet(env.DB, budget, "verify:last", { at: nowIso(), rows });

  return { step: "verify", done: true, nextCursor: null, processed: rows.length, warnings, details: { ok: failed.length === 0, rows } };
}
