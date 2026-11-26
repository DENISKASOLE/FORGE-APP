import { describe, it, expect } from "vitest";
import { newChallenge, targetFor, dayState, challengeStats, addSet, removeSet, featuredChallenge, challengeStatus, endDate } from "./challenges.js";

const base = () => newChallenge({ name: "Push", exercise: "Push-ups", days: 10, startDate: "2026-11-01", target: { mode: "fixed", value: 50 } });

describe("challenges", () => {
  it("targets: fixed, ramp, none", () => {
    expect(targetFor(base(), 3)).toBe(50);
    expect(targetFor({ target: { mode: "ramp", start: 20, step: 2 } }, 5)).toBe(28);
    expect(targetFor({ target: { mode: "none" } }, 5)).toBe(0);
    expect(endDate(base())).toBe("2026-11-10");
  });
  it("day states and stats", () => {
    let ch = base();
    ch = addSet(ch, "2026-11-01", 30); ch = addSet(ch, "2026-11-01", 25); // hit (55)
    ch = addSet(ch, "2026-11-02", 50);                                     // hit
    ch = addSet(ch, "2026-11-03", 20);                                     // part
    // 11-04 missed, 11-05 hit, 11-06 = today with 10 logged
    ch = addSet(ch, "2026-11-05", 60);
    ch = addSet(ch, "2026-11-06", 10);
    const today = "2026-11-06";
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => dayState(ch, n, today))).toEqual(["hit", "hit", "part", "miss", "hit", "today", "future"]);
    const s = challengeStats(ch, today);
    expect(s).toMatchObject({ status: "active", dayNow: 6, total: 195, best: 60, hit: 3, streak: 1, today: 10, todayTarget: 50 });
  });
  it("no target: anything logged is a hit", () => {
    let ch = newChallenge({ exercise: "Plank", days: 3, startDate: "2026-11-01", target: { mode: "none" } });
    ch = addSet(ch, "2026-11-01", 5);
    expect(dayState(ch, 1, "2026-11-02")).toBe("hit");
    expect(dayState(ch, 2, "2026-11-02")).toBe("today");
  });
  it("remove a set; ignore zero/negative", () => {
    let ch = addSet(base(), "2026-11-01", 10);
    expect(addSet(ch, "2026-11-01", 0)).toBe(ch);
    ch = removeSet(ch, "2026-11-01", 0);
    expect(ch.logs["2026-11-01"]).toBeUndefined();
  });
  it("status and featured", () => {
    const ch = base();
    expect(challengeStatus(ch, "2026-10-31")).toBe("upcoming");
    expect(challengeStatus(ch, "2026-11-10")).toBe("active");
    expect(challengeStatus(ch, "2026-11-11")).toBe("finished");
    expect(featuredChallenge({ challenges: [ch] }, "2026-11-15")?.id).toBe(ch.id);
    expect(featuredChallenge({ challenges: [ch] }, "2026-12-30")).toBeNull();
  });
});
