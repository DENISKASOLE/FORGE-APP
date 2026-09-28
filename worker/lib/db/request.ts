// Validation of the /api/db/query wire format. Everything that reaches the
// SQL builder has been checked against the schema whitelist here.
import { HttpError } from "../http";
import { type ColumnDef, type TableDef, TABLES, getTable, hasColumn } from "./schema";

export type Op = "select" | "insert" | "update" | "upsert" | "delete";
export type FilterOp = "eq" | "neq" | "in" | "is";

export interface Filter { col: string; op: FilterOp; value: unknown }
export interface Order { col: string; ascending: boolean }
export interface Embed { name: string; table: TableDef; localColumn: string; foreignColumn: string; columns: string[] }
export interface Projection { star: boolean; columns: string[]; embeds: Embed[] }

export interface QueryRequest {
  table: TableDef;
  op: Op;
  projection: Projection;
  filters: Filter[];
  rows: Record<string, unknown>[];
  onConflict: string[];
  order: Order[];
  limit: number | null;
  returning: boolean;
  single: "single" | "maybe" | null;
}

export const MAX_ROWS = 1000;
export const MAX_IN_VALUES = 100;
export const MAX_INSERT_ROWS = 50;

const OPS: readonly Op[] = ["select", "insert", "update", "upsert", "delete"];
const FILTER_OPS: readonly FilterOp[] = ["eq", "neq", "in", "is"];
const IDENT = /^[a-z_][a-z0-9_]*$/;

function bad(message: string, code = "PGRST100"): never {
  throw new HttpError(400, message, code);
}

function column(table: TableDef, name: unknown): string {
  if (!hasColumn(table, name)) {
    bad(`Could not find the '${String(name).slice(0, 64)}' column of '${table.name}'`, "PGRST204");
  }
  return name;
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) bad("Malformed select columns");
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (depth !== 0) bad("Malformed select columns");
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function parseProjection(table: TableDef, input: unknown, allowEmbeds: boolean): Projection {
  const text = input === undefined || input === null || input === "" ? "*" : input;
  if (typeof text !== "string" || text.length > 500) bad("Invalid select columns");
  const projection: Projection = { star: false, columns: [], embeds: [] };
  for (const part of splitTopLevel(text.replace(/\s+/g, " "))) {
    if (part === "*") {
      projection.star = true;
      continue;
    }
    const embed = /^([a-z_][a-z0-9_]*)\s*\((.*)\)$/.exec(part);
    if (embed) {
      if (!allowEmbeds) bad("Embedded resources are only supported on select");
      const rel = table.relations && Object.hasOwn(table.relations, embed[1]) ? table.relations[embed[1]] : null;
      if (!rel) bad(`Could not find a relationship between '${table.name}' and '${embed[1].slice(0, 64)}'`, "PGRST200");
      const target = TABLES[rel.table];
      const inner = splitTopLevel(embed[2]);
      const columns = inner.length === 0 || inner.includes("*") ? Object.keys(target.columns) : inner.map((c) => column(target, c));
      if (!projection.embeds.some((e) => e.name === embed[1])) {
        projection.embeds.push({ name: embed[1], table: target, localColumn: rel.localColumn, foreignColumn: rel.foreignColumn, columns });
      }
      continue;
    }
    if (!IDENT.test(part)) bad(`Invalid select column '${part.slice(0, 64)}'`);
    const name = column(table, part);
    if (!projection.columns.includes(name)) projection.columns.push(name);
  }
  if (!projection.star && !projection.columns.length && !projection.embeds.length) projection.star = true;
  return projection;
}

function parseFilters(table: TableDef, input: unknown): Filter[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > 20) bad("Invalid filters");
  return input.map((f): Filter => {
    if (!f || typeof f !== "object") bad("Invalid filter");
    const { col, op, value } = f as Record<string, unknown>;
    const name = column(table, col);
    if (!FILTER_OPS.includes(op as FilterOp)) bad(`Unsupported filter operator '${String(op).slice(0, 16)}'`);
    if (op === "in") {
      if (!Array.isArray(value) || value.length > MAX_IN_VALUES) bad(`'in' filter needs an array of at most ${MAX_IN_VALUES} values`);
      value.forEach(assertScalar);
    } else if (op === "is") {
      if (value !== null && value !== true && value !== false) bad("'is' filter only accepts null, true or false");
    } else {
      assertScalar(value);
    }
    return { col: name, op: op as FilterOp, value };
  });
}

