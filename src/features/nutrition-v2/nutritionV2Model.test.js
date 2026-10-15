import { describe, it, expect } from "vitest";
import { fatSecretFoodRow, foodRefFromRow, newPlanItem } from "./nutritionV2Model.js";
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
