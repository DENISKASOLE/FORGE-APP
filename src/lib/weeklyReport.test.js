import { describe, it, expect } from "vitest";
import { isoDate, addDays } from "./dateUtils.js";
import { buildWeeklyReport } from "./weeklyReport.js";

describe("buildWeeklyReport - nutrition redesign read path", () => {
  const today = isoDate();

  it("counts a day logged via the new nutrition_v2_logs shape", () => {
    const client = {
      trainingLogs: { sessions: [] }, checkIns: [], nutrition: {},
      nutritionV2Logs: { [today]: [{ id: "e1", date: today, meal: "breakfast", name: "Eggs", foodId: null, qty: null, unit: null, macros: { kcal: 400, protein: 30, carbs: 10, fat: 20 }, source: "quick", time: "08:00", planItemId: null, estimate: false, replaces: null, reason: null }] },
    };
    const report = buildWeeklyReport(client, 1);
    expect(report.weeks[0].nutritionDaysLogged).toBe(1);
    expect(report.weeks[0].avgCalories).toBe(400);
    expect(report.macrosOnly).toBe(false);
  });

  it("still carries forward a day that only exists in the OLD macro_log shape", () => {
    const yesterday = isoDate(addDays(new Date(`${today}T00:00:00`), -1));
    const client = {
      trainingLogs: { sessions: [] }, checkIns: [],
      nutrition: { macro_log: { [yesterday]: { breakfast: [{ id: "m1", foodId: "oats", name: "Oats", amount: 60, serving: "g", kcal: 228, protein: 8, carbs: 40, fats: 4, custom: false, loggedAt: `${yesterday}T07:30:00.000Z` }], lunch: [], dinner: [], snacks: [] } } },
      nutritionV2Logs: {},
    };
    const report = buildWeeklyReport(client, 1);
    expect(report.weeks[0].nutritionDaysLogged).toBeGreaterThanOrEqual(1);
  });

  it("a client with no nutrition data at all doesn't crash", () => {
    const client = { trainingLogs: { sessions: [] }, checkIns: [], nutrition: {} };
    expect(() => buildWeeklyReport(client, 4)).not.toThrow();
  });
});
