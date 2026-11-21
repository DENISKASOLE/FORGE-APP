import { describe, it, expect, vi } from "vitest";
vi.mock("../supabaseClient.js", () => ({ supabase: {} }));
vi.mock("./idb.js", () => ({ idbGet: async () => null, idbSet: async () => true }));
import { mergeRows, sinceFor } from "./coachRows.js";

const r = (c, s, t, data = {}) => ({ client_id: c, section: s, updated_at: t, data });

describe("coachRows", () => {
  it("full load stores rows and the newest server time", () => {
    const st = mergeRows(null, [r("a", "program", "2026-11-20T10:00:00Z"), r("b", "profile", "2026-11-21T09:00:00Z")], ["a", "b"], { full: true, now: 1000 });
    expect(Object.keys(st.rows)).toHaveLength(2);
    expect(st.syncedAt).toBe("2026-11-21T09:00:00Z");
    expect(st.fullAt).toBe(1000);
  });
  it("changed rows replace old ones, gone clients are dropped", () => {
    const st = mergeRows(null, [r("a", "program", "2026-11-20T10:00:00Z", { v: 1 }), r("b", "profile", "2026-11-20T10:00:00Z")], ["a", "b"], { full: true, now: 1 });
    const next = mergeRows(st, [r("a", "program", "2026-11-21T12:00:00Z", { v: 2 })], ["a"]);
    expect(next.rows["a|program"].data.v).toBe(2);
    expect(next.rows["b|profile"]).toBeUndefined();
    expect(next.syncedAt).toBe("2026-11-21T12:00:00Z");
    expect(next.fullAt).toBe(1);
  });
  it("asks for changes since 5 minutes before the newest row", () => {
    const now = Date.parse("2026-11-21T13:00:00Z");
    const st = { syncedAt: "2026-11-21T12:00:00Z", fullAt: now - 1000, clientIds: ["a"] };
    expect(sinceFor(st, ["a"], now)).toBe("2026-11-21T11:55:00.000Z");
  });
  it("full download when nothing stored, a new client appears, or a day has passed", () => {
    const now = Date.parse("2026-11-21T13:00:00Z");
    expect(sinceFor(null, ["a"], now)).toBeNull();
    expect(sinceFor({ syncedAt: "x", fullAt: now, clientIds: ["a"] }, ["a", "b"], now)).toBeNull();
    expect(sinceFor({ syncedAt: "2026-11-20T00:00:00Z", fullAt: now - 25 * 3600e3, clientIds: ["a"] }, ["a"], now)).toBeNull();
  });
});
