import { describe, it, expect, beforeEach, beforeAll } from "vitest";

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
let S;
beforeAll(async () => { S = await import("./sync.js"); });

const tick = () => new Promise((r) => setTimeout(r, 0));
let sent;
let mode; // "ok" | "offline" | "reject"
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  S.__resetForTests();
  sent = [];
  mode = "ok";
  S.setSender(async (item) => {
    sent.push(item);
    if (mode === "offline") return { error: { message: "TypeError: Failed to fetch" }, status: 0 };
    if (mode === "reject") return { error: { message: "new row violates row-level security", code: "42501" }, status: 403 };
    return { error: null, status: 201 };
  });
});
const cd = (data, section = "training_logs") => ({ type: "client_data", clientId: "c1", section, data });

describe("sync outbox", () => {
  it("keeps only the latest version of a record and sends that", async () => {
    mode = "offline";
    S.queueWrite(cd({ sets: 1 }), { kick: false });
    S.queueWrite(cd({ sets: 2 }), { kick: false });
    S.queueWrite(cd({ sets: 3 }), { kick: false });
    expect(S.pendingCount()).toBe(1);
    mode = "ok";
    await S.flush();
    expect(sent.map((i) => i.data.sets)).toEqual([3]);
    expect(S.pendingCount()).toBe(0);
  });

  it("offline saves stay on the device and the caller is told it's queued", async () => {
    mode = "offline";
    const r = await S.saveAndWait(cd({ sets: 1 }), 500);
    expect(r).toEqual({ queued: true, error: null });
    expect(S.pendingCount()).toBe(1);
    expect(JSON.parse(store.forge_outbox_v2).items["cd:c1:training_logs"].data).toEqual({ sets: 1 });
    expect(S.getSyncStatus().offline).toBe(true);
    mode = "ok";
    await S.flush();
    expect(S.pendingCount()).toBe(0);
    expect(S.getSyncStatus().offline).toBe(false);
  });

  it("an older upload never deletes a newer save made while it was in flight", async () => {
    let release;
    S.setSender((item) => { sent.push(item); return new Promise((r) => { release = () => r({ error: null }); }); });
    S.queueWrite(cd({ sets: 1 }));
    await tick();
    S.queueWrite(cd({ sets: 2 }), { kick: false }); // logged while #1 uploads
    release();
    await tick(); await tick();
    expect(S.pendingCount()).toBe(1);
    release();
    await S.flush();
    await tick();
    release?.();
    await tick();
    expect(sent.map((i) => i.data.sets)).toEqual([1, 2]);
  });

  it("a server rejection is kept, flagged and reported - never dropped", async () => {
    mode = "reject";
    const r = await S.saveAndWait(cd({ x: 1 }, "profile"), 500);
    expect(r.queued).toBe(true);
    expect(r.error.code).toBe("42501");
    expect(S.pendingCount()).toBe(1);
    expect(S.getSyncStatus().failed).toBe(1);
  });

  it("successful saves resolve as not queued", async () => {
    const r = await S.saveAndWait(cd({ y: 1 }, "profile"), 500);
    expect(r).toEqual({ queued: false });
  });

  it("patches to the same clients row merge", async () => {
    mode = "offline";
    S.queueWrite({ type: "clients_update", clientId: "c1", patch: { name: "A" } }, { kick: false });
    S.queueWrite({ type: "clients_update", clientId: "c1", patch: { weight_kg: 80 } }, { kick: false });
    expect(S.pendingClientPatch("c1")).toEqual({ name: "A", weight_kg: 80 });
  });

  it("pending sections are readable for merging over server data", () => {
    S.queueWrite(cd({ sets: 9 }), { kick: false });
    expect(S.pendingClientSections("c1")).toEqual({ training_logs: { sets: 9 } });
    expect(S.hasPending("c1")).toBe(true);
    expect(S.hasPending("c2")).toBe(false);
  });

  it("moves the old append-only queue into the outbox, newest wins", async () => {
    store.forge_v47_pending_sync = JSON.stringify([cd({ v: "old" }), cd({ v: "new" })]);
    S.migrateLegacyQueue();
    expect(store.forge_v47_pending_sync).toBeUndefined();
    expect(S.pendingClientSections("c1").training_logs).toEqual({ v: "new" });
  });

  it("classifies network vs real errors", () => {
    expect(S.isRetryable({ message: "TypeError: Failed to fetch" }, 0)).toBe(true);
    expect(S.isRetryable({ name: "AbortError", message: "aborted" })).toBe(true);
    expect(S.isRetryable({ message: "JWT expired", code: "PGRST301" }, 401)).toBe(true);
    expect(S.isRetryable({ message: "server", code: "" }, 503)).toBe(true);
    expect(S.isRetryable({ message: "violates row-level security", code: "42501" }, 403)).toBe(false);
  });
});
