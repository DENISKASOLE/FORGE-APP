import { describe, it, expect } from "vitest";
import { weekDays, habitRows, summarize, insightFor, lastWeeks, fmtShort } from "./habitsData.js";

const nutrition = { habits: { "2026-11-18": { steps: "10000", sleep: "6", water: "2.5" }, "2026-11-14": { steps: "11400", sleep: "8", water: "3.2" } } };
describe("habitsData", () => {
  it("builds the last 7 days ending today", () => {
    const d = weekDays("2026-11-19");
    expect(d[0]).toBe("2026-11-13"); expect(d[6]).toBe("2026-11-19");
  });
  it("averages logged days only and counts goal hits", () => {
    const s = summarize(habitRows(nutrition, weekDays("2026-11-19")));
    expect(s.daysLogged).toBe(2);
    expect(s.steps.avg).toBe(10700); expect(s.steps.hits).toBe(2);
    expect(s.sleep.hits).toBe(1); expect(s.water.hits).toBe(1);
  });
  it("names the weakest habit", () => {
    const s = summarize(habitRows(nutrition, weekDays("2026-11-19")));
    expect(insightFor(s)).toMatch(/^Sleep is the weak spot/);
    expect(insightFor(summarize([]))).toBe("No habits logged this week.");
  });
  it("gives 4 weekly averages", () => {
    const w = lastWeeks(nutrition, "2026-11-19");
    expect(w).toHaveLength(4); expect(w[3].steps).toBe(10700); expect(w[0].steps).toBeNull();
    expect(fmtShort("steps", 10700)).toBe("10.7k");
  });
});
