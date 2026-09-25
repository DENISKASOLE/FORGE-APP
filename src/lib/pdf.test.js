import { describe, it, expect } from "vitest";
import { buildNutritionPlanPDF } from "./pdf.js";
import { newPlanDoc, newMealItem, foodRefFromRow, newSwapOption } from "../features/nutrition-plan/planModel.js";

// Smoke test only - there's no way to visually verify a PDF's layout here,
// but this at least catches the class of bug that slipped through once
// already this session (a genuine build failure that still reported exit
// code 0): a pdf-lib call throwing at runtime (bad drawText/drawRectangle
// args, an unresolved import) that a production `vite build` alone won't
// catch, since JSX-free library code type-checks fine even when broken.
function food(overrides) {
  return { id: "f1", name: "Chicken breast", brand: "", state: "raw", category: "protein", unit: "g", pieceGrams: null, kcal: 165, protein: 31, carbs: 0, fat: 3.6, fibre: null, groceryName: "Chicken breast, raw", groceryFactor: 1.35, archived: false, ...overrides };
}
function ricefood() {
  return food({ id: "f2", name: "Basmati rice", category: "carb", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, groceryName: "Basmati rice, dry", groceryFactor: 0.35 });
}

describe("buildNutritionPlanPDF (smoke)", () => {
  it("builds a non-empty PDF blob for a minimal one-day, one-meal plan with no swaps/guidelines/photos", async () => {
    const doc = newPlanDoc("Fat Loss Phase 1");
    doc.days = [doc.days[0]];
    const meal = doc.days[0].blocks[0]; // "BREAKFAST" from newPlanDay()
    meal.items = [newMealItem(foodRefFromRow(food()), 150)];
    const swapItem = newMealItem(foodRefFromRow(ricefood()), 200);
    swapItem.swaps = [newSwapOption(foodRefFromRow(food({ id: "f3", name: "Sourdough", category: "carb" })), 80)];
    doc.days[0].blocks[1].items = [swapItem]; // "LUNCH"
    doc.settings.showGuidelines = false;
    doc.settings.showGrocery = true;

    const signedPlan = { version: 1, doc, schedule: { mon: doc.days[0].id, tue: doc.days[0].id, wed: doc.days[0].id, thu: doc.days[0].id, fri: doc.days[0].id, sat: doc.days[0].id, sun: doc.days[0].id }, startDate: "2026-09-25", coachNote: "Hit protein first at every meal." };
    const client = { name: "Test Client", transformPhotos: [] };

    const blob = await buildNutritionPlanPDF(client, signedPlan);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toBe("application/pdf");
  });
});
