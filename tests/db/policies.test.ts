// Policy matrix: coach vs own client (A) vs other client (B) vs stranger,
// for every table and op, against real SQLite + migrations/0001_core.sql.
// "Own client" = client A (clients.ca, client_user_id u-a); "other client"
// = client B, a different client of the same coach, who must not see A's
// rows; coach2 is a second trainer who must not see coach's rows.
import { beforeEach, describe, expect, it } from "vitest";
import { type Actor, type FakeD1, freshDb, query, rows } from "./helpers";

let db: FakeD1;
beforeEach(() => {
  db = freshDb();
});

const RLS = "42501";
const eq = (col: string, value: unknown) => ({ col, op: "eq", value });

async function count(actor: Actor, table: string, filters: object[] = []) {
  const r = await query(db, actor, { table, op: "select", filters });
  expect(r.error).toBeNull();
  return r.data.length;
}

async function expectMatrix(fn: (a: Actor) => Promise<unknown>, expected: Partial<Record<Actor, unknown>>) {
  for (const [actor, want] of Object.entries(expected)) {
    db = freshDb();
    expect(await fn(actor as Actor), `actor ${actor}`).toEqual(want);
  }
}

const outcome = (r: { data: any; error: any }) => (r.error ? r.error.code : Array.isArray(r.data) ? r.data.length : r.data);

describe("clients", () => {
  it("select: coach sees own roster, client sees self, others nothing", async () => {
    await expectMatrix((a) => count(a, "clients"), { coach: 3, clientA: 1, clientB: 1, stranger: 0, coach2: 1 });
    await expectMatrix((a) => count(a, "clients", [eq("id", "ca")]), { coach: 1, clientA: 1, clientB: 0, stranger: 0, coach2: 0 });
  });

  it("insert: only the coach, for themself, with no linked account", async () => {
    const ins = (a: Actor, values: object) => query(db, a, { table: "clients", op: "insert", values, returning: true, single: "single" }).then(outcome);
    const r = await query(db, "coach", { table: "clients", op: "insert", values: { trainer_id: "u-coach", name: "New" }, returning: true, single: "single" });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ trainer_id: "u-coach", name: "New", invite_status: "not_sent", client_user_id: null });
    await expectMatrix((a) => ins(a, { trainer_id: "u-coach", name: "X" }), { clientA: RLS, clientB: RLS, stranger: RLS, coach2: RLS });
    expect(await ins("coach", { trainer_id: "u-coach2", name: "X" })).toBe(RLS);
    expect(await ins("coach", { trainer_id: "u-coach", client_user_id: "u-stranger", name: "X" })).toBe(RLS);
  });

  it("update name/weight: coach and the client themself; nobody else", async () => {
    const upd = (a: Actor) => query(db, a, { table: "clients", op: "update", values: { name: "Z", weight_kg: 70 }, filters: [eq("id", "ca")], returning: true }).then(outcome);
    await expectMatrix(upd, { coach: 1, clientA: 1, clientB: 0, stranger: 0, coach2: 0 });
  });

  it("update: client cannot touch other columns; coach cannot re-home or link accounts", async () => {
    const upd = (a: Actor, values: object) => query(db, a, { table: "clients", op: "update", values, filters: [eq("id", "ca")], returning: true }).then(outcome);
    expect(await upd("clientA", { invite_code: "MINE" })).toBe(0);
    expect(await upd("clientA", { trainer_id: "u-a" })).toBe(0);
    expect(await upd("clientA", { client_user_id: "u-b" })).toBe(0);
    expect(await upd("coach", { client_user_id: "u-stranger" })).toBe(0);
    expect(await upd("coach", { trainer_id: "u-coach2" })).toBe(RLS);
    expect(rows(db, "SELECT trainer_id, client_user_id FROM clients WHERE id='ca'")[0]).toEqual({ trainer_id: "u-coach", client_user_id: "u-a" });
    expect(await upd("coach", { invite_code: "NEWCODE", invite_status: "sent" })).toBe(1);
  });

  it("claim orphans: only the verified COACH_EMAIL account adopts trainer_id IS NULL rows", async () => {
    const claim = (a: Actor) => {
      db.raw.exec("INSERT INTO clients (id, trainer_id, name) VALUES ('orphan', NULL, 'O')");
      return query(db, a, { table: "clients", op: "update", values: { trainer_id: USERS_ID[a] }, filters: [{ col: "trainer_id", op: "is", value: null }], returning: true }).then(outcome);
    };
    await expectMatrix(claim, { coach: 1, coach2: 0, clientA: 0, stranger: 0, unverifiedCoach: 0 });
  });

  it("delete: coach only (cascades client_data)", async () => {
    const del = (a: Actor) => query(db, a, { table: "clients", op: "delete", filters: [eq("id", "ca")], returning: true }).then(outcome);
    await expectMatrix(del, { coach: 1, clientA: 0, clientB: 0, stranger: 0, coach2: 0 });
    db = freshDb();
    await query(db, "coach", { table: "clients", op: "delete", filters: [eq("id", "ca")] });
    expect(rows(db, "SELECT * FROM client_data WHERE client_id='ca'")).toHaveLength(0);
  });
});

