// Runs a query plan on D1 and shapes the result like PostgREST.
import { HttpError } from "../http";
import type { PolicyCtx } from "../policies";
import { type Plan, buildPlan } from "./builder";
import { type QueryRequest, decodeValue } from "./request";
import type { TableDef } from "./schema";
import type { Frag } from "./sql";

type Row = Record<string, unknown>;

const prepare = (db: D1Database, f: Frag) => db.prepare(f.sql).bind(...f.params);

export function rlsError(table: string): HttpError {
  return new HttpError(403, `new row violates row-level security policy for table "${table}"`, "42501");
}

/** Map SQLite constraint errors to Postgres-style codes + friendly text. */
export function mapDbError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  const msg = String((err as Error)?.message || err);
  if (msg.includes("at most two members")) return new HttpError(400, "A buddy pair can have at most two members", "P0001");
  const unique = /UNIQUE constraint failed: (\w+)\.(\w+)/.exec(msg);
  if (unique) {
    const friendly: Record<string, string> = {
      invite_code: "That invite code is already in use. Please try again.",
      client_user_id: "This account is already linked to a client profile.",
      client_id: "That client is already in a buddy pair.",
      name: "An entry with that name already exists.",
    };
    return new HttpError(409, friendly[unique[2]] || "That record already exists.", "23505");
  }
  if (msg.includes("UNIQUE constraint failed") || msg.includes("PRIMARY KEY")) {
    return new HttpError(409, "That record already exists.", "23505");
  }
  if (msg.includes("FOREIGN KEY constraint failed")) {
    return new HttpError(409, "That refers to a record that doesn't exist (or was deleted).", "23503");
  }
  const notNull = /NOT NULL constraint failed: \w+\.(\w+)/.exec(msg);
  if (notNull) return new HttpError(400, `Missing a value for '${notNull[1]}'.`, "23502");
  if (msg.includes("CHECK constraint failed")) return new HttpError(400, "One of the values isn't allowed.", "23514");
  console.error("D1 query failed", msg);
  return new HttpError(500, "Database error. Please try again.", "internal");
}

export function decodeRow(table: TableDef, row: Row, mergeExtra: boolean, embeds: QueryRequest["projection"]["embeds"] = []): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    const embed = embeds.find((e) => e.name === key);
    if (embed) {
      const list = typeof value === "string" ? (JSON.parse(value) as Row[]) : [];
      out[key] = list.map((r) => decodeRow(embed.table, r, false));
    } else if (Object.hasOwn(table.columns, key)) {
      out[key] = decodeValue(table.columns[key], value);
    } else {
      out[key] = value;
    }
  }
  // Postgres columns the migrator parked in `extra` come back as top-level
  // fields on `*` selects, the way v1 returned them. Real columns win.
  if (mergeExtra && table.extraColumn && out[table.extraColumn] && typeof out[table.extraColumn] === "object") {
    const extra = out[table.extraColumn] as Row;
    delete out[table.extraColumn];
    for (const [k, v] of Object.entries(extra)) if (!Object.hasOwn(out, k)) out[k] = v;
  }
  return out;
}

function applySingle(rows: Row[], mode: QueryRequest["single"]): unknown {
  if (!mode) return rows;
  if (rows.length === 1) return rows[0];
  if (rows.length === 0 && mode === "maybe") return null;
  throw new HttpError(406, "JSON object requested, multiple (or no) rows returned", "PGRST116");
}

async function runPlan(db: D1Database, plan: Plan, table: string): Promise<Row[]> {
  switch (plan.kind) {
    case "select":
    case "delete":
      return ((await prepare(db, plan.stmt).all<Row>()).results || []) as Row[];
    case "insert": {
      const rows = ((await prepare(db, plan.stmt).all<Row>()).results || []) as Row[];
      if (rows.length < plan.expected) throw rlsError(table);
      return rows;
    }
    case "update": {
      // One transaction: count rows the caller may target but whose new
      // values would fail WITH CHECK, then the guarded UPDATE (which is a
      // no-op whenever that count is non-zero).
      const [check, result] = await db.batch<Row>([prepare(db, plan.violations), prepare(db, plan.stmt)]);
      const n = Number((check.results?.[0] as Row | undefined)?.n || 0);
      if (n > 0) throw rlsError(table);
      return (result.results || []) as Row[];
    }
  }
}

export async function executeQuery(db: D1Database, req: QueryRequest, ctx: PolicyCtx): Promise<unknown> {
  const plan = buildPlan(req, ctx);
  let rows: Row[];
  try {
    rows = await runPlan(db, plan, req.table.name);
  } catch (err) {
    throw mapDbError(err);
  }
  if (!req.returning) return null;
  const decoded = rows.map((r) => decodeRow(req.table, r, req.projection.star, req.projection.embeds));
  return applySingle(decoded, req.single);
}
