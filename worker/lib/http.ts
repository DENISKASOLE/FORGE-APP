import type { Context } from "hono";

// Every API error uses one envelope so the client shim can map it onto
// supabase-js's `{ data, error: { message, code } }` shape.
export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "error") {
    super(message);
  }
}

export function fail(c: Context, status: number, message: string, code = "error") {
  return c.json({ error: { message, code } }, status as 400);
}

export async function readJson<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body", "bad_json");
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}
