// Test harness: a real SQLite (Node 24 node:sqlite) loaded with
// migrations/0001_core.sql behind a tiny D1-shaped adapter, plus seed data
// for the coach / own client / other client / stranger policy matrix.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { AuthUser } from "../../worker/lib/env";
import { executeQuery } from "../../worker/lib/db/execute";
import { parseRequest } from "../../worker/lib/db/request";

const MIGRATION = readFileSync(fileURLToPath(new URL("../../migrations/0001_core.sql", import.meta.url)), "utf8");
export const COACH_EMAIL = "coach@example.com";

class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private params: unknown[] = []) {}
  bind(...params: unknown[]) {
    return new Stmt(this.db, this.sql, params);
  }
  private prepared() {
    return this.db.prepare(this.sql);
  }
  async all() {
    return { results: this.prepared().all(...(this.params as never[])), success: true, meta: {} };
  }
  async first(col?: string) {
    const row = this.prepared().get(...(this.params as never[])) as Record<string, unknown> | undefined;
    if (!row) return null;
    return col ? row[col] : row;
  }
  async run() {
    const r = this.prepared().run(...(this.params as never[]));
    return { success: true, results: [], meta: { changes: Number(r.changes) } };
  }
  allSync() {
    return this.prepared().all(...(this.params as never[]));
  }
}

export class FakeD1 {
  constructor(public raw: DatabaseSync) {}
  prepare(sql: string) {
    return new Stmt(this.raw, sql);
  }
  async batch(stmts: Stmt[]) {
    this.raw.exec("BEGIN");
    try {
      const out = stmts.map((s) => ({ results: s.allSync(), success: true, meta: {} }));
      this.raw.exec("COMMIT");
      return out;
    } catch (e) {
      this.raw.exec("ROLLBACK");
      throw e;
    }
  }
}

export function makeDb(): FakeD1 {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  raw.exec(MIGRATION);
  return new FakeD1(raw);
}

const user = (id: string, email: string, email_verified = true): AuthUser => ({ id, email, email_verified, user_metadata: {} });

export const USERS = {
  coach: user("u-coach", COACH_EMAIL),
  coach2: user("u-coach2", "other-coach@example.com"),
  clientA: user("u-a", "a@example.com"),
  clientB: user("u-b", "b@example.com"),
  stranger: user("u-stranger", "nobody@example.com"),
  unverifiedCoach: user("u-fake-coach", COACH_EMAIL, false),
};
export type Actor = keyof typeof USERS;

export function seed(db: FakeD1) {
  db.raw.exec(`
    INSERT INTO trainers (id, email, name) VALUES ('u-coach', '${COACH_EMAIL}', 'Coach'), ('u-coach2', 'other-coach@example.com', 'Coach 2');
    INSERT INTO clients (id, trainer_id, client_user_id, name, email, invite_code, invite_status, extra, created_at) VALUES
      ('ca', 'u-coach', 'u-a', 'Alice', 'a@example.com', 'CODEA', 'accepted', '{"notes":"legacy note","name":"ignored"}', '2026-01-01T00:00:00.000Z'),
      ('cb', 'u-coach', 'u-b', 'Bob', 'b@example.com', 'CODEB', 'accepted', '{}', '2026-01-02T00:00:00.000Z'),
      ('cc', 'u-coach', NULL, 'Cara', 'cara@example.com', 'CODEC', 'sent', '{}', '2026-01-03T00:00:00.000Z'),
      ('cx', 'u-coach2', NULL, 'Xavier', 'x@example.com', 'CODEX', 'sent', '{}', '2026-01-04T00:00:00.000Z');
    INSERT INTO client_data (client_id, section, data) VALUES
      ('ca', 'profile', '{"goal":"A"}'), ('ca', 'transformPhotos', '[]'),
      ('cb', 'profile', '{"goal":"B"}'), ('cx', 'profile', '{"goal":"X"}');
    INSERT INTO trainer_data (trainer_id, section, data) VALUES
      ('u-coach', 'articles', '{"articles":[1]}'), ('u-coach', 'templates', '{"templates":[]}'),
      ('u-coach', 'calendar', '{"bookings":[]}'), ('u-coach', 'checkin_template', '{}'),
      ('u-coach2', 'articles', '{"articles":[2]}');
    INSERT INTO health_screenings (id, client_id, screening_version, answers, needs_clearance, signed_name, signature_path, pdf_path, consents, signed_at)
      VALUES ('hs1', 'ca', 'v1', '{"q1":true}', 1, 'Alice', 'ca/hs1/signature.png', 'ca/hs1/screening.pdf', '{"c":true}', '2026-02-01T00:00:00.000Z');
    INSERT INTO buddy_pairs (id, coach_id, name, price) VALUES ('p1', 'u-coach', 'AB', 100), ('px', 'u-coach2', 'X', 50);
    INSERT INTO buddy_members (pair_id, client_id) VALUES ('p1', 'ca'), ('p1', 'cb');
    INSERT INTO exercise_library (id, name, muscle_group, coaching_cues, needs_review) VALUES ('e1', 'Squat', 'Quads', '["brace","knees out"]', 1);
  `);
}

export function freshDb() {
  const db = makeDb();
  seed(db);
  return db;
}

export interface Outcome {
  data: any;
  error: null | { status: number; message: string; code: string };
}

/** Runs a wire-format query as `actor` directly through the executor. */
export async function query(db: FakeD1, actor: Actor, body: Record<string, unknown>): Promise<Outcome> {
  try {
    const data = await executeQuery(db as unknown as D1Database, parseRequest(body), { user: USERS[actor], coachEmail: COACH_EMAIL });
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: { status: e.status, message: e.message, code: e.code } };
  }
}

export function rows(db: FakeD1, sql: string, ...params: unknown[]): any[] {
  return db.raw.prepare(sql).all(...(params as never[]));
}
