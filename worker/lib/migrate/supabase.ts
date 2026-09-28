// READ-ONLY Supabase client for the cutover. It only issues GET/HEAD, plus
// POST /storage/v1/object/list (Supabase's list API is a read that happens
// to use POST). Nothing here may create, update or delete anything in v1.
import { HttpError } from "../http";
import type { Env } from "../env";
import type { Budget } from "./budget";
import type { Row } from "./types";

export interface StorageEntry {
  name: string;
  id: string | null; // null => folder
  metadata: { size?: number; mimetype?: string } | null;
}

export interface AuthUserRecord {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export class SupabaseReader {
  private readonly base: string;

  constructor(url: string, private readonly key: string, private readonly budget: Budget) {
    this.base = url.replace(/\/+$/, "");
  }

  static fromEnv(env: Env, budget: Budget): SupabaseReader {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !/^https:\/\//.test(url) || !key) {
      throw new HttpError(503, "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured", "not_configured");
    }
    return new SupabaseReader(url, key, budget);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: this.key, Authorization: `Bearer ${this.key}`, ...extra };
  }

  private async send(what: string, url: string, init: RequestInit): Promise<Response> {
    this.budget.use(1);
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw new HttpError(503, `Supabase ${what} failed: network error`, "supabase_unavailable");
    }
    if (res.ok) return res;
    const snippet = (await res.text().catch(() => "")).slice(0, 200);
    // 429/5xx are worth retrying (503); anything else is a real problem (502).
    const retryable = res.status === 429 || res.status >= 500;
    throw new HttpError(
      retryable ? 503 : 502,
      `Supabase ${what} failed: HTTP ${res.status} ${snippet}`,
      retryable ? "supabase_unavailable" : "supabase_error",
    );
  }

  /** PostgREST GET /rest/v1/<table>?<query>. */
  async rest(table: string, query: Record<string, string>): Promise<Row[]> {
    const qs = new URLSearchParams(query).toString();
    const res = await this.send(`read ${table}`, `${this.base}/rest/v1/${table}?${qs}`, {
      method: "GET",
      headers: this.headers({ Accept: "application/json" }),
    });
    const body = await res.json();
    if (!Array.isArray(body)) throw new HttpError(502, `Supabase read ${table}: unexpected response`, "supabase_error");
    return body as Row[];
  }

  /** Exact row count via HEAD + Prefer: count=exact (reads Content-Range). */
  async count(table: string, select: string): Promise<number> {
    const res = await this.send(`count ${table}`, `${this.base}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
      method: "HEAD",
      headers: this.headers({ Prefer: "count=exact" }),
    });
    const range = res.headers.get("Content-Range") ?? "";
    const total = Number(range.split("/")[1]);
    if (!Number.isFinite(total)) throw new HttpError(502, `Supabase count ${table}: no Content-Range`, "supabase_error");
    return total;
  }

  /** GoTrue admin list. total comes from X-Total-Count when present. */
  async authUsers(page: number, perPage: number): Promise<{ users: AuthUserRecord[]; total: number | null }> {
    const res = await this.send("auth users", `${this.base}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      method: "GET",
      headers: this.headers({ Accept: "application/json" }),
    });
    const body = (await res.json()) as { users?: AuthUserRecord[] };
    const totalHeader = res.headers.get("X-Total-Count");
    const total = totalHeader != null && totalHeader !== "" ? Number(totalHeader) : null;
    return { users: Array.isArray(body.users) ? body.users : [], total: Number.isFinite(total) ? total : null };
  }

  /** One level of a bucket listing. Folders come back with id === null. */
  async listObjects(bucket: string, prefix: string, limit: number, offset: number): Promise<StorageEntry[]> {
    const res = await this.send(`list ${bucket}/${prefix}`, `${this.base}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const body = await res.json();
    if (!Array.isArray(body)) throw new HttpError(502, `Supabase list ${bucket}: unexpected response`, "supabase_error");
    return body as StorageEntry[];
  }

  /** Streams an object. Returns null when it vanished since it was listed. */
  async download(bucket: string, path: string): Promise<Response | null> {
    try {
      return await this.send(`download ${bucket}/${path}`, `${this.base}/storage/v1/object/${bucket}/${encodePath(path)}`, {
        method: "GET",
        headers: this.headers(),
      });
    } catch (err) {
      if (err instanceof HttpError && err.status === 502 && /HTTP (400|404)/.test(err.message)) return null;
      throw err;
    }
  }
}
