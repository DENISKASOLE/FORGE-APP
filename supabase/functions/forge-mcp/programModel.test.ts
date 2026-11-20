import { describe, it, expect } from "vitest";
import { hydrateProgram, spliceWeeks, sessionsInWeeks } from "./programModel.ts";

const wk = (name: string) => ({ workouts: [{ name, dayOfWeek: 1, blocks: [{ exercises: [{ name: "Squat", sets: [{}] }] }] }] });
const existing = hydrateProgram({ name: "P", weeks: [wk("a"), wk("b"), wk("c")] });

describe("spliceWeeks", () => {
  it("replaces from startWeek, keeps earlier weeks untouched and the replaced week's id", () => {
    const add = hydrateProgram({ name: "x", weeks: [wk("new1"), wk("new2"), wk("new3")] }).weeks;
    const out = spliceWeeks(existing, add, 3);
    expect(out.weeks).toHaveLength(5);
    expect(out.weeks[0]).toEqual(existing.weeks[0]);
    expect(out.weeks[1]).toEqual(existing.weeks[1]);
    expect(out.weeks[2].id).toBe(existing.weeks[2].id);
    expect(out.weeks[2].workouts[0].name).toBe("new1");
    expect(out.weeks.map((w: any) => w.weekNum)).toEqual([1, 2, 3, 4, 5]);
    expect(out.id).toBe(existing.id);
  });
  it("appends right after the end", () => {
    const add = hydrateProgram({ name: "x", weeks: [wk("n")] }).weeks;
    expect(spliceWeeks(existing, add, 4).weeks).toHaveLength(4);
  });
  it("keeps weeks after the replaced range", () => {
    const add = hydrateProgram({ name: "x", weeks: [wk("n")] }).weeks;
    const out = spliceWeeks(existing, add, 2);
    expect(out.weeks[2]).toEqual({ ...existing.weeks[2], weekNum: 3 });
  });
  it("refuses a gap", () => {
    expect(() => spliceWeeks(existing, [], 6)).toThrow(/between 1 and 4/);
  });
});

describe("sessionsInWeeks", () => {
  it("finds sessions logged in the given weeks", () => {
    const logs = { sessions: [{ weekId: existing.weeks[2].id, weekNum: 3 }, { weekId: "other" }] };
    expect(sessionsInWeeks(logs, [existing.weeks[2].id])).toHaveLength(1);
  });
});
