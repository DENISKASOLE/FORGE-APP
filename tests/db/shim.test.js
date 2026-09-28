// src/lib/forge/db.js: the supabase-js-shaped builder sends the right wire
// body for every call-site pattern and always resolves {data, error}.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { from, rpc } from "../../src/lib/forge/db.js";

let calls;
let reply;

beforeEach(() => {
  calls = [];
  reply = () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    return reply();
  }));
});
afterEach(() => vi.unstubAllGlobals());

const lastBody = () => calls.at(-1).body;

describe("query builder", () => {
  it("select with filters, order, limit, maybeSingle (screening/data.js)", async () => {
    reply = () => Response.json({ data: { id: "x" } });
    const res = await from("health_screenings").select("*").eq("client_id", "c1").order("signed_at", { ascending: false }).limit(1).maybeSingle();
    expect(res).toEqual({ data: { id: "x" }, error: null });
    expect(calls[0].url).toBe("/api/db/query");
    expect(calls[0].init.method).toBe("POST");
    expect(lastBody()).toEqual({
      table: "health_screenings", op: "select", columns: "*",
      filters: [{ col: "client_id", op: "eq", value: "c1" }],
      order: [{ col: "signed_at", ascending: false }], limit: 1, single: "maybe",
    });
  });

  it("in / neq / is filters (App.jsx loadCoach)", async () => {
    await from("client_data").select("*").in("client_id", ["a", "b"]).neq("section", "transformPhotos");
    expect(lastBody().filters).toEqual([{ col: "client_id", op: "in", value: ["a", "b"] }, { col: "section", op: "neq", value: "transformPhotos" }]);
    await from("clients").update({ trainer_id: "u" }).is("trainer_id", null);
    expect(lastBody()).toEqual({ table: "clients", op: "update", values: { trainer_id: "u" }, filters: [{ col: "trainer_id", op: "is", value: null }] });
  });

  it("insert().select().single() asks for returned rows", async () => {
    await from("clients").insert({ name: "n" }).select("*").single();
    expect(lastBody()).toEqual({ table: "clients", op: "insert", values: { name: "n" }, columns: "*", returning: true, single: "single", filters: [] });
    await from("buddy_pairs").insert({ coach_id: "c" }).select().single();
    expect(lastBody()).toMatchObject({ op: "insert", columns: "*", returning: true });
  });

  it("upsert with onConflict, delete with filters, multi-row insert", async () => {
    await from("client_data").upsert({ client_id: "c", section: "s", data: {} }, { onConflict: "client_id,section" });
    expect(lastBody()).toEqual({ table: "client_data", op: "upsert", values: { client_id: "c", section: "s", data: {} }, onConflict: "client_id,section", filters: [] });
    await from("buddy_members").delete().eq("pair_id", "p").eq("client_id", "c");
    expect(lastBody()).toEqual({ table: "buddy_members", op: "delete", filters: [{ col: "pair_id", op: "eq", value: "p" }, { col: "client_id", op: "eq", value: "c" }] });
    await from("buddy_members").insert([{ pair_id: "p", client_id: "a" }, { pair_id: "p", client_id: "b" }]);
    expect(lastBody().values).toHaveLength(2);
  });

  it("builders are immutable and re-usable", async () => {
    const base = from("clients").select("id");
    await base.eq("id", "a");
    await base;
    expect(calls[0].body.filters).toHaveLength(1);
    expect(calls[1].body.filters).toHaveLength(0);
  });

  it("API errors resolve to {data:null, error} without throwing", async () => {
    reply = () => Response.json({ error: { message: "new row violates row-level security policy", code: "42501" } }, { status: 403 });
    const res = await from("client_data").upsert({ client_id: "x", section: "s", data: {} });
    expect(res.data).toBeNull();
    expect(res.error).toMatchObject({ code: "42501", status: 403 });
  });

  it("network failures resolve to {error} so the offline queue can enqueue", async () => {
    fetch.mockImplementationOnce(async () => { throw new TypeError("Failed to fetch"); });
    const res = await from("client_data").upsert({ client_id: "x", section: "s", data: {} }, { onConflict: "client_id,section" });
    expect(res.data).toBeNull();
    expect(res.error.code).toBe("network");
  });

  it("works with await-less .then chains (CoachDashboard automations)", async () => {
    reply = () => Response.json({ data: { data: { rules: { a: 1 } } } });
    const seen = await new Promise((resolve) => {
      from("trainer_data").select("data").eq("trainer_id", "t").eq("section", "automations").maybeSingle().then(({ data }) => resolve(data));
    });
    expect(seen).toEqual({ data: { rules: { a: 1 } } });
  });
});

describe("rpc", () => {
  it("posts args to /api/db/rpc/:name", async () => {
    reply = () => Response.json({ data: [{ name: "A", email: "a@x" }] });
    const res = await rpc("lookup_invite", { p_code: "ABC" });
    expect(res).toEqual({ data: [{ name: "A", email: "a@x" }], error: null });
    expect(calls[0].url).toBe("/api/db/rpc/lookup_invite");
    expect(lastBody()).toEqual({ p_code: "ABC" });
    await rpc("claim_invite_by_email");
    expect(lastBody()).toEqual({});
  });

  it("errors resolve to {error}", async () => {
    reply = () => Response.json({ error: { message: "Not signed in", code: "unauthorized" } }, { status: 401 });
    const res = await rpc("claim_invite_by_email");
    expect(res).toMatchObject({ data: null, error: { code: "unauthorized", status: 401 } });
  });
});
