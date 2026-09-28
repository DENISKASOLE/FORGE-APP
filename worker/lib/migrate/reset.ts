// reset-app-data: wipe the migrated app tables in D1 so a final run starts
// clean. Does NOT touch users (password or not; the users step is an
// idempotent upsert and prune removes deleted ones), payments, R2, or the
// email:<id> records (so nobody gets a second password-setup email).
import { HttpError } from "../http";
import type { Budget } from "./budget";

export const RESET_CONFIRM = "WIPE D1 APP DATA";

// Children before parents so no FK cascade is relied on.
export const RESET_TABLES = [
  "buddy_members",
  "buddy_pairs",
  "health_screenings",
  "client_data",
  "trainer_data",
  "clients",
  "trainers",
  "exercise_library",
] as const;

export async function resetAppData(db: D1Database, budget: Budget): Promise<{ deleted: Record<string, number> }> {
  // payments rows reference clients in v2; wiping clients would take real
  // payment records with them. Only allowed while payments is empty.
  budget.use(1);
  const hasPayments = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'payments'")
    .first<{ name: string }>();
  if (hasPayments) {
    budget.use(1);
    const row = await db.prepare("SELECT count(*) AS n FROM payments").first<{ n: number }>();
    if (Number(row?.n ?? 0) > 0) {
      throw new HttpError(409, "payments has rows; reset-app-data is only allowed before go-live", "has_payments");
    }
  }

  budget.use(1);
  const results = await db.batch([
    ...RESET_TABLES.map((t) => db.prepare(`DELETE FROM ${t}`)),
    db.prepare("DELETE FROM migration_log WHERE key LIKE 'step:%' OR key LIKE 'bucketcount:%' OR key = 'verify:last'"),
  ]);
  const deleted: Record<string, number> = {};
  RESET_TABLES.forEach((t, i) => {
    deleted[t] = Number(results[i]?.meta?.changes ?? 0);
  });
  return { deleted };
}
