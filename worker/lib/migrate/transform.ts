// Postgres (as PostgREST renders it) -> D1 value transforms.
// jsonb/arrays -> JSON text, boolean -> 0/1, timestamptz -> ISO-8601 UTC,
// numeric -> number. Kept allocation-light: big JSON never gets re-parsed.
import { nowIso } from "../http";
import type { Row } from "./types";

export type ColType = "text" | "int" | "real" | "bool" | "json" | "ts";

export interface ColSpec {
  name: string;
  type: ColType;
  /** Column is NOT NULL in D1; `def` is used when the source value is null/missing. */
  notNull?: boolean;
  def?: string | number;
  /** json only: PostgREST was asked for `<col>::text`, so the value is already JSON text. */
  cast?: boolean;
}

/** D1 rejects any string/row over 2,000,000 bytes. Leave room for the rest of the row. */
export const MAX_VALUE_BYTES = 1_900_000;

export function toText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function toReal(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toBool(v: unknown): 0 | 1 | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return v ? 1 : 0;
  if (typeof v === "string") return /^(t|true|1|yes|y|on)$/i.test(v.trim()) ? 1 : 0;
  return null;
}

/** `alreadyText`: the value came from a `::text` cast and is JSON text already. */
export function toJsonText(v: unknown, alreadyText = false): string | null {
  if (v == null) return null;
  if (alreadyText && typeof v === "string") return v;
  return JSON.stringify(v);
}

export function toIsoTs(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") {
    const d = new Date(v as number);
    return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
  }
  let d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    // "2026-08-26 10:52:30.123456+00" style: normalise separator, fraction, offset.
    const fixed = v
      .replace(" ", "T")
      .replace(/(\.\d{3})\d+/, "$1")
      .replace(/([+-]\d{2})$/, "$1:00");
    d = new Date(fixed);
  }
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

export function convert(col: ColSpec, raw: unknown): string | number | null {
  let v: string | number | null;
  switch (col.type) {
    case "text": v = toText(raw); break;
    case "int": v = toInt(raw); break;
    case "real": v = toReal(raw); break;
    case "bool": v = toBool(raw); break;
    case "json": v = toJsonText(raw, col.cast); break;
    case "ts": v = toIsoTs(raw); break;
  }
  if (v == null && col.notNull) {
    if (col.type === "ts") return nowIso();
    return col.def ?? (col.type === "text" ? "" : 0);
  }
  return v;
}

/** Cheap size check: only encode strings that could possibly be too big. */
export function isOversized(v: unknown): boolean {
  if (typeof v !== "string" || v.length * 3 <= MAX_VALUE_BYTES) return false;
  if (v.length > MAX_VALUE_BYTES) return true;
  return new TextEncoder().encode(v).length > MAX_VALUE_BYTES;
}

export interface TransformedRow {
  values: (string | number | null)[];
  /** Source keys the D1 table has no column for. */
  unknown: string[];
}

/**
 * Maps one source row onto the spec's columns (in order). When `extraCol`
 * is set, unknown source keys are folded into that column as a JSON object
 * and appended as the last value.
 */
export function transformRow(row: Row, cols: ColSpec[], extraCol: boolean, known: Set<string>): TransformedRow {
  const values = cols.map((c) => convert(c, row[c.name]));
  const unknown: string[] = [];
  let extra: Record<string, unknown> | null = null;
  for (const key in row) {
    if (known.has(key)) continue;
    unknown.push(key);
    if (extraCol) (extra ??= {})[key] = row[key];
  }
  if (extraCol) values.push(extra ? JSON.stringify(extra) : "{}");
  return { values, unknown };
}