const USERS_ID: Record<Actor, string> = {
  coach: "u-coach", coach2: "u-coach2", clientA: "u-a", clientB: "u-b", stranger: "u-stranger", unverifiedCoach: "u-fake-coach",
};

describe("trainers", () => {
  it("select: own row only", async () => {
    await expectMatrix((a) => count(a, "trainers"), { coach: 1, coach2: 1, clientA: 0, stranger: 0 });
    await expectMatrix((a) => count(a, "trainers", [eq("id", "u-coach")]), { coach: 1, coach2: 0, clientA: 0, stranger: 0 });
  });

  it("insert: only the verified coach account, for its own id", async () => {
    const ins = (a: Actor, id: string) => {
      db.raw.exec("DELETE FROM trainers WHERE id = 'u-coach'");
      return query(db, a, { table: "trainers", op: "insert", values: { id, email: "e", name: "n", role: "Coach" } }).then(outcome);
    };
    await expectMatrix((a) => ins(a, USERS_ID[a]), { coach: null, stranger: RLS, clientA: RLS, unverifiedCoach: RLS });
    await expectMatrix((a) => ins(a, "u-coach"), { stranger: RLS, clientA: RLS });
  });

  it("upsert (CoachDashboard settings) works for the coach, refused for others", async () => {
    const up = (a: Actor) => query(db, a, { table: "trainers", op: "upsert", values: { id: USERS_ID[a], name: "Renamed", email: "e", phone: "", photo: "", role: "Coach" }, onConflict: "id" }).then(outcome);
    await expectMatrix(up, { coach: null, coach2: RLS, stranger: RLS });
    db = freshDb();
    await up("coach");
    expect(rows(db, "SELECT name FROM trainers WHERE id='u-coach'")[0].name).toBe("Renamed");
    // Upserting someone else's id is refused even though the row exists.
    expect(await query(db, "coach2", { table: "trainers", op: "upsert", values: { id: "u-coach", name: "pwn" }, onConflict: "id" }).then(outcome)).toBe(RLS);
  });

  it("update: own row; delete: never", async () => {
    await expectMatrix((a) => query(db, a, { table: "trainers", op: "update", values: { email: "new" }, filters: [eq("id", "u-coach")], returning: true }).then(outcome), { coach: 1, coach2: 0, clientA: 0, stranger: 0 });
    await expectMatrix((a) => query(db, a, { table: "trainers", op: "delete", filters: [eq("id", USERS_ID[a])], returning: true }).then(outcome), { coach: 0, coach2: 0 });
  });
});

describe("client_data", () => {
  it("select: the client's coach and the client themself", async () => {
    await expectMatrix((a) => count(a, "client_data", [eq("client_id", "ca")]), { coach: 2, clientA: 2, clientB: 0, stranger: 0, coach2: 0 });
  });

  it("coach bulk load (loadCoach) only returns their clients' rows", async () => {
    const r = await query(db, "coach", { table: "client_data", op: "select", filters: [{ col: "client_id", op: "in", value: ["ca", "cb", "cx"] }, { col: "section", op: "neq", value: "transformPhotos" }] });
    expect(r.data.map((d: any) => d.client_id).sort()).toEqual(["ca", "cb"]);
  });

  it("upsert: coach and self; others refused", async () => {
    const up = (a: Actor) => query(db, a, { table: "client_data", op: "upsert", values: { client_id: "ca", section: "profile", data: { goal: a } }, onConflict: "client_id,section" }).then(outcome);
    await expectMatrix(up, { coach: null, clientA: null, clientB: RLS, stranger: RLS, coach2: RLS });
    db = freshDb();
    await up("clientB");
    expect(JSON.parse(rows(db, "SELECT data FROM client_data WHERE client_id='ca' AND section='profile'")[0].data)).toEqual({ goal: "A" });
  });

  it("upsert of a new section inserts it", async () => {
    const r = await query(db, "clientA", { table: "client_data", op: "upsert", values: { client_id: "ca", section: "nutrition", data: { x: 1 } }, onConflict: "client_id,section" });
    expect(r.error).toBeNull();
    expect(rows(db, "SELECT * FROM client_data WHERE client_id='ca' AND section='nutrition'")).toHaveLength(1);
  });

  it("update / delete: coach and self", async () => {
    await expectMatrix((a) => query(db, a, { table: "client_data", op: "update", values: { data: {} }, filters: [eq("client_id", "ca")], returning: true }).then(outcome), { coach: 2, clientA: 2, clientB: 0, stranger: 0 });
    await expectMatrix((a) => query(db, a, { table: "client_data", op: "delete", filters: [eq("client_id", "ca")], returning: true }).then(outcome), { coach: 2, clientA: 2, clientB: 0, stranger: 0 });
  });

  it("update cannot move a row to a client you don't own", async () => {
    const r = await query(db, "clientA", { table: "client_data", op: "update", values: { client_id: "cb" }, filters: [eq("client_id", "ca"), eq("section", "profile")] });
    expect(r.error?.code).toBe(RLS);
  });
});

