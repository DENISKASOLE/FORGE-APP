// migration_log helpers (table from migrations/0006_migration.sql).
import { nowIso } from "../http";
import type { Budget } from "./budget";

export function logSetStatement(db: D1Database, key: string, value: unknown): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO migration_log (key, value, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(key, JSON.stringify(value), nowIso());
}

export async function logSet(db: D1Database, budget: Budget, key: string, value: unknown): Promise<void> {
  budget.use(1);
  await logSetStatement(db, key, value).run();
}

export async function logGet<T = unknown>(db: D1Database, budget: Budget, key: string): Promise<T | null> {
  budget.use(1);
  const row = await db
    .prepare("SELECT value FROM migration_log WHERE key = ?")
    .bind(key)
    .first<{ value: string | null }>();
  if (!row || row.value == null) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}
