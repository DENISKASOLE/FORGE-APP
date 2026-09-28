import { HttpError } from "../http";

export function parseOffsetCursor(cursor: string | null, min = 0): number {
  if (cursor == null || cursor === "") return min;
  const n = Number(cursor);
  if (!Number.isInteger(n) || n < min) throw new HttpError(400, "Invalid cursor", "bad_cursor");
  return n;
}

export function clampPageSize(requested: number | undefined, def: number, max: number): number {
  if (requested == null) return def;
  return Math.max(1, Math.min(max, Math.trunc(requested)));
}

export function parseJsonCursor<T>(cursor: string | null, fallback: T, isValid: (v: unknown) => v is T): T {
  if (cursor == null || cursor === "") return fallback;
  let v: unknown;
  try {
    v = JSON.parse(cursor);
  } catch {
    throw new HttpError(400, "Invalid cursor", "bad_cursor");
  }
  if (!isValid(v)) throw new HttpError(400, "Invalid cursor", "bad_cursor");
  return v;
}
