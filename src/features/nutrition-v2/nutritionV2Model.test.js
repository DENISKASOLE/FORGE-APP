import { describe, it, expect } from "vitest";
import { fatSecretFoodRow, foodRefFromRow, newPlanItem, newSavedMeal, newMealItem } from "./nutritionV2Model.js";
import { itemMacros } from "./nutritionV2Math.js";

describe("fatSecretFoodRow", () => {
  const fsFood = { id: "12345", name: "Egg, large", brand: "" };
  const serving = { desc: "1 large egg (50g)", kcal: 70, protein: 6, carbs: 0.4, fats: 5, amount: "50", unit: "g" };

  it("round-trips through foodRefFromRow + newPlanItem to exactly the serving's own macros x quantity", () => {
    const row = fatSecretFoodRow(fsFood, serving);
    const foodRef = foodRefFromRow(row);
    const item = newPlanItem(foodRef, 2, row.unit); // 2 servings
    const macros = itemMacros(item);
    expect(macros.kcal).toBeCloseTo(140, 5);
    expect(macros.protein).toBeCloseTo(12, 5);
    expect(macros.fat).toBeCloseTo(10, 5);
  });

  it("falls back to 1g basis when FatSecret gives no metric gram amount", () => {
    const noMetric = { desc: "1 cup", kcal: 100, protein: 2, carbs: 20, fats: 1, amount: "", unit: "" };
    const row = fatSecretFoodRow(fsFood, noMetric);
    expect(row.basisGrams).toBe(1);
    const foodRef = foodRefFromRow(row);
    const item = newPlanItem(foodRef, 3, row.unit);
    expect(itemMacros(item).kcal).toBeCloseTo(300, 5); // still scales linearly with qty
  });

  it("prefixes the id so a FatSecret pick can never collide with a local library food id", () => {
    const row = fatSecretFoodRow(fsFood, serving);
    expect(row.id).toBe("fs:12345");
  });
});

describe("newSavedMeal / newMealItem", () => {
  it("sums the macros of its items automatically", () => {
    const items = [
      newMealItem({ name: "Whey protein", qty: 1, unit: "scoop", macros: { kcal: 120, protein: 24, carbs: 2, fat: 1 } }),
      newMealItem({ name: "Banana", qty: 1, unit: "piece", macros: { kcal: 105, protein: 1, carbs: 27, fat: 0 } }),
    ];
    const meal = newSavedMeal({ name: "Post-workout shake", mealType: "snack", items });
    expect(meal.macros).toEqual({ kcal: 225, protein: 25, carbs: 29, fat: 1 });
    expect(meal.items).toHaveLength(2);
    expect(meal.useCount).toBe(0);
  });

  it("a meal with no items yet has zero macros rather than throwing", () => {
    const meal = newSavedMeal({ name: "New meal" });
    expect(meal.macros).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
