import { describe, it, expect } from "vitest";
import { mealOptionsFor } from "./fuelOptions.js";
import { foodRefFromRow, newPlanItem, newPlanMeal, newPlanVersion } from "./nutritionV2Model.js";

const chicken = { id: "chk", name: "Chicken breast, cooked", unit: "g", kcal: 165, protein: 31, carbs: 0, fat: 3.6 };
const beef = { id: "beef", name: "Lean beef", unit: "g", kcal: 180, protein: 28, carbs: 0, fat: 7.5 };

describe("mealOptionsFor - coach's options for one meal", () => {
  it("today's version first, then distinct other-day versions, duplicates dropped", () => {
    const plan = newPlanVersion({ from: "2026-01-01" });
    const lunch = newPlanMeal("lunch", "13:00"); lunch.items = [newPlanItem(foodRefFromRow(chicken), 180, "g")];
    plan.meals = [lunch];
    const beefLunch = newPlanMeal("lunch", "13:00"); beefLunch.items = [newPlanItem(foodRefFromRow(beef), 150, "g")];
    const sameAsToday = newPlanMeal("lunch", "13:00"); sameAsToday.items = [newPlanItem(foodRefFromRow(chicken), 180, "g")];
    plan.days = { "2": { meals: [beefLunch] }, "4": { meals: [sameAsToday] } };
    // 2026-11-18 is a Wednesday (day 3)
    const opts = mealOptionsFor(plan, lunch, "2026-11-18");
    expect(opts).toHaveLength(2);
    expect(opts[0].isToday).toBe(true);
    expect(opts[1].meal).toBe(beefLunch);
  });
  it("a plan with no rotation gives just today's meal", () => {
    const plan = newPlanVersion({ from: "2026-01-01" });
    const lunch = newPlanMeal("lunch"); lunch.items = [newPlanItem(foodRefFromRow(chicken), 100, "g")];
    plan.meals = [lunch];
    expect(mealOptionsFor(plan, lunch, "2026-11-18")).toHaveLength(1);
  });
});
