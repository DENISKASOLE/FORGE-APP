// Builds parameterised SQLite statements for a validated QueryRequest with
// the caller's RLS-equivalent predicates (worker/lib/policies.ts) folded in.
import { HttpError, newId, nowIso } from "../http";
import { type PolicyCtx, type Ref, applicableUpdateRules, policyFor } from "../policies";
import { type Filter, type Projection, type QueryRequest, MAX_ROWS, encodeValue } from "./request";
import type { TableDef } from "./schema";
import { type Frag, FALSE, and, col, ident, join, or, raw, sql } from "./sql";

// D1 rejects statements with more than 100 bound parameters.
export const MAX_PARAMS = 100;

export type Plan =
  | { kind: "select"; stmt: Frag }
  | { kind: "insert"; stmt: Frag; expected: number }
  | { kind: "update"; violations: Frag; stmt: Frag }
  | { kind: "delete"; stmt: Frag };

const refFor = (alias: string): Ref => (c) => col(alias, c);
const tableIdent = (t: TableDef) => ident(t.name);

function filterFrag(table: TableDef, ref: Ref, f: Filter): Frag {
  const def = table.columns[f.col];
  const target = ref(f.col);
  switch (f.op) {
    case "eq":
      return sql`${target} = ${encodeValue(def, f.value, f.col)}`;
    case "neq":
      return sql`${target} <> ${encodeValue(def, f.value, f.col)}`;
    case "in": {
      const values = f.value as unknown[];
      if (!values.length) return FALSE;
      return sql`${target} IN (${join(values.map((v) => sql`${encodeValue(def, v, f.col)}`), ", ")})`;
    }
    case "is":
      return sql`${target} ${raw(f.value === null ? "IS NULL" : f.value ? "IS TRUE" : "IS FALSE")}`;
  }
}

function filtersFrag(req: QueryRequest, ref: Ref): Frag {
  return and(...req.filters.map((f) => filterFrag(req.table, ref, f)));
}

const notOk = (f: Frag): Frag => sql`NOT COALESCE((${f}), 0)`;

function projectionFrag(table: TableDef, p: Projection, ctx: PolicyCtx): Frag {
  const parts: Frag[] = [];
  if (p.star) parts.push(raw("t.*"));
  for (const c of p.columns) parts.push(col("t", c));
  for (const e of p.embeds) {
    // One correlated subquery per embed keeps it to a single D1 query; the
    // embedded table's own select policy applies, like PostgREST + RLS.
    const pairs = join(e.columns.map((c) => sql`'${raw(c)}', ${col("m", c)}`), ", ");
    const policy = (policyFor(e.table.name).select || (() => FALSE))(refFor("m"), ctx);
    parts.push(
      sql`(SELECT COALESCE(json_group_array(json_object(${pairs})), '[]') FROM ${ident(e.table.name)} AS m WHERE ${col("m", e.foreignColumn)} = ${col("t", e.localColumn)} AND ${policy}) AS ${ident(e.name)}`,
    );
  }
  return join(parts, ", ");
}

function returningFrag(table: TableDef, p: Projection): Frag {
  if (p.star) return raw("*");
  return join(p.columns.map((c) => ident(c)), ", ");
}

function buildSelect(req: QueryRequest, ctx: PolicyCtx): Plan {
  const t = req.table;
  const policy = (policyFor(t.name).select || (() => FALSE))(refFor("t"), ctx);
  const where = and(filtersFrag(req, refFor("t")), policy);
  const order = req.order.length
    ? sql` ORDER BY ${join(req.order.map((o) => sql`${col("t", o.col)} ${raw(o.ascending ? "ASC NULLS LAST" : "DESC NULLS FIRST")}`), ", ")}`
    : raw("");
  // single/maybeSingle only need to know whether there are 0, 1 or >1 rows.
  let limit = req.limit ?? MAX_ROWS;
  if (req.single) limit = Math.min(limit, 2);
  return {
    kind: "select",
    stmt: sql`SELECT ${projectionFrag(t, req.projection, ctx)} FROM ${tableIdent(t)} AS t WHERE ${where}${order} LIMIT ${limit}`,
  };
}

// Columns written on insert: every client-supplied column plus generated
// ids and timestamps.
function insertRows(req: QueryRequest) {
  const t = req.table;
  const provided = [...new Set(req.rows.flatMap((r) => Object.keys(r)))];
  const generated = Object.entries(t.columns)
    .filter(([, d]) => d.generatedId || d.defaultNow || d.bumpOnWrite)
    .map(([name]) => name);
  const columns = [...new Set([...provided, ...generated])];
  const now = nowIso();
  const values = req.rows.map((row) =>
    columns.map((c) => {
      const def = t.columns[c];
      const v = row[c];
      if (def.bumpOnWrite) return now;
      if ((v === undefined || v === null) && def.generatedId) return newId();
      if ((v === undefined || v === null) && def.defaultNow) return now;
      return encodeValue(def, v, c);
    }),
  );
  return { provided, columns, values };
}