function assertScalar(value: unknown) {
  const t = typeof value;
  if (value !== null && t !== "string" && t !== "number" && t !== "boolean") bad("Filter values must be scalars");
  if (t === "number" && !Number.isFinite(value)) bad("Filter values must be finite numbers");
}

function parseRows(table: TableDef, op: Op, input: unknown): Record<string, unknown>[] {
  if (op === "select" || op === "delete") return [];
  const list = Array.isArray(input) ? input : [input];
  if (op === "update" && Array.isArray(input)) bad("update takes a single object of values");
  if (!list.length || list.length > MAX_INSERT_ROWS) bad(`Provide between 1 and ${MAX_INSERT_ROWS} rows`);
  return list.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) bad("Each row must be an object");
    const keys = Object.keys(row);
    if (!keys.length && op === "update") bad("update needs at least one column");
    keys.forEach((k) => column(table, k));
    return row as Record<string, unknown>;
  });
}

function parseOrder(table: TableDef, input: unknown): Order[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > 5) bad("Invalid order");
  return input.map((o) => {
    if (!o || typeof o !== "object") bad("Invalid order");
    const { col, ascending } = o as Record<string, unknown>;
    return { col: column(table, col), ascending: ascending !== false };
  });
}

function parseConflict(table: TableDef, op: Op, input: unknown): string[] {
  if (op !== "upsert") return [];
  if (input === undefined || input === null || input === "") return [...table.primaryKey];
  if (typeof input !== "string") bad("onConflict must be a comma-separated string");
  const cols = input.split(",").map((c) => column(table, c.trim()));
  const target = table.conflictTargets.find((t) => t.length === cols.length && t.every((c) => cols.includes(c)));
  if (!target) bad(`There is no unique constraint matching the ON CONFLICT specification`, "42P10");
  return [...target];
}

export function parseRequest(body: unknown): QueryRequest {
  if (!body || typeof body !== "object") bad("Invalid request body");
  const b = body as Record<string, unknown>;
  const table = getTable(b.table);
  if (!table) bad(`Could not find the table '${String(b.table).slice(0, 64)}'`, "PGRST205");
  if (!OPS.includes(b.op as Op)) bad("Unsupported op");
  const op = b.op as Op;
  const filters = parseFilters(table, b.filters);
  if ((op === "update" || op === "delete") && !filters.length) {
    bad(`${op.toUpperCase()} requires a WHERE clause`, "21000");
  }
  let limit: number | null = null;
  if (b.limit !== undefined && b.limit !== null) {
    if (!Number.isInteger(b.limit) || (b.limit as number) < 0 || (b.limit as number) > MAX_ROWS) bad("Invalid limit");
    limit = b.limit as number;
  }
  const single = b.single === "single" || b.single === "maybe" ? b.single : null;
  if (b.single !== undefined && b.single !== null && !single) bad("Invalid single mode");
  return {
    table,
    op,
    projection: parseProjection(table, b.columns, op === "select"),
    filters,
    rows: parseRows(table, op, b.values),
    onConflict: parseConflict(table, op, b.onConflict),
    order: op === "select" ? parseOrder(table, b.order) : [],
    limit,
    returning: op === "select" || b.returning === true || !!single,
    single,
  };
}

/** Encode a JS value for a column (JSON text, 0/1 booleans, scalars). */
export function encodeValue(def: ColumnDef, value: unknown, name: string): unknown {
  if (value === undefined) return null;
  if (def.type === "json") return JSON.stringify(value);
  if (value === null) return null;
  if (def.type === "bool") {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value === 0 || value === 1) return value;
    bad(`Column '${name}' expects a boolean`, "22P02");
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) bad(`Column '${name}' got a non-finite number`, "22P02");
    return value;
  }
  if (typeof value === "string") {
    if ((def.type === "int" || def.type === "real") && value.trim() !== "" && !Number.isFinite(Number(value))) {
      bad(`Invalid number for column '${name}'`, "22P02");
    }
    return value;
  }
  bad(`Column '${name}' expects a scalar value`, "22P02");
}

/** Decode a stored value back to the shape Postgres/PostgREST returned. */
export function decodeValue(def: ColumnDef, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (def.type === "bool") return value === 1 || value === true || value === "1";
  if (def.type === "json" && typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