describe("trainer_data", () => {
  const sel = (a: Actor, trainer: string, section?: string) =>
    count(a, "trainer_data", [eq("trainer_id", trainer), ...(section ? [eq("section", section)] : [])]);

  it("owner sees everything; their clients only the whitelisted sections", async () => {
    await expectMatrix((a) => sel(a, "u-coach", "articles"), { coach: 1, clientA: 1, clientB: 1, stranger: 0, coach2: 0 });
    await expectMatrix((a) => sel(a, "u-coach", "templates"), { coach: 1, clientA: 0, stranger: 0 });
    await expectMatrix((a) => sel(a, "u-coach", "calendar"), { coach: 1, clientA: 0 });
    await expectMatrix((a) => sel(a, "u-coach"), { coach: 4, clientA: 2, stranger: 0 });
    await expectMatrix((a) => sel(a, "u-coach2", "articles"), { coach2: 1, clientA: 0, coach: 0 });
  });

  it("writes: owner only", async () => {
    const up = (a: Actor) => query(db, a, { table: "trainer_data", op: "upsert", values: { trainer_id: "u-coach", section: "articles", data: {} }, onConflict: "trainer_id,section" }).then(outcome);
    await expectMatrix(up, { coach: null, clientA: RLS, stranger: RLS, coach2: RLS });
    await expectMatrix((a) => query(db, a, { table: "trainer_data", op: "update", values: { data: {} }, filters: [eq("trainer_id", "u-coach")], returning: true }).then(outcome), { coach: 4, clientA: 0, stranger: 0 });
    await expectMatrix((a) => query(db, a, { table: "trainer_data", op: "delete", filters: [eq("trainer_id", "u-coach")], returning: true }).then(outcome), { coach: 4, clientA: 0, stranger: 0 });
  });
});

describe("health_screenings", () => {
  const record = { client_id: "ca", screening_version: "v2", answers: { q: false }, needs_clearance: false, signed_name: "A", signature_path: "s", pdf_path: "p", consents: { ok: true } };

  it("insert: only the client themself", async () => {
    const ins = (a: Actor) => query(db, a, { table: "health_screenings", op: "insert", values: record, columns: "*", returning: true, single: "single" }).then(outcome);
    await expectMatrix(ins, { coach: RLS, clientB: RLS, stranger: RLS });
    const r = await query(db, "clientA", { table: "health_screenings", op: "insert", values: record, columns: "*", returning: true, single: "single" });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ client_id: "ca", needs_clearance: false, answers: { q: false }, consents: { ok: true } });
    expect(r.data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.data.signed_at).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it("select: client or their coach; append-only", async () => {
    await expectMatrix((a) => count(a, "health_screenings", [eq("client_id", "ca")]), { coach: 1, clientA: 1, clientB: 0, stranger: 0, coach2: 0 });
    await expectMatrix((a) => query(db, a, { table: "health_screenings", op: "update", values: { signed_name: "x" }, filters: [eq("id", "hs1")], returning: true }).then(outcome), { coach: 0, clientA: 0 });
    await expectMatrix((a) => query(db, a, { table: "health_screenings", op: "delete", filters: [eq("id", "hs1")], returning: true }).then(outcome), { coach: 0, clientA: 0 });
  });
});

