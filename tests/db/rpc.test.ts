// The three RPCs and the /api/db HTTP surface (auth, rate limits, envelope).
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppContext, AuthUser } from "../../worker/lib/env";
import dbRoutes from "../../worker/routes/db";
import { COACH_EMAIL, type FakeD1, USERS, freshDb, rows } from "./helpers";

let db: FakeD1;
let limiterOk = true;
const limiterKeys: string[] = [];
const limiter = { limit: async ({ key }: { key: string }) => (limiterKeys.push(key), { success: limiterOk }) };

function makeApp(user: AuthUser | null) {
  const app = new Hono<AppContext>();
  // Stands in for requireUser: the auth agent owns session.ts.
  app.use("*", async (c, next) => {
    if (user) c.set("user", user);
    await next();
  });
  app.route("/api/db", dbRoutes);
  return app;
}

async function call(user: AuthUser | null, path: string, body?: unknown) {
  const env = { DB: db, COACH_EMAIL, API_LIMITER: limiter, AUTH_LIMITER: limiter };
  const res = await makeApp(user).request(
    `/api/db${path}`,
    { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" }, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
  return { status: res.status, json: (await res.json()) as any };
}

beforeEach(() => {
  db = freshDb();
  limiterOk = true;
  limiterKeys.length = 0;
});

describe("lookup_invite (public)", () => {
  it("returns only name + email for an unlinked invite, rate-limited by IP", async () => {
    const r = await call(null, "/rpc/lookup_invite", { p_code: "CODEC" });
    expect(r).toEqual({ status: 200, json: { data: [{ name: "Cara", email: "cara@example.com" }] } });
    expect(limiterKeys).toEqual(["lookup_invite:1.2.3.4"]);
  });

  it("returns nothing for unknown or already-linked codes", async () => {
    expect((await call(null, "/rpc/lookup_invite", { p_code: "NOPE" })).json.data).toEqual([]);
    expect((await call(null, "/rpc/lookup_invite", { p_code: "CODEA" })).json.data).toEqual([]);
  });

  it("validates input and returns 429 when limited", async () => {
    expect((await call(null, "/rpc/lookup_invite", {})).status).toBe(400);
    expect((await call(null, "/rpc/lookup_invite", { p_code: { $gt: "" } })).status).toBe(400);
    limiterOk = false;
    expect((await call(null, "/rpc/lookup_invite", { p_code: "CODEC" })).status).toBe(429);
  });
});

describe("claim_invite", () => {
  it("without a session: marks accepted, leaves the account unlinked", async () => {
    const r = await call(null, "/rpc/claim_invite", { p_code: "CODEC", p_email: "cara@example.com" });
    expect(r).toEqual({ status: 200, json: { data: null } });
    expect(rows(db, "SELECT invite_status, client_user_id FROM clients WHERE id='cc'")[0]).toEqual({ invite_status: "accepted", client_user_id: null });
  });

  it("with a session whose email matches: links client_user_id", async () => {
    const cara: AuthUser = { id: "u-cara", email: "Cara@Example.com", email_verified: false, user_metadata: {} };
    await call(cara, "/rpc/claim_invite", { p_code: "CODEC", p_email: "cara@example.com" });
    expect(rows(db, "SELECT invite_status, client_user_id FROM clients WHERE id='cc'")[0]).toEqual({ invite_status: "accepted", client_user_id: "u-cara" });
  });

  it("with a session for a different email: accepts but does not link", async () => {
    await call(USERS.stranger, "/rpc/claim_invite", { p_code: "CODEC", p_email: "cara@example.com" });
    expect(rows(db, "SELECT client_user_id FROM clients WHERE id='cc'")[0].client_user_id).toBeNull();
  });

  it("wrong email or already-linked invites are untouched", async () => {
    await call(null, "/rpc/claim_invite", { p_code: "CODEC", p_email: "someone@else.com" });
    expect(rows(db, "SELECT invite_status FROM clients WHERE id='cc'")[0].invite_status).toBe("sent");
    await call(USERS.stranger, "/rpc/claim_invite", { p_code: "CODEA", p_email: "a@example.com" });
    expect(rows(db, "SELECT client_user_id FROM clients WHERE id='ca'")[0].client_user_id).toBe("u-a");
  });
});

describe("claim_invite_by_email", () => {
  const cara = (verified: boolean): AuthUser => ({ id: "u-cara", email: "CARA@example.com", email_verified: verified, user_metadata: {} });

  it("requires a session", async () => {
    expect((await call(null, "/rpc/claim_invite_by_email")).status).toBe(401);
  });

  it("requires a verified email", async () => {
    const r = await call(cara(false), "/rpc/claim_invite_by_email");
    expect(r.status).toBe(403);
    expect(rows(db, "SELECT client_user_id FROM clients WHERE id='cc'")[0].client_user_id).toBeNull();
  });

  it("links the matching unlinked row and returns [{id}]; idempotent", async () => {
    expect((await call(cara(true), "/rpc/claim_invite_by_email")).json).toEqual({ data: [{ id: "cc" }] });
    expect(rows(db, "SELECT invite_status, client_user_id FROM clients WHERE id='cc'")[0]).toEqual({ invite_status: "accepted", client_user_id: "u-cara" });
    expect((await call(cara(true), "/rpc/claim_invite_by_email")).json).toEqual({ data: [] });
  });

  it("never re-links rows that already have an account or have no email", async () => {
    db.raw.exec("INSERT INTO clients (id, trainer_id, email) VALUES ('blank', 'u-coach', '')");
    const blank: AuthUser = { id: "u-blank", email: "", email_verified: true, user_metadata: {} };
    expect((await call(blank, "/rpc/claim_invite_by_email")).json).toEqual({ data: [] });
    const imposter: AuthUser = { id: "u-imp", email: "a@example.com", email_verified: true, user_metadata: {} };
    expect((await call(imposter, "/rpc/claim_invite_by_email")).json).toEqual({ data: [] });
    expect(rows(db, "SELECT client_user_id FROM clients WHERE id='ca'")[0].client_user_id).toBe("u-a");
  });
});

describe("HTTP surface", () => {
  it("unknown RPC is 404", async () => {
    expect((await call(USERS.coach, "/rpc/exec_sql", {})).status).toBe(404);
  });

  it("/query requires a session", async () => {
    const r = await call(null, "/query", { table: "clients", op: "select" });
    expect(r.status).toBe(401);
  });

  it("/query returns the {data} envelope and is rate-limited per user", async () => {
    const r = await call(USERS.clientA, "/query", { table: "clients", op: "select", columns: "id" });
    expect(r).toEqual({ status: 200, json: { data: [{ id: "ca" }] } });
    expect(limiterKeys).toEqual(["u-a"]);
    limiterOk = false;
    expect((await call(USERS.clientA, "/query", { table: "clients", op: "select" })).status).toBe(429);
  });

  it("/query errors use the {error:{message,code}} envelope", async () => {
    const r = await call(USERS.clientB, "/query", { table: "client_data", op: "upsert", values: { client_id: "ca", section: "profile", data: {} }, onConflict: "client_id,section" });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("42501");
    const bad = await call(USERS.coach, "/query", { table: "nope", op: "select" });
    expect(bad.status).toBe(400);
  });
});
