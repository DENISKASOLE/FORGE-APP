// Test harness for the cutover route: a D1-like adapter over node:sqlite,
// an in-memory R2 bucket, and a fake read-only Supabase behind fetch.
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");

// Used only while the auth agent's 0002_auth.sql is absent from this tree.
const USERS_TEST_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  password_iterations INTEGER,
  email_verified_at TEXT,
  user_metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
`;

export class Counter {
  n = 0;
}

// ---------- D1 ----------
type Val = string | number | null;

function norm(v: unknown): Val {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string") return v;
  throw new Error(`Unsupported bind value: ${typeof v}`);
}

const isRead = (sql: string) => /^\s*(SELECT|WITH|PRAGMA)/i.test(sql) || /\bRETURNING\b/i.test(sql);

class Stmt {
  constructor(private d1: FakeD1, readonly sql: string, readonly params: Val[] = []) {}
  bind(...p: unknown[]) {
    return new Stmt(this.d1, this.sql, p.map(norm));
  }
  exec() {
    const st = this.d1.db.prepare(this.sql);
    if (isRead(this.sql)) {
      const results = st.all(...this.params) as Record<string, unknown>[];
      return { results, success: true, meta: { changes: 0 } };
    }
    const r = st.run(...this.params);
    return { results: [], success: true, meta: { changes: Number(r.changes) } };
  }
  async all() {
    this.d1.calls.n++;
    return this.exec();
  }
  async run() {
    this.d1.calls.n++;
    return this.exec();
  }
  async first(col?: string) {
    this.d1.calls.n++;
    const row = (this.exec().results[0] ?? null) as Record<string, unknown> | null;
    if (!row) return null;
    return col ? row[col] : row;
  }
}

export class FakeD1 {
  db: DatabaseSync;
  calls = new Counter();
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON;");
    // Load every real migration in order, exactly as D1 applies them.
    const dir = join(ROOT, "migrations");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
      this.db.exec(readFileSync(join(dir, f), "utf8"));
    }
    if (!existsSync(join(dir, "0002_auth.sql"))) this.db.exec(USERS_TEST_DDL);
  }
  prepare(sql: string) {
    return new Stmt(this, sql);
  }
  async batch(stmts: Stmt[]) {
    this.calls.n++;
    this.db.exec("BEGIN");
    try {
      const out = stmts.map((s) => s.exec());
      this.db.exec("COMMIT");
      return out;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }
  rows(sql: string, ...params: Val[]) {
    return this.db.prepare(sql).all(...params) as Record<string, unknown>[];
  }
}

// ---------- R2 ----------
export class FakeR2 {
  objects = new Map<string, { body: Uint8Array; contentType?: string }>();
  calls = new Counter();
  async head(key: string) {
    this.calls.n++;
    const o = this.objects.get(key);
    return o ? { key, size: o.body.byteLength } : null;
  }
  async put(key: string, body: ReadableStream | ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) {
    this.calls.n++;
    const bytes =
      body instanceof ReadableStream ? new Uint8Array(await new Response(body).arrayBuffer()) : new Uint8Array(body as ArrayBuffer);
    this.objects.set(key, { body: bytes, contentType: opts?.httpMetadata?.contentType });
    return { key, size: bytes.byteLength };
  }
  async get(key: string) {
    this.calls.n++;
    const o = this.objects.get(key);
    return o ? { body: new Response(o.body).body, size: o.body.byteLength } : null;
  }
  async list(opts: { prefix?: string; cursor?: string; limit?: number } = {}) {
    this.calls.n++;
    const keys = [...this.objects.keys()].filter((k) => k.startsWith(opts.prefix ?? "")).sort();
    const start = Number(opts.cursor ?? 0);
    const limit = opts.limit ?? 1000;
    const page = keys.slice(start, start + limit);
    const truncated = start + limit < keys.length;
    return {
      objects: page.map((key) => ({ key, size: this.objects.get(key)!.body.byteLength })),
      truncated,
      cursor: truncated ? String(start + limit) : undefined,
    };
  }
}

// ---------- Supabase ----------
export type Row = Record<string, unknown>;
export interface SupaState {
  tables: Record<string, Row[]>;
  users: Row[];
  buckets: Record<string, Record<string, { data: Uint8Array; mimetype: string }>>;
}

export const SERVICE_KEY = "service-role-key-for-tests";

function json(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function selectRow(row: Row, select: string): Row {
  if (select === "*") return { ...row };
  const out: Row = {};
  for (const part of select.split(",")) {
    const [col, cast] = part.split("::");
    const v = row[col];
    out[col] = cast === "text" && v != null && typeof v !== "string" ? JSON.stringify(v) : v;
  }
  return out;
}

function sortRows(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const cols = order.split(",").map((o) => o.split(".")[0]);
  return [...rows].sort((a, b) => {
    for (const c of cols) {
      const x = String(a[c]);
      const y = String(b[c]);
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  });
}

export class FakeSupabase {
  requests: { method: string; path: string }[] = [];
  calls = new Counter();
  failNext: number | null = null;
  constructor(public state: SupaState) {}

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    this.calls.n++;
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init.method ?? "GET").toUpperCase();
    this.requests.push({ method, path: url.pathname });
    const h = new Headers(init.headers);
    if (h.get("apikey") !== SERVICE_KEY || h.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
      return json({ message: "bad key" }, {}, 401);
    }
    if (this.failNext) {
      const status = this.failNext;
      this.failNext = null;
      return json({ message: "boom" }, {}, status);
    }
    const p = url.pathname;
    const q = url.searchParams;

    if (p.startsWith("/rest/v1/")) {
      const table = p.slice("/rest/v1/".length);
      const rows = this.state.tables[table];
      if (!rows) return json({ message: "no table" }, {}, 404);
      if (method === "HEAD") {
        const n = rows.length;
        return new Response(null, { status: 200, headers: { "Content-Range": n ? `0-${n - 1}/${n}` : `*/0` } });
      }
      if (method !== "GET") throw new Error(`write attempted: ${method} ${p}`);
      const sorted = sortRows(rows, q.get("order"));
      const offset = Number(q.get("offset") ?? 0);
      const limit = Number(q.get("limit") ?? 1000);
      return json(sorted.slice(offset, offset + limit).map((r) => selectRow(r, q.get("select") ?? "*")));
    }

    if (p === "/auth/v1/admin/users" && method === "GET") {
      const page = Number(q.get("page") ?? 1);
      const per = Number(q.get("per_page") ?? 50);
      const slice = this.state.users.slice((page - 1) * per, page * per);
      return json({ users: slice, aud: "authenticated" }, { "X-Total-Count": String(this.state.users.length) });
    }

    if (p.startsWith("/storage/v1/object/list/") && method === "POST") {
      const bucket = p.slice("/storage/v1/object/list/".length);
      const body = JSON.parse(String(init.body)) as { prefix: string; limit: number; offset: number };
      const objs = this.state.buckets[bucket] ?? {};
      const base = body.prefix ? `${body.prefix}/` : "";
      const entries = new Map<string, Row>();
      for (const [path, o] of Object.entries(objs)) {
        if (!path.startsWith(base)) continue;
        const rest = path.slice(base.length).split("/");
        if (rest.length > 1) entries.set(rest[0], { name: rest[0], id: null, metadata: null });
        else entries.set(rest[0], { name: rest[0], id: `id-${path}`, metadata: { size: o.data.byteLength, mimetype: o.mimetype } });
      }
      const list = [...entries.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return json(list.slice(body.offset, body.offset + body.limit));
    }

    if (p.startsWith("/storage/v1/object/") && method === "GET") {
      const [bucket, ...rest] = p.slice("/storage/v1/object/".length).split("/");
      const path = rest.map(decodeURIComponent).join("/");
      const o = this.state.buckets[bucket]?.[path];
      if (!o) return json({ statusCode: "404", error: "not_found" }, {}, 400);
      return new Response(o.data, { headers: { "Content-Type": o.mimetype, "Content-Length": String(o.data.byteLength) } });
    }

    throw new Error(`unexpected Supabase call: ${method} ${p}`);
  };
}

export const ADMIN_TOKEN = "t".repeat(40);

export function makeEnv(overrides: Record<string, unknown> = {}) {
  const DB = new FakeD1();
  const FILES = new FakeR2();
  const env = {
    DB,
    FILES,
    MIGRATION_ENABLED: "true",
    MIGRATION_ADMIN_TOKEN: ADMIN_TOKEN,
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    APP_ENV: "test",
    ...overrides,
  };
  return { env, DB, FILES };
}
