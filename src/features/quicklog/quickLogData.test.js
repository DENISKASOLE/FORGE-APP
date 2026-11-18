import { describe, it, expect, vi } from "vitest";
vi.mock("../../supabaseClient.js", () => ({ supabase: {} }));
import { mealChoices, foodEntry } from "./quickLogData.js";
import { mealOutcomeFor } from "../nutrition-v2/nutritionV2Math.js";
import { weightHistoryFromCheckins } from "../../lib/clientMetrics.js";
import { foodRefFromRow, newPlanItem, newPlanMeal, newPlanVersion } from "../nutrition-v2/nutritionV2Model.js";

const chicken = { id: "chk", name: "Chicken", unit: "g", kcal: 165, protein: 31, carbs: 0, fat: 3.6 };
function planWith(meals) { const p = newPlanVersion({ from: "2026-01-01" }); p.status = "published"; p.meals = meals; return p; }

describe("mealChoices", () => {
  it("defaults to the first meal not logged yet", () => {
    const b = newPlanMeal("breakfast", "08:00"); b.items = [newPlanItem(foodRefFromRow(chicken), 100, "g")];
    const l = newPlanMeal("lunch", "13:00"); l.items = [newPlanItem(foodRefFromRow(chicken), 100, "g")];
    const client = { nutritionV2Plans: [planWith([b, l])], nutritionV2Logs: { "2026-11-18": [{ meal: "breakfast", source: "confirm" }] } };
    const r = mealChoices(client, "2026-11-18", new Date("2026-11-18T09:00:00"));
    expect(r.defaultKey).toBe("lunch");
    expect(r.meals.map((m) => m.key)).toEqual(["breakfast", "lunch"]);
  });
  it("without a plan, picks the next meal by time", () => {
    const r = mealChoices({}, "2026-11-18", new Date("2026-11-18T15:00:00"));
    expect(r.defaultKey).toBe("snack");
  });
});

describe("foodEntry", () => {
  it("multiplies a serving by quantity and marks it as an extra", () => {
    const e = foodEntry({ food: { id: "1", name: "Banana", brand: "" }, serving: { desc: "1 medium", kcal: 105, protein: 1.3, carbs: 27, fats: 0.4 }, qty: 2, mealKey: "snack", dateISO: "2026-11-18" });
    expect(e.macros.kcal).toBe(210);
    expect(e.macros.fat).toBeCloseTo(0.8);
    expect(e.extra).toBe(true);
    expect(e.source).toBe("quick");
  });
});

describe("extras never decide a meal's outcome", () => {
  it("a meal with only an extra is still open", () => {
    const l = newPlanMeal("lunch", "13:00");
    expect(mealOutcomeFor("2026-11-18", "2026-11-18", l, [{ meal: "lunch", source: "quick", extra: true }], {})).toBe("missed");
    expect(mealOutcomeFor("2026-11-18", "2026-11-18", l, [{ meal: "lunch", source: "quick", extra: true }, { meal: "lunch", source: "confirm" }], {})).toBe("planned");
  });
});

describe("weight history", () => {
  it("merges check-in weights with quick-log weights, quick-log winning on the same day", () => {
    const checkIns = [{ date: "2026-11-01", answers: [{ question: "Weight (kg)", answer: "80" }] }, { date: "2026-11-08", answers: [{ question: "Weight", answer: "79.5" }] }];
    const mh = [{ date: "2026-11-08", weight: 79.2 }, { date: "2026-11-15", weight: 78.8 }];
    expect(weightHistoryFromCheckins(checkIns, mh)).toEqual([{ date: "2026-11-01", value: 80 }, { date: "2026-11-08", value: 79.2 }, { date: "2026-11-15", value: 78.8 }]);
  });
});
