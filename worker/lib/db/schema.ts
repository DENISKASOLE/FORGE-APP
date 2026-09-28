// Whitelist of every table and column the /api/db query API may touch,
// mirrored from migrations/0001_core.sql. Client-supplied identifiers are
// only ever used as lookup keys into these maps; the SQL text is built from
// the strings defined here, never from request input.

export type ColumnType = "text" | "int" | "real" | "json" | "bool";

export interface ColumnDef {
  type: ColumnType;
  /** Filled with a fresh uuid on insert when missing or null. */
  generatedId?: boolean;
  /** Filled with the current ISO timestamp on insert when missing or null. */
  defaultNow?: boolean;
  /** Always set to now on insert/update/upsert (server-managed). */
  bumpOnWrite?: boolean;
}

export interface TableDef {
  name: string;
  columns: Record<string, ColumnDef>;
  primaryKey: readonly string[];
  /** Column sets that are valid `onConflict` targets (PK or UNIQUE). */
  conflictTargets: readonly (readonly string[])[];
  /** Column holding migrated Postgres columns this schema lacks (JSON). */
  extraColumn?: string;
  /** One-to-many relations that can be embedded in a select ("rel(cols)"). */
  relations?: Record<string, { table: string; localColumn: string; foreignColumn: string }>;
}

const text: ColumnDef = { type: "text" };
const json: ColumnDef = { type: "json" };
const now: ColumnDef = { type: "text", defaultNow: true };
const id: ColumnDef = { type: "text", generatedId: true };

export const TABLES: Record<string, TableDef> = {
  trainers: {
    name: "trainers",
    columns: { id: text, email: text, name: text, role: text, phone: text, photo: text, created_at: now },
    primaryKey: ["id"],
    conflictTargets: [["id"]],
  },
  clients: {
    name: "clients",
    columns: {
      id, trainer_id: text, client_user_id: text, name: text, email: text, phone: text,
      age: { type: "int" }, weight_kg: { type: "real" }, goal: text, injuries: text, photo: text,
      color: text, invite_code: text, invite_status: text, extra: json, created_at: now,
    },
    primaryKey: ["id"],
    conflictTargets: [["id"], ["client_user_id"], ["invite_code"]],
    extraColumn: "extra",
  },
  client_data: {
    name: "client_data",
    columns: { client_id: text, section: text, data: json, updated_at: { type: "text", bumpOnWrite: true } },
    primaryKey: ["client_id", "section"],
    conflictTargets: [["client_id", "section"]],
  },
  trainer_data: {
    name: "trainer_data",
    columns: { trainer_id: text, section: text, data: json, updated_at: { type: "text", bumpOnWrite: true } },
    primaryKey: ["trainer_id", "section"],
    conflictTargets: [["trainer_id", "section"]],
  },
  health_screenings: {
    name: "health_screenings",
    columns: {
      id, client_id: text, screening_version: text, answers: json, needs_clearance: { type: "bool" },
      signed_name: text, signature_path: text, pdf_path: text, consents: json, signed_at: now,
    },
    primaryKey: ["id"],
    conflictTargets: [["id"]],
  },
  buddy_pairs: {
    name: "buddy_pairs",
    columns: {
      id, coach_id: text, name: text, slot_label: text, price: { type: "real" },
      created_at: now, updated_at: now,
    },
    primaryKey: ["id"],
    conflictTargets: [["id"]],
    relations: { buddy_members: { table: "buddy_members", localColumn: "id", foreignColumn: "pair_id" } },
  },
  buddy_members: {
    name: "buddy_members",
    columns: { pair_id: text, client_id: text, joined_at: now },
    primaryKey: ["pair_id", "client_id"],
    conflictTargets: [["pair_id", "client_id"], ["client_id"]],
  },
  exercise_library: {
    name: "exercise_library",
    columns: {
      id, name: text, muscle_group: text, movement_pattern: text, coaching_cues: json,
      needs_review: { type: "bool" }, extra: json,
    },
    primaryKey: ["id"],
    conflictTargets: [["id"], ["name"]],
    extraColumn: "extra",
  },
};

export function getTable(name: unknown): TableDef | null {
  if (typeof name !== "string" || !Object.hasOwn(TABLES, name)) return null;
  return TABLES[name];
}

export function hasColumn(table: TableDef, col: unknown): col is string {
  return typeof col === "string" && Object.hasOwn(table.columns, col);
}
