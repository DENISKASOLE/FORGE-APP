// Table steps: page through PostgREST, transform, upsert into D1 with one
// DB.batch() per page. Idempotent: re-running converges to the v1 rows, and
// no-op updates are skipped (keeps D1 row-write usage low on rehearsals).
import type { ColSpec } from "./transform";
import { isOversized, transformRow } from "./transform";
import type { StepContext, StepInput, StepResult } from "./types";
import { clampPageSize, parseOffsetCursor } from "./cursor";

export interface TableSpec {
  table: string;
  pk: string[];
  cols: ColSpec[];
  /** PostgREST select. Default "*". Explicit selects use ::text casts for big jsonb. */
  select?: string;
  /** Fold unknown v1 columns into the D1 `extra` JSON column. */
  extra?: boolean;
  defaultPageSize: number;
  maxPageSize: number;
}

const s = (name: string, def = ""): ColSpec => ({ name, type: "text", notNull: true, def });
const n = (name: string): ColSpec => ({ name, type: "text" });
const ts = (name: string): ColSpec => ({ name, type: "ts", notNull: true });

// Column sets mirror migrations/0001_core.sql. FK order matters.
export const TABLE_SPECS: TableSpec[] = [
  {
    table: "trainers",
    pk: ["id"],
    cols: [s("id"), s("email"), s("name"), s("role", "Coach"), s("phone"), s("photo"), ts("created_at")],
    defaultPageSize: 50,
    maxPageSize: 200,
  },
  {
    table: "clients",
    pk: ["id"],
    cols: [
      s("id"), n("trainer_id"), n("client_user_id"), s("name"), s("email"), s("phone"),
      { name: "age", type: "int", notNull: true, def: 0 },
      { name: "weight_kg", type: "real", notNull: true, def: 0 },
      s("goal"), s("injuries"), s("photo"), s("color"), n("invite_code"),
      s("invite_status", "not_sent"), ts("created_at"),
    ],
    extra: true,
    defaultPageSize: 50,
    maxPageSize: 200,
  },
  {
    // Rows can hold large JSON and legacy base64 photos: tiny pages, and the
    // jsonb comes back as text (PostgREST `col::text` cast) so the Worker
    // never parses/re-serialises the section body.
    table: "client_data",
    pk: ["client_id", "section"],
    cols: [s("client_id"), s("section"), { name: "data", type: "json", notNull: true, def: "{}", cast: true }, ts("updated_at")],
    select: "client_id,section,data::text,updated_at",
    defaultPageSize: 5,
    maxPageSize: 25,
  },
  {
    table: "trainer_data",
    pk: ["trainer_id", "section"],
    cols: [s("trainer_id"), s("section"), { name: "data", type: "json", notNull: true, def: "{}", cast: true }, ts("updated_at")],
    select: "trainer_id,section,data::text,updated_at",
    defaultPageSize: 50,
    maxPageSize: 100,
  },
  {
    table: "health_screenings",
    pk: ["id"],
    cols: [
      s("id"), s("client_id"), s("screening_version"),
      { name: "answers", type: "json", notNull: true, def: "{}" },
      { name: "needs_clearance", type: "bool", notNull: true, def: 0 },
      s("signed_name"), s("signature_path"), s("pdf_path"),
      { name: "consents", type: "json", notNull: true, def: "{}" },
      ts("signed_at"),
    ],
    defaultPageSize: 50,
    maxPageSize: 200,
  },
  {
    table: "buddy_pairs",
    pk: ["id"],
    cols: [s("id"), s("coach_id"), n("name"), n("slot_label"), { name: "price", type: "real" }, ts("created_at"), ts("updated_at")],
    defaultPageSize: 50,
    maxPageSize: 200,
  },
  {
    table: "buddy_members",
    pk: ["pair_id", "client_id"],
    cols: [s("pair_id"), s("client_id"), ts("joined_at")],
    defaultPageSize: 50,
    maxPageSize: 100,
  },
  {
    table: "exercise_library",
    pk: ["id"],
    cols: [
      s("id"), s("name"), n("muscle_group"), n("movement_pattern"),
      { name: "coaching_cues", type: "json", notNull: true, def: "[]" },
      { name: "needs_review", type: "bool", notNull: true, def: 0 },
    ],
    extra: true,
    defaultPageSize: 50,
    maxPageSize: 200,
  },
];

