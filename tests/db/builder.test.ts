// SQL builder: whitelisting, injection attempts, parameter binding, and the
// PostgREST-compatible result shapes.
import { beforeEach, describe, expect, it } from "vitest";
import { buildPlan, MAX_PARAMS } from "../../worker/lib/db/builder";
import { parseRequest } from "../../worker/lib/db/request";
import { COACH_EMAIL, type FakeD1, USERS, freshDb, query, rows } from "./helpers";

const ctx = { user: USERS.coach, coachEmail: COACH_EMAIL };
const plan = (body: object) => buildPlan(parseRequest(body), ctx);
const parseError = (body: object) => {
  try {
    parseRequest(body);
    return null;
  } catch (e: any) {
    return e.code;
  }
};

describe("whitelisting", () => {
  it("rejects unknown tables, columns and operators", () => {
    expect(parseError({ table: "users", op: "select" })).toBe("PGRST205");
    expect(parseError({ table: "sqlite_master", op: "select" })).toBe("PGRST205");
    expect(parseError({ table: "__proto__", op: "select" })).toBe("PGRST205");
    expect(parseError({ table: "clients", op: "drop" })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", filters: [{ col: "password", op: "eq", value: 1 }] })).toBe("PGRST204");
    expect(parseError({ table: "clients", op: "select", filters: [{ col: "id", op: "like", value: "%" }] })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", order: [{ col: "constructor" }] })).toBe("PGRST204");
    expect(parseError({ table: "clients", op: "insert", values: { hacked: 1 } })).toBe("PGRST204");
  });

  it("rejects identifier injection in columns, filters, order and onConflict", () => {
    expect(parseError({ table: "clients", op: "select", columns: "id; DROP TABLE clients" })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", columns: "id, (SELECT email FROM trainers)" })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", columns: "id as x" })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", columns: "trainers(email)" })).toBe("PGRST200");
    expect(parseError({ table: "clients", op: "select", columns: 'id"--' })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", filters: [{ col: "id = id OR 1", op: "eq", value: 1 }] })).toBe("PGRST204");
    expect(parseError({ table: "client_data", op: "upsert", values: { client_id: "a", section: "b" }, onConflict: "data" })).toBe("42P10");
    expect(parseError({ table: "client_data", op: "upsert", values: { client_id: "a", section: "b" }, onConflict: "client_id) DO NOTHING; --" })).toBe("PGRST204");
  });

  it("rejects non-scalar filter values and unsafe limits", () => {
    expect(parseError({ table: "clients", op: "select", filters: [{ col: "id", op: "eq", value: { $ne: 1 } }] })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", filters: [{ col: "id", op: "in", value: "a,b" }] })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", filters: [{ col: "id", op: "is", value: "null" }] })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", filters: [{ col: "id", op: "in", value: Array.from({ length: 101 }, (_, i) => i) }] })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", limit: "1; DROP" })).toBe("PGRST100");
    expect(parseError({ table: "clients", op: "select", limit: 100000 })).toBe("PGRST100");
  });

  it("requires a WHERE clause for update and delete", () => {
    expect(parseError({ table: "clients", op: "update", values: { name: "x" } })).toBe("21000");
    expect(parseError({ table: "clients", op: "delete" })).toBe("21000");
  });
});

describe("parameters", () => {
  it("binds every value; SQL text contains only whitelisted identifiers", () => {
    const evil = "x' OR '1'='1";
    const p = plan({ table: "clients", op: "select", columns: "id,name", filters: [{ col: "name", op: "eq", value: evil }, { col: "id", op: "in", value: ["a", "b"] }], order: [{ col: "created_at", ascending: false }], limit: 5 });
    expect(p.kind).toBe("select");
    if (p.kind !== "select") return;
    expect(p.stmt.sql).not.toContain(evil);
    expect(p.stmt.sql).not.toContain("u-coach");
    expect(p.stmt.params).toEqual(expect.arrayContaining([evil, "a", "b", "u-coach", 5]));
    expect((p.stmt.sql.match(/\?/g) || []).length).toBe(p.stmt.params.length);
    expect(p.stmt.sql).toContain("ORDER BY t.\"created_at\" DESC NULLS FIRST");
  });

  it("stores injection payloads literally", async () => {
    const db = freshDb();
    const payload = "'); DROP TABLE clients; --";
    const r = await query(db, "coach", { table: "clients", op: "update", values: { name: payload }, filters: [{ col: "id", op: "eq", value: "ca" }], returning: true });
    expect(r.data[0].name).toBe(payload);
    expect(rows(db, "SELECT count(*) AS n FROM clients")[0].n).toBe(4);
  });

  it("refuses statements over D1's bound-parameter limit", () => {
    const values = Array.from({ length: 30 }, (_, i) => ({ client_id: "ca", section: `s${i}`, data: {} }));
    expect(() => plan({ table: "client_data", op: "insert", values })).toThrow(/too large/i);
    expect(MAX_PARAMS).toBe(100);
  });
});

