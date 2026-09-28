// Test doubles for the files agent: a D1-like adapter over node:sqlite and an
// in-memory R2Bucket fake. Not production code.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const MIGRATIONS = ["migrations/0001_core.sql", "migrations/0004_files.sql"];

type Row = Record<string, unknown>;
const clean = (params: unknown[]) => params.map((p) => (p === undefined ? null : p)) as (string | number | null)[];

class FakeStatement {
  constructor(private db: DatabaseSync, private sql: string, private params: unknown[] = []) {}
  bind(...params: unknown[]) {
    return new FakeStatement(this.db, this.sql, params);
  }
  allSync(): Row[] {
    return this.db.prepare(this.sql).all(...clean(this.params)).map((r) => ({ ...(r as Row) }));
  }
  async first<T = Row>(col?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...clean(this.params)) as Row | undefined;
    if (!row) return null;
    return (col ? row[col] : { ...row }) as T;
  }
  async all<T = Row>() {
    return { results: this.allSync() as T[], success: true, meta: {} };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...clean(this.params));
    return { results: [], success: true, meta: { changes: Number(r.changes) } };
  }
}

export function makeD1() {
  const sqlite = new DatabaseSync(":memory:");
  for (const m of MIGRATIONS) sqlite.exec(readFileSync(root + m, "utf8"));
  const d1 = {
    prepare: (sql: string) => new FakeStatement(sqlite, sql),
    async batch(stmts: FakeStatement[]) {
      sqlite.exec("BEGIN");
      try {
        const out = stmts.map((s) => ({ results: s.allSync(), success: true, meta: {} }));
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
    async exec(sql: string) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
  return { d1: d1 as unknown as D1Database, sqlite };
}

async function readAll(value: unknown): Promise<Uint8Array> {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof ReadableStream) return new Uint8Array(await new Response(value).arrayBuffer());
  throw new Error("FakeR2: unsupported body");
}

interface Stored {
  bytes: Uint8Array;
  contentType?: string;
  etag: string;
  customMetadata?: Record<string, string>;
}

export function makeR2() {
  const objects = new Map<string, Stored>();
  const ops = { classA: 0, classB: 0 };
  let seq = 0;
  const meta = (key: string, o: Stored) => ({
    key,
    size: o.bytes.byteLength,
    etag: o.etag,
    httpEtag: `"${o.etag}"`,
    httpMetadata: { contentType: o.contentType },
    customMetadata: o.customMetadata ?? {},
  });
  const bucket = {
    objects,
    ops,
    async put(key: string, value: unknown, opts?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
      ops.classA++;
      const bytes = await readAll(value);
      const stored = { bytes, contentType: opts?.httpMetadata?.contentType, etag: `etag-${++seq}`, customMetadata: opts?.customMetadata };
      objects.set(key, stored);
      return meta(key, stored);
    },
    async get(key: string, opts?: { onlyIf?: Headers }) {
      ops.classB++;
      const o = objects.get(key);
      if (!o) return null;
      const inm = opts?.onlyIf instanceof Headers ? opts.onlyIf.get("If-None-Match") : null;
      if (inm && inm.replace(/"/g, "") === o.etag) return meta(key, o);
      return { ...meta(key, o), body: new Response(o.bytes).body };
    },
    async head(key: string) {
      ops.classB++;
      const o = objects.get(key);
      return o ? meta(key, o) : null;
    },
    async delete(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) objects.delete(k);
    },
  };
  return bucket;
}

export const SECRET = "test-secret-that-is-long-enough-000000";
export const COACH_EMAIL = "coach@forge.test";

export function makeEnv(overrides: Record<string, unknown> = {}) {
  const { d1, sqlite } = makeD1();
  const r2 = makeR2();
  seed(sqlite);
  const env = {
    DB: d1,
    FILES: r2 as unknown as R2Bucket,
    API_LIMITER: { limit: async () => ({ success: true }) },
    AI_LIMITER: { limit: async () => ({ success: true }) },
    AUTH_LIMITER: { limit: async () => ({ success: true }) },
    APP_ENV: "test",
    COACH_EMAIL,
    MAX_UPLOAD_BYTES: "1024",
    R2_SOFT_CAP_BYTES: "4096",
    FILE_URL_SECRET: SECRET,
    ...overrides,
  };
  return { env: env as never, sqlite, r2 };
}

// Coach "coach-1" owns c1 and c2; "coach-2" owns c4; c3 has no trainer.
export function seed(db: DatabaseSync) {
  db.exec(`
    INSERT INTO trainers (id, email) VALUES ('coach-1', '${COACH_EMAIL}'), ('coach-2', 'other@forge.test');
    INSERT INTO clients (id, trainer_id, client_user_id, invite_code) VALUES
      ('c1', 'coach-1', 'user-c1', 'i1'),
      ('c2', 'coach-1', 'user-c2', 'i2'),
      ('c3', NULL, 'user-c3', 'i3'),
      ('c4', 'coach-2', 'user-c4', 'i4');
  `);
}