describe("buddy_pairs / buddy_members", () => {
  it("pairs: coach only, with embedded members", async () => {
    const r = await query(db, "coach", { table: "buddy_pairs", op: "select", columns: "*, buddy_members(client_id, joined_at)", filters: [eq("coach_id", "u-coach")], order: [{ col: "created_at", ascending: false }] });
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(1);
    expect(r.data[0].buddy_members.map((m: any) => m.client_id).sort()).toEqual(["ca", "cb"]);
    expect(Object.keys(r.data[0].buddy_members[0]).sort()).toEqual(["client_id", "joined_at"]);
    await expectMatrix((a) => count(a, "buddy_pairs"), { coach: 1, clientA: 0, stranger: 0, coach2: 1 });
  });

  it("pairs: writes coach only", async () => {
    await expectMatrix((a) => query(db, a, { table: "buddy_pairs", op: "insert", values: { coach_id: "u-coach", name: "N", price: 5 }, returning: true, single: "single" }).then((r) => r.error?.code ?? "ok"), { coach: "ok", clientA: RLS, coach2: RLS });
    await expectMatrix((a) => query(db, a, { table: "buddy_pairs", op: "update", values: { price: 9 }, filters: [eq("id", "p1")], returning: true }).then(outcome), { coach: 1, clientA: 0, coach2: 0 });
    await expectMatrix((a) => query(db, a, { table: "buddy_pairs", op: "delete", filters: [eq("id", "p1")], returning: true }).then(outcome), { coach: 1, clientA: 0, coach2: 0 });
  });

  it("members: client-side partner lookup stays blocked (v1 parity)", async () => {
    await expectMatrix((a) => query(db, a, { table: "buddy_members", op: "select", columns: "pair_id", filters: [eq("client_id", "ca")], single: "maybe" }).then((r) => r.data), { clientA: null, clientB: null, coach: { pair_id: "p1" } });
  });

  it("members: coach may only add their own clients to their own pairs", async () => {
    db.raw.exec("INSERT INTO buddy_pairs (id, coach_id) VALUES ('p2', 'u-coach')");
    const ins = (values: object) => query(db, "coach", { table: "buddy_members", op: "insert", values }).then(outcome);
    expect(await ins({ pair_id: "p2", client_id: "cx" })).toBe(RLS);
    expect(await ins({ pair_id: "px", client_id: "cc" })).toBe(RLS);
    // all-or-nothing: one bad row rejects the batch
    expect(await ins([{ pair_id: "p2", client_id: "cc" }, { pair_id: "p2", client_id: "cx" }])).toBe(RLS);
    expect(rows(db, "SELECT * FROM buddy_members WHERE pair_id='p2'")).toHaveLength(0);
    expect(await ins({ pair_id: "p2", client_id: "cc" })).toBe(null);
    expect(await query(db, "clientA", { table: "buddy_members", op: "insert", values: { pair_id: "p1", client_id: "ca" } }).then(outcome)).toBe(RLS);
  });

  it("members: max-two trigger and one-pair-per-client map to friendly errors", async () => {
    const third = await query(db, "coach", { table: "buddy_members", op: "insert", values: { pair_id: "p1", client_id: "cc" } });
    expect(third.error).toMatchObject({ code: "P0001", message: "A buddy pair can have at most two members" });
    db.raw.exec("INSERT INTO buddy_pairs (id, coach_id) VALUES ('p2', 'u-coach')");
    const dup = await query(db, "coach", { table: "buddy_members", op: "insert", values: { pair_id: "p2", client_id: "ca" } });
    expect(dup.error).toMatchObject({ code: "23505", status: 409 });
  });

  it("members: delete via pair owner only", async () => {
    await expectMatrix((a) => query(db, a, { table: "buddy_members", op: "delete", filters: [eq("pair_id", "p1"), eq("client_id", "ca")], returning: true }).then(outcome), { coach: 1, clientA: 0, coach2: 0 });
  });
});

describe("exercise_library", () => {
  it("any signed-in user can read; nobody writes through the API", async () => {
    await expectMatrix((a) => count(a, "exercise_library"), { coach: 1, clientA: 1, stranger: 1 });
    await expectMatrix((a) => query(db, a, { table: "exercise_library", op: "insert", values: { name: "Lunge" } }).then(outcome), { coach: RLS, clientA: RLS });
    await expectMatrix((a) => query(db, a, { table: "exercise_library", op: "update", values: { name: "x" }, filters: [eq("id", "e1")], returning: true }).then(outcome), { coach: 0 });
    await expectMatrix((a) => query(db, a, { table: "exercise_library", op: "delete", filters: [eq("id", "e1")], returning: true }).then(outcome), { coach: 0 });
  });
});