function buildInsert(req: QueryRequest, ctx: PolicyCtx): Plan {
  const t = req.table;
  const policy = policyFor(t.name);
  const { provided, columns, values } = insertRows(req);
  // The CTE carries every table column so a CHECK may reference any of them;
  // columns the caller didn't send are NULL there (the stored row gets the
  // column default instead). Only `columns` are actually inserted.
  const all = Object.keys(t.columns);
  const tuples = values.map((vals) =>
    sql`(${join(all.map((c) => (columns.includes(c) ? sql`${vals[columns.indexOf(c)]}` : raw("NULL"))), ", ")})`,
  );
  const cte = sql`WITH v(${join(all.map(ident), ", ")}) AS (VALUES ${join(tuples, ", ")})`;
  const insertCheck = (policy.insert || (() => FALSE))(refFor("w"), ctx);
  // All-or-nothing: if any proposed row fails WITH CHECK, insert none.
  const guards: Frag[] = [sql`NOT EXISTS (SELECT 1 FROM v AS w WHERE ${notOk(insertCheck)})`];
  let conflict = raw("");

  if (req.op === "upsert") {
    const conflictCols = req.onConflict;
    const setCols = [
      ...provided.filter((c) => !conflictCols.includes(c) && !t.columns[c].bumpOnWrite),
      ...columns.filter((c) => t.columns[c].bumpOnWrite),
    ];
    const userSet = provided.filter((c) => !conflictCols.includes(c) && !t.columns[c].bumpOnWrite);
    const rules = applicableUpdateRules(t.name, userSet);
    const e = refFor("e");
    const newRef: Ref = (c) => (setCols.includes(c) ? col("w", c) : col("e", c));
    const ok = or(...rules.map((r) => and(r.using(e, ctx), r.check(newRef, ctx))));
    const on = and(...conflictCols.map((c) => sql`${col("e", c)} = ${col("w", c)}`));
    // A conflicting existing row must pass an update rule (USING on the old
    // row + CHECK on the merged new row), else the whole upsert is refused.
    guards.push(sql`NOT EXISTS (SELECT 1 FROM v AS w JOIN ${tableIdent(t)} AS e ON ${on} WHERE ${notOk(ok)})`);
    const assignments = (setCols.length ? setCols : [conflictCols[0]]).map((c) => sql`${ident(c)} = excluded.${ident(c)}`);
    conflict = sql` ON CONFLICT(${join(conflictCols.map(ident), ", ")}) DO UPDATE SET ${join(assignments, ", ")}`;
  }

  const stmt = sql`${cte} INSERT INTO ${tableIdent(t)} (${join(columns.map(ident), ", ")}) SELECT ${join(columns.map((c) => col("v", c)), ", ")} FROM v WHERE ${and(...guards)}${conflict} RETURNING ${returningFrag(t, req.projection)}`;
  return { kind: "insert", stmt, expected: req.rows.length };
}

function buildUpdate(req: QueryRequest, ctx: PolicyCtx): Plan {
  const t = req.table;
  const patch = req.rows[0];
  const userSet = Object.keys(patch).filter((c) => !t.columns[c].bumpOnWrite);
  const now = nowIso();
  const setValues = new Map<string, unknown>(userSet.map((c) => [c, encodeValue(t.columns[c], patch[c], c)]));
  for (const [name, def] of Object.entries(t.columns)) if (def.bumpOnWrite) setValues.set(name, now);

  const rules = applicableUpdateRules(t.name, userSet);
  const usingAny = (ref: Ref) => or(...rules.map((r) => r.using(ref, ctx)));
  const ok = (ref: Ref) => {
    const newRef: Ref = (c) => (setValues.has(c) ? sql`${setValues.get(c)}` : ref(c));
    return or(...rules.map((r) => and(r.using(ref, ctx), r.check(newRef, ctx))));
  };
  const x = refFor("x");
  const violating = and(filtersFrag(req, x), usingAny(x), notOk(ok(x)));
  const violations = sql`SELECT count(*) AS n FROM ${tableIdent(t)} AS x WHERE ${violating}`;
  const assignments = [...setValues.entries()].map(([c, v]) => sql`${ident(c)} = ${v}`);
  const tRef = refFor("t");
  const where = and(filtersFrag(req, tRef), usingAny(tRef), sql`NOT EXISTS (SELECT 1 FROM ${tableIdent(t)} AS x WHERE ${violating})`);
  const stmt = sql`UPDATE ${tableIdent(t)} AS t SET ${join(assignments, ", ")} WHERE ${where} RETURNING ${returningFrag(t, req.projection)}`;
  return { kind: "update", violations, stmt };
}

function buildDelete(req: QueryRequest, ctx: PolicyCtx): Plan {
  const t = req.table;
  const tRef = refFor("t");
  const policy = (policyFor(t.name).delete || (() => FALSE))(tRef, ctx);
  const where = and(filtersFrag(req, tRef), policy);
  return {
    kind: "delete",
    stmt: sql`DELETE FROM ${tableIdent(t)} AS t WHERE ${where} RETURNING ${returningFrag(t, req.projection)}`,
  };
}

function assertParamBudget(plan: Plan) {
  const stmts = plan.kind === "update" ? [plan.violations, plan.stmt] : [plan.stmt];
  if (stmts.some((s) => s.params.length > MAX_PARAMS)) {
    throw new HttpError(400, "Request too large - send fewer rows or filter values at once.", "too_large");
  }
}

export function buildPlan(req: QueryRequest, ctx: PolicyCtx): Plan {
  const plan =
    req.op === "select" ? buildSelect(req, ctx)
    : req.op === "insert" || req.op === "upsert" ? buildInsert(req, ctx)
    : req.op === "update" ? buildUpdate(req, ctx)
    : buildDelete(req, ctx);
  assertParamBudget(plan);
  return plan;
}
