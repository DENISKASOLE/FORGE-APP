// Test-only: a tiny D1 look-alike over Node's built-in `node:sqlite`, loaded
// with the real migration SQL. Mimics prepare().bind().first()/all()/run().

const MIGRATIONS = ["0001_core.sql", "0002_auth.sql"];

function nodeBuiltin(name: string): any {
  return (globalThis as any).process.getBuiltinModule(name);
}

class Statement {
  constructor(private readonly db: any, private readonly sql: string, private readonly params: unknown[] = []) {}

  bind(...params: unknown[]): Statement {
    return new Statement(this.db, this.sql, params.map((p) => (p === undefined ? null : p)));
  }

  async first<T = unknown>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params);
    if (!row) return null;
    const plain = { ...row };
    return (column ? plain[column] : plain) as T;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: true }> {
    const rows = this.db.prepare(this.sql).all(...this.params).map((r: object) => ({ ...r }));
    return { results: rows as T[], success: true };
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    const info = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(info.changes) } };
  }
}

export interface TestD1 {
  d1: D1Database;
  raw: any; // the DatabaseSync, for direct assertions
}

export function createTestD1(): TestD1 {
  const { DatabaseSync } = nodeBuiltin("node:sqlite");
  const fs = nodeBuiltin("node:fs");
  const path = nodeBuiltin("node:path");
  const url = nodeBuiltin("node:url");
  const here = path.dirname(url.fileURLToPath((import.meta as any).url));
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON;");
  for (const file of MIGRATIONS) {
    raw.exec(fs.readFileSync(path.join(here, "../../../migrations", file), "utf8"));
  }
  const d1 = { prepare: (sql: string) => new Statement(raw, sql) } as unknown as D1Database;
  return { d1, raw };
}