export const TABLE_NAMES = TABLE_SPECS.map((t) => t.table);

export function tableSpec(name: string): TableSpec | undefined {
  return TABLE_SPECS.find((t) => t.table === name);
}

/** INSERT ... ON CONFLICT(pk) DO UPDATE, skipping updates that change nothing. */
export function upsertSql(spec: TableSpec): string {
  const cols = spec.cols.map((c) => c.name);
  if (spec.extra) cols.push("extra");
  const updatable = cols.filter((c) => !spec.pk.includes(c));
  const placeholders = cols.map(() => "?").join(", ");
  const set = updatable.map((c) => `${c} = excluded.${c}`).join(", ");
  const changed = updatable.map((c) => `${spec.table}.${c} IS NOT excluded.${c}`).join(" OR ");
  return (
    `INSERT INTO ${spec.table} (${cols.join(", ")}) VALUES (${placeholders}) ` +
    `ON CONFLICT(${spec.pk.join(", ")}) DO UPDATE SET ${set} WHERE ${changed}`
  );
}

// buddy_members has a BEFORE INSERT "max two per pair" trigger in D1 that
// also fires for an upsert of an existing row, so it gets a plain
// "insert if missing" instead. A client that moved pair in v1 is removed
// from its old pair first (client_id is UNIQUE).
function buddyMemberStatements(db: D1Database, v: (string | number | null)[]): D1PreparedStatement[] {
  const [pairId, clientId, joinedAt] = v;
  return [
    db.prepare("DELETE FROM buddy_members WHERE client_id = ? AND pair_id <> ?").bind(clientId, pairId),
    db.prepare("UPDATE buddy_members SET joined_at = ? WHERE pair_id = ? AND client_id = ? AND joined_at IS NOT ?")
      .bind(joinedAt, pairId, clientId, joinedAt),
    db.prepare(
      "INSERT INTO buddy_members (pair_id, client_id, joined_at) SELECT ?, ?, ? " +
        "WHERE NOT EXISTS (SELECT 1 FROM buddy_members WHERE pair_id = ? AND client_id = ?)",
    ).bind(pairId, clientId, joinedAt, pairId, clientId),
  ];
}

export async function runTableStep(ctx: StepContext, spec: TableSpec, input: StepInput): Promise<StepResult> {
  const { env, sb, budget } = ctx;
  const offset = parseOffsetCursor(input.cursor);
  const limit = clampPageSize(input.pageSize, spec.defaultPageSize, spec.maxPageSize);
  const order = spec.pk.map((c) => `${c}.asc`).join(",");

  const rows = await sb.rest(spec.table, {
    select: spec.select ?? "*",
    order,
    limit: String(limit),
    offset: String(offset),
  });

  const warnings: string[] = [];
  const dropped = new Set<string>();
  const known = new Set(spec.cols.map((c) => c.name));
  const stmts: D1PreparedStatement[] = [];
  const prepared = spec.table === "buddy_members" ? null : env.DB.prepare(upsertSql(spec));

  for (const row of rows) {
    const { values, unknown } = transformRow(row, spec.cols, !!spec.extra, known);
    if (!spec.extra) for (const k of unknown) dropped.add(k);
    const pkLabel = spec.pk.map((k) => String(row[k])).join("/");
    if (values.some(isOversized)) {
      warnings.push(`${spec.table} ${pkLabel}: a value is over D1's 2 MB limit; row skipped (move base64 photos to storage in v1 and re-run)`);
      continue;
    }
    if (prepared) stmts.push(prepared.bind(...values));
    else stmts.push(...buddyMemberStatements(env.DB, values));
  }
  for (const k of dropped) {
    warnings.push(`${spec.table}: v1 column "${k}" has no D1 column and was dropped`);
  }

  if (stmts.length) {
    budget.use(1);
    await env.DB.batch(stmts);
  }

  const done = rows.length < limit;
  return {
    step: spec.table,
    done,
    nextCursor: done ? null : String(offset + rows.length),
    processed: rows.length,
    warnings,
  };
}
