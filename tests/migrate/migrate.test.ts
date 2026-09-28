import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { id: string; email: string; origin: string }[] = [];
vi.mock("../../worker/lib/auth/email", () => ({
  sendPasswordSetupEmail: vi.fn(async (_env: unknown, user: { id: string; email: string }, origin: string) => {
    if (user.email.startsWith("bounce")) throw new Error("Resend 422");
    sent.push({ id: user.id, email: user.email, origin });
  }),
}));

import app from "../../worker/index";
import { toBool, toInt, toIsoTs, toJsonText, toReal, toText, convert, isOversized } from "../../worker/lib/migrate/transform";
import { upsertSql, tableSpec } from "../../worker/lib/migrate/tables";
import { ADMIN_TOKEN, FakeSupabase, makeEnv } from "./harness";
import { fixture } from "./fixtures";

type Env = ReturnType<typeof makeEnv>;
let supa: FakeSupabase;

beforeEach(() => {
  sent.length = 0;
  supa = new FakeSupabase(fixture());
  vi.stubGlobal("fetch", supa.fetch);
});
afterEach(() => vi.unstubAllGlobals());

async function call(ctx: Env, step: string, body: unknown = {}, token = ADMIN_TOKEN) {
  const res = await app.request(
    `http://forge.test/api/admin/migrate/${step}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
    ctx.env,
  );
  return { status: res.status, body: (await res.json()) as any };
}

const subrequests = (ctx: Env) => supa.calls.n + ctx.DB.calls.n + ctx.FILES.calls.n;

async function runToDone(ctx: Env, step: string, extra: Record<string, unknown> = {}) {
  let cursor: string | null = null;
  let processed = 0;
  let calls = 0;
  const warnings: string[] = [];
  let last: any;
  for (;;) {
    const before = subrequests(ctx);
    const { status, body } = await call(ctx, step, { cursor, ...extra });
    expect(status, JSON.stringify(body)).toBe(200);
    expect(subrequests(ctx) - before).toBeLessThanOrEqual(40);
    last = body.data;
    processed += last.processed;
    warnings.push(...last.warnings);
    calls++;
    if (last.done) break;
    cursor = last.nextCursor;
    if (calls > 200) throw new Error("did not finish");
  }
  return { processed, calls, warnings, last };
}

const DATA_STEPS = [
  "trainers", "clients", "client_data", "trainer_data", "health_screenings",
  "buddy_pairs", "buddy_members", "exercise_library", "users",
];

async function migrateAll(ctx: Env, pageSize?: number) {
  for (const step of DATA_STEPS) await runToDone(ctx, step, pageSize ? { pageSize } : {});
}

function snapshot(ctx: Env) {
  const out: Record<string, unknown[]> = {};
  for (const t of [...DATA_STEPS]) out[t] = ctx.DB.rows(`SELECT * FROM ${t} ORDER BY 1, 2`);
  return out;
}

describe("guard", () => {
  it("404s when MIGRATION_ENABLED is not 'true'", async () => {
    const ctx = makeEnv({ MIGRATION_ENABLED: "false" });
    expect((await call(ctx, "trainers")).status).toBe(404);
    const res = await app.request("http://forge.test/api/admin/migrate", {}, ctx.env);
    expect(res.status).toBe(404);
  });

  it("401s without or with a wrong bearer token", async () => {
    const ctx = makeEnv();
    const noAuth = await app.request("http://forge.test/api/admin/migrate/trainers", { method: "POST" }, ctx.env);
    expect(noAuth.status).toBe(401);
    expect((await call(ctx, "trainers", {}, "x".repeat(40))).status).toBe(401);
    expect(supa.calls.n).toBe(0);
  });

  it("refuses when the admin token secret is shorter than 32 chars", async () => {
    const ctx = makeEnv({ MIGRATION_ADMIN_TOKEN: "short" });
    expect((await call(ctx, "trainers", {}, "short")).status).toBe(503);
  });

  it("rejects unknown steps and bad input", async () => {
    const ctx = makeEnv();
    expect((await call(ctx, "payments")).status).toBe(404);
    expect((await call(ctx, "clients", { pageSize: -1 })).status).toBe(400);
    expect((await call(ctx, "clients", { cursor: "abc" })).status).toBe(400);
  });

  it("lists steps with a valid token", async () => {
    const ctx = makeEnv();
    const res = await app.request("http://forge.test/api/admin/migrate", { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }, ctx.env);
    const body = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(body.data.steps[0]).toBe("trainers");
    expect(body.data.steps.at(-1)).toBe("send-password-setup");
  });
});

describe("value transforms", () => {
  it("converts Postgres values to the D1 representation", () => {
    expect(toIsoTs("2026-08-27T09:00:00.999999+00:00")).toBe("2026-08-27T09:00:00.999Z");
    expect(toIsoTs("2026-08-27 09:00:00.5+04")).toBe("2026-08-27T05:00:00.500Z");
    expect(toIsoTs(null)).toBeNull();
    expect(toBool(true)).toBe(1);
    expect(toBool(false)).toBe(0);
    expect(toBool("t")).toBe(1);
    expect(toReal("120.50")).toBe(120.5);
    expect(toInt("31")).toBe(31);
    expect(toInt("n/a")).toBeNull();
    expect(toText(7)).toBe("7");
    expect(toJsonText({ a: 1 })).toBe('{"a":1}');
    expect(toJsonText(["a", "b"])).toBe('["a","b"]');
    expect(toJsonText("hello")).toBe('"hello"'); // a jsonb string value
    expect(toJsonText('{"a":1}', true)).toBe('{"a":1}'); // ::text cast passes through
    expect(convert({ name: "x", type: "json", notNull: true, def: "[]" }, null)).toBe("[]");
    expect(convert({ name: "x", type: "text", notNull: true, def: "Coach" }, null)).toBe("Coach");
    expect(isOversized("x".repeat(100))).toBe(false);
    expect(isOversized("x".repeat(2_000_000))).toBe(true);
  });

  it("builds a no-op-skipping upsert", () => {
    const sql = upsertSql(tableSpec("clients")!);
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE SET");
    expect(sql).toContain("extra = excluded.extra");
    expect(sql).toContain("clients.name IS NOT excluded.name");
  });
});

describe("table + user steps", () => {
  it("copies every table with transforms, extra columns and warnings", async () => {
    const ctx = makeEnv();
    const trainers = await runToDone(ctx, "trainers");
    expect(trainers.warnings).toContain('trainers: v1 column "bio" has no D1 column and was dropped');
    await migrateAll(ctx);

    const [c1] = ctx.DB.rows("SELECT * FROM clients WHERE id = 'c1'");
    expect(c1.weight_kg).toBe(72.5);
    expect(c1.phone).toBe("");
    expect(c1.created_at).toBe("2026-08-01T10:00:00.123Z");
    expect(JSON.parse(String(c1.extra))).toEqual({ notes: "legacy note 1" });

    const [cd] = ctx.DB.rows("SELECT data FROM client_data WHERE client_id = 'c1' AND section = 'profile'");
    expect(JSON.parse(String(cd.data))).toEqual({ paymentPaid: true, photo: "data:image/png;base64,AAAA" });
    // client_data asked PostgREST for data::text
    expect(supa.requests.some((r) => r.path === "/rest/v1/client_data")).toBe(true);

    const [h] = ctx.DB.rows("SELECT * FROM health_screenings");
    expect(h.needs_clearance).toBe(1);
    expect(JSON.parse(String(h.answers))).toEqual({ q1: true, q2: "no" });
    expect(h.consents).toBe('["terms","privacy"]');

    const [p] = ctx.DB.rows("SELECT price FROM buddy_pairs");
    expect(p.price).toBe(120.5);

    const ex = ctx.DB.rows("SELECT * FROM exercise_library ORDER BY id");
    expect(ex[0].coaching_cues).toBe('["Brace","Knees out","Drive up"]');
    expect(JSON.parse(String(ex[0].extra))).toEqual({ video_url: "https://v" });
    expect(ex[1].coaching_cues).toBe("[]");
    expect(ex[1].needs_review).toBe(1);

    const users = ctx.DB.rows("SELECT * FROM users ORDER BY id");
    expect(users).toHaveLength(4);
    expect(users.every((u) => u.password_hash === null)).toBe(true);
    const u3 = users.find((u) => u.id === "u3")!;
    expect(u3.email_verified_at).toBeNull();
    expect(JSON.parse(String(u3.user_metadata))).toEqual({ role: "client", name: "Client 3" });
  });

  it("is idempotent: running twice gives the same rows", async () => {
    const ctx = makeEnv();
    await migrateAll(ctx, 2);
    const first = snapshot(ctx);
    await migrateAll(ctx); // buddy_members re-run must not trip the max-two trigger
    expect(snapshot(ctx)).toEqual(first);
  });

  it("paginates and resumes from a cursor", async () => {
    const ctx = makeEnv();
    await runToDone(ctx, "trainers");
    const a = await call(ctx, "clients", { pageSize: 2 });
    expect(a.body.data).toMatchObject({ done: false, nextCursor: "2", processed: 2 });
    // Resume later (e.g. after the driver crashed) from the saved cursor.
    const b = await call(ctx, "clients", { pageSize: 2, cursor: "2" });
    expect(b.body.data).toMatchObject({ done: false, nextCursor: "4", processed: 2 });
    const c = await call(ctx, "clients", { pageSize: 2, cursor: "4" });
    expect(c.body.data).toMatchObject({ done: true, nextCursor: null, processed: 1 });
    expect(ctx.DB.rows("SELECT id FROM clients")).toHaveLength(5);
    const log = ctx.DB.rows("SELECT value FROM migration_log WHERE key = 'step:clients'");
    expect(JSON.parse(String(log[0].value)).done).toBe(true);

    const client_data = await runToDone(ctx, "client_data");
    expect(client_data.calls).toBe(2); // 6 rows at the default page size of 5
  });

  it("never overwrites a password (or v2 profile) that v2 already set", async () => {
    const ctx = makeEnv();
    await runToDone(ctx, "users");
    ctx.DB.db.exec("UPDATE users SET password_hash = 'H', password_salt = 'S', password_iterations = 100000 WHERE id = 'u1'");
    supa.state.users[1] = { ...supa.state.users[1], email: "changed1@example.com", raw_user_meta_data: { name: "New" } };
    supa.state.users[2] = { ...supa.state.users[2], email: "changed2@example.com" };
    await runToDone(ctx, "users");

    const [u1] = ctx.DB.rows("SELECT * FROM users WHERE id = 'u1'");
    expect(u1).toMatchObject({ password_hash: "H", password_salt: "S", password_iterations: 100000, email: "client1@example.com" });
    const [u2] = ctx.DB.rows("SELECT * FROM users WHERE id = 'u2'");
    expect(u2.email).toBe("changed2@example.com");
    expect(u2.password_hash).toBeNull();
  });

  it("skips a v1 user whose email is already taken by another v2 account", async () => {
    const ctx = makeEnv();
    ctx.DB.db.exec("INSERT INTO users (id, email, password_hash) VALUES ('v2-new', 'Client2@example.com', 'H')");
    const r = await runToDone(ctx, "users");
    expect(r.warnings.join("\n")).toContain("client2@example.com already belongs to a different v2 account");
    expect(ctx.DB.rows("SELECT id FROM users ORDER BY id").map((u) => u.id)).toEqual(["t1", "u1", "u3", "v2-new"]);
  });

  it("only ever reads from Supabase", async () => {
    const ctx = makeEnv();
    await migrateAll(ctx);
    await runToDone(ctx, "files:client-photos");
    await runToDone(ctx, "prune");
    await runToDone(ctx, "verify");
    for (const r of supa.requests) {
      const ok = r.method === "GET" || r.method === "HEAD" || (r.method === "POST" && r.path.startsWith("/storage/v1/object/list/"));
      expect(ok, `${r.method} ${r.path}`).toBe(true);
    }
  });

  it("surfaces Supabase 5xx as a retryable 503", async () => {
    const ctx = makeEnv();
    supa.failNext = 500;
    expect((await call(ctx, "trainers")).status).toBe(503);
    expect((await call(ctx, "trainers")).status).toBe(200);
  });
});

describe("files", () => {
  it("lists recursively, copies to R2 and skips same-size objects on re-run", async () => {
    const ctx = makeEnv();
    const first = await runToDone(ctx, "files:client-photos");
    expect([...ctx.FILES.objects.keys()].sort()).toEqual([
      "client-photos/clients/c1/progress/a.jpg",
      "client-photos/clients/c1/progress/b.jpg",
      "client-photos/clients/c2/profile.jpg",
      "client-photos/trainers/t1/me.jpg",
    ]);
    expect(first.last.details).toMatchObject({ seen: 4, copied: 4, skipped: 0 });
    expect(ctx.FILES.objects.get("client-photos/clients/c2/profile.jpg")!.contentType).toBe("image/jpeg");

    const downloadsBefore = supa.requests.filter((r) => r.method === "GET" && r.path.startsWith("/storage/")).length;
    supa.state.buckets["client-photos"]["clients/c2/profile.jpg"].data = new Uint8Array(31);
    const second = await runToDone(ctx, "files:client-photos");
    const downloads = supa.requests.filter((r) => r.method === "GET" && r.path.startsWith("/storage/")).length - downloadsBefore;
    expect(downloads).toBe(1);
    expect(second.last.details).toMatchObject({ seen: 4, copied: 1, skipped: 3 });
    expect(ctx.FILES.objects.get("client-photos/clients/c2/profile.jpg")!.body.byteLength).toBe(31);
  });

  it("splits large buckets across calls within the subrequest budget and resumes mid-page", async () => {
    const ctx = makeEnv();
    const objs = supa.state.buckets["screening-documents"];
    for (let c = 0; c < 6; c++) {
      for (let s = 0; s < 5; s++) objs[`c${c}/s${s}/screening.pdf`] = { data: new Uint8Array(c + s + 1), mimetype: "application/pdf" };
    }
    const total = Object.keys(objs).length;
    const r = await runToDone(ctx, "files:screening-documents", { pageSize: 3 });
    expect(r.calls).toBeGreaterThan(3);
    expect(r.processed).toBe(total);
    expect([...ctx.FILES.objects.keys()].filter((k) => k.startsWith("screening-documents/"))).toHaveLength(total);
    const [log] = ctx.DB.rows("SELECT value FROM migration_log WHERE key = 'bucketcount:screening-documents'");
    expect(JSON.parse(String(log.value)).objects).toBe(total);
  });
});

describe("prune + verify + reset", () => {
  it("removes rows deleted in v1, keeps users with a v2 password", async () => {
    const ctx = makeEnv();
    await migrateAll(ctx);
    ctx.DB.db.exec("UPDATE users SET password_hash = 'H' WHERE id = 'u2'");
    const s = supa.state;
    s.tables.clients = s.tables.clients.filter((c) => c.id !== "c5");
    s.tables.client_data = s.tables.client_data.filter((r) => !(r.client_id === "c3" && r.section === "program"));
    s.users = s.users.filter((u) => u.id !== "u2" && u.id !== "u3");

    const r = await runToDone(ctx, "prune");
    expect(r.processed).toBe(3); // c5, one client_data row, u3
    expect(ctx.DB.rows("SELECT id FROM clients WHERE id = 'c5'")).toHaveLength(0);
    expect(ctx.DB.rows("SELECT * FROM client_data WHERE client_id = 'c3'")).toHaveLength(1);
    expect(ctx.DB.rows("SELECT id FROM users ORDER BY id").map((u) => u.id)).toEqual(["t1", "u1", "u2"]);
  });

  it("refuses to prune most of a table unless forced", async () => {
    const ctx = makeEnv();
    await migrateAll(ctx);
    supa.state.tables.clients = [supa.state.tables.clients[0]];
    supa.state.tables.buddy_members = [];
    const r = await runToDone(ctx, "prune");
    expect(r.warnings.join("\n")).toContain("prune clients: 4 of 5 rows are missing in v1; skipped");
    expect(ctx.DB.rows("SELECT id FROM clients")).toHaveLength(5);
    await runToDone(ctx, "prune", { force: true });
    expect(ctx.DB.rows("SELECT id FROM clients")).toHaveLength(1);
  });

  it("verify reports per-table and per-bucket counts", async () => {
    const ctx = makeEnv();
    await migrateAll(ctx);
    await runToDone(ctx, "files:client-photos");
    await runToDone(ctx, "files:screening-documents");
    const { last } = await runToDone(ctx, "verify");
    const rows = last.details.rows as { name: string; source: number; target: number; ok: boolean }[];
    expect(last.details.ok).toBe(true);
    expect(rows.find((r) => r.name === "client_data")).toMatchObject({ source: 6, target: 6, ok: true });
    expect(rows.find((r) => r.name === "users")).toMatchObject({ source: 4, target: 4, ok: true });
    expect(rows.find((r) => r.name === "bucket:client-photos")).toMatchObject({ source: 4, target: 4, ok: true });

    ctx.DB.db.exec("DELETE FROM trainer_data");
    const again = await runToDone(ctx, "verify");
    expect(again.last.details.ok).toBe(false);
    expect(again.warnings).toContain("verify: trainer_data source=1 target=0");
  });

  it("reset-app-data needs the confirm phrase and keeps users + email log", async () => {
    const ctx = makeEnv();
    await migrateAll(ctx);
    ctx.DB.db.exec("INSERT INTO migration_log (key, value) VALUES ('email:u1', '{}')");
    expect((await call(ctx, "reset-app-data", { confirm: "yes" })).status).toBe(400);
    const ok = await call(ctx, "reset-app-data", { confirm: "WIPE D1 APP DATA" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.deleted.clients).toBe(5);
    expect(ctx.DB.rows("SELECT * FROM clients")).toHaveLength(0);
    expect(ctx.DB.rows("SELECT * FROM users")).toHaveLength(4);
    expect(ctx.DB.rows("SELECT * FROM migration_log WHERE key = 'email:u1'")).toHaveLength(1);
    expect(ctx.DB.rows("SELECT * FROM migration_log WHERE key LIKE 'step:%'")).toHaveLength(0);
  });

  it("reset-app-data refuses once payments has rows", async () => {
    const ctx = makeEnv();
    ctx.DB.db.exec("CREATE TABLE payments (id TEXT PRIMARY KEY); INSERT INTO payments VALUES ('pay1')");
    expect((await call(ctx, "reset-app-data", { confirm: "WIPE D1 APP DATA" })).status).toBe(409);
  });
});

describe("send-password-setup", () => {
  function seedUsers(ctx: Env, n: number) {
    const ins = ctx.DB.db.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)");
    for (let i = 0; i < n; i++) ins.run(`m${String(i).padStart(2, "0")}`, `m${i}@example.com`, `2026-08-01T00:00:${String(i).padStart(2, "0")}Z`);
  }

  it("sends at most 10 per call, once per user, and stops at the daily cap", async () => {
    const ctx = makeEnv({ MIGRATION_EMAIL_DAILY_MAX: "12" });
    seedUsers(ctx, 20);
    ctx.DB.db.exec("INSERT INTO users (id, email, password_hash) VALUES ('has-pw', 'pw@example.com', 'H')");

    const one = await call(ctx, "send-password-setup", { pageSize: 50 });
    expect(one.body.data.processed).toBeLessThanOrEqual(10);
    expect(one.body.data.done).toBe(false);

    const rest = await runToDone(ctx, "send-password-setup");
    expect(sent).toHaveLength(12);
    expect(new Set(sent.map((s) => s.id)).size).toBe(12);
    expect(sent.every((s) => s.origin === "http://forge.test")).toBe(true);
    expect(sent.some((s) => s.id === "has-pw")).toBe(false);
    expect(rest.last.details).toMatchObject({ remaining: 8, sentToday: 12, dailyMax: 12 });
    expect(rest.warnings.join("\n")).toContain("daily limit of 12 reached; 8 user(s) still need an email");
    expect(ctx.DB.rows("SELECT key FROM migration_log WHERE key LIKE 'email:%'")).toHaveLength(12);

    // Same day again: nothing goes out.
    const again = await call(ctx, "send-password-setup");
    expect(again.body.data).toMatchObject({ done: true, processed: 0 });
    expect(sent).toHaveLength(12);
  });

  it("defaults to a daily max of 90 and does not record failed sends", async () => {
    const ctx = makeEnv();
    seedUsers(ctx, 3);
    ctx.DB.db.exec("INSERT INTO users (id, email, created_at) VALUES ('b', 'bounce@example.com', '2026-01-01T00:00:00Z')");
    const r = await runToDone(ctx, "send-password-setup");
    expect(sent).toHaveLength(3);
    expect(r.last.details).toMatchObject({ dailyMax: 90, remaining: 1, failed: 1 });
    expect(r.warnings.join("\n")).toContain("bounce@example.com failed");
    expect(ctx.DB.rows("SELECT key FROM migration_log WHERE key = 'email:b'")).toHaveLength(0);
  });

  it("works without Supabase credentials", async () => {
    const ctx = makeEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    seedUsers(ctx, 1);
    expect((await call(ctx, "send-password-setup")).status).toBe(200);
    expect((await call(ctx, "trainers")).status).toBe(503);
  });
});
