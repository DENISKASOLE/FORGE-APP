import { describe, it, expect } from "vitest";
import { estimateOneRepMax, pbsInDateRange } from "./trainingLogs.js";

describe("estimateOneRepMax", () => {
  it("applies the Epley formula for a normal working set", () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });
  it("returns null above 10 reps - the formula is not trusted past that", () => {
    expect(estimateOneRepMax(60, 12)).toBeNull();
  });
  it("returns null with no load or no reps", () => {
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
  });
});

describe("pbsInDateRange", () => {
  function session(date, load, reps) {
    return {
      status: "completed", date,
      entries: [{ name: "Back squat", substitutedName: "", sets: [{ load, reps, done: true }] }],
    };
  }
  it("only returns PBs whose session date falls inside the range", () => {
    const logs = { sessions: [session("2026-01-01", 100, 5), session("2026-01-08", 110, 5), session("2026-01-15", 120, 5)] };
    const found = pbsInDateRange(logs, "2026-01-08", "2026-01-31");
    expect(found.map((pb) => pb.date)).toEqual(["2026-01-08", "2026-01-15"]);
  });
  it("still compares against full prior history, not just history inside the range", () => {
    const logs = { sessions: [session("2026-01-01", 130, 5), session("2026-02-01", 110, 5)] };
    // 110 < 130 (set outside the window) so Feb 1st is not a PB, even though
    // it's the first session actually inside the requested range.
    const found = pbsInDateRange(logs, "2026-02-01", "2026-02-28");
    expect(found).toEqual([]);
  });
  it("excludes first-ever-logged PBs, same as recentPBsAcrossHistory", () => {
    const logs = { sessions: [session("2026-03-01", 80, 5)] };
    const found = pbsInDateRange(logs, "2026-03-01", "2026-03-31");
    expect(found).toEqual([]);
  });
});