describe("result shapes", () => {
  let db: FakeD1;
  beforeEach(() => {
    db = freshDb();
  });

  it("parses JSON and boolean columns like Postgres returned them", async () => {
    const ex = await query(db, "clientA", { table: "exercise_library", op: "select", columns: "name, muscle_group, movement_pattern, coaching_cues, needs_review" });
    expect(ex.data).toEqual([{ name: "Squat", muscle_group: "Quads", movement_pattern: null, coaching_cues: ["brace", "knees out"], needs_review: true }]);
    const hs = await query(db, "clientA", { table: "health_screenings", op: "select", filters: [{ col: "client_id", op: "eq", value: "ca" }], order: [{ col: "signed_at", ascending: false }], limit: 1, single: "maybe" });
    expect(hs.data).toMatchObject({ answers: { q1: true }, consents: { c: true }, needs_clearance: true });
    const cd = await query(db, "clientA", { table: "client_data", op: "select", columns: "data", filters: [{ col: "client_id", op: "eq", value: "ca" }, { col: "section", op: "eq", value: "profile" }], single: "maybe" });
    expect(cd.data).toEqual({ data: { goal: "A" } });
  });

  it("merges migrated `extra` columns into * selects (real columns win)", async () => {
    const r = await query(db, "clientA", { table: "clients", op: "select", columns: "*", filters: [{ col: "client_user_id", op: "eq", value: "u-a" }], single: "maybe" });
    expect(r.data.notes).toBe("legacy note");
    expect(r.data.name).toBe("Alice");
    expect(r.data).not.toHaveProperty("extra");
    const only = await query(db, "clientA", { table: "clients", op: "select", columns: "id", filters: [{ col: "id", op: "eq", value: "ca" }] });
    expect(only.data).toEqual([{ id: "ca" }]);
  });

  it("single / maybeSingle follow PostgREST (PGRST116)", async () => {
    const q = (single: string, filters: object[]) => query(db, "coach", { table: "clients", op: "select", columns: "id", filters, single });
    expect((await q("single", [{ col: "id", op: "eq", value: "nope" }])).error).toMatchObject({ code: "PGRST116", status: 406 });
    expect((await q("maybe", [{ col: "id", op: "eq", value: "nope" }])).data).toBeNull();
    expect((await q("single", [{ col: "id", op: "eq", value: "ca" }])).data).toEqual({ id: "ca" });
    expect((await q("single", [])).error?.code).toBe("PGRST116");
    expect((await q("maybe", [])).error?.code).toBe("PGRST116");
  });

  it("generates ids/timestamps on insert and bumps updated_at on upsert", async () => {
    db.raw.exec("UPDATE client_data SET updated_at = '2000-01-01T00:00:00.000Z'");
    const r = await query(db, "coach", { table: "clients", op: "insert", values: { trainer_id: "u-coach", name: "N" }, columns: "*", returning: true, single: "single" });
    expect(r.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(r.data.created_at).toMatch(/Z$/);
    await query(db, "clientA", { table: "client_data", op: "upsert", values: { client_id: "ca", section: "profile", data: { goal: "new" } }, onConflict: "client_id,section" });
    const row = rows(db, "SELECT data, updated_at FROM client_data WHERE client_id='ca' AND section='profile'")[0];
    expect(row.updated_at > "2000-01-01T00:00:00.000Z").toBe(true);
    expect(JSON.parse(row.data)).toEqual({ goal: "new" });
    await query(db, "coach", { table: "client_data", op: "update", values: { data: { a: 1 } }, filters: [{ col: "client_id", op: "eq", value: "cb" }] });
    expect(rows(db, "SELECT updated_at FROM client_data WHERE client_id='cb'")[0].updated_at > "2000").toBe(true);
  });

  it("writes return null data unless .select() asked for rows", async () => {
    const r = await query(db, "coach", { table: "clients", op: "update", values: { name: "Q" }, filters: [{ col: "id", op: "eq", value: "ca" }] });
    expect(r).toEqual({ data: null, error: null });
  });

  it("maps constraint errors to friendly messages", async () => {
    const dup = await query(db, "coach", { table: "clients", op: "insert", values: { trainer_id: "u-coach", invite_code: "CODEA" } });
    expect(dup.error).toMatchObject({ code: "23505", status: 409 });
    expect(dup.error?.message).toMatch(/invite code/);
    const chk = await query(db, "coach", { table: "client_data", op: "insert", values: { client_id: "ca", section: "x", data: null } });
    expect(chk.error).toBeNull();
  });
});
