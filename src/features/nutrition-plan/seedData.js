// Appendix A seed data from NUTRITION_SPEC.md - the coach's food library
// is seeded from this on first open (only when empty, never overwriting
// real data), and Settings -> Nutrition guidelines the same way.
import { uid } from "../../lib/uid.js";

// One row per Appendix A table entry, per 100g/ml unless noted. `state`
// is shown in the food name in the plan/PDF ("Salmon fillet, raw").
const RAW_FOODS = [
  ["Greek yogurt 0%", "dairy", "g", null, 54, 10.4, 3.6, 0, 0, null, null],
  ["Rolled oats", "carb", "g", "dry", 380, 13, 66, 6.5, 10, null, null],
  ["Blueberries", "fruit", "g", null, 57, 0.7, 14.5, 0.3, 2.4, null, null],
  ["Raspberries", "fruit", "g", null, 52, 1.2, 12, 0.7, 6.5, null, null],
  ["Honey", "other", "g", null, 304, 0.3, 82, 0, 0, null, null],
  ["Chicken breast", "protein", "g", "cooked", 165, 31, 0, 3.6, 0, "Chicken breast, raw", 1.35],
  ["Lean beef mince 5%", "protein", "g", "cooked", 180, 28, 0, 7.5, 0, "Lean beef mince 5%, raw", 1.3],
  ["White fish (cod)", "protein", "g", "cooked", 105, 23, 0, 0.9, 0, "White fish, raw", 1.25],
  ["Firm tofu", "protein", "g", null, 144, 17, 3, 9, 2, null, null],
  ["Salmon fillet", "protein", "g", "raw", 208, 20, 0, 13.4, 0, null, null],
  ["Whey protein", "protein", "g", null, 400, 80, 10, 6.7, 0, null, null],
  ["Basmati rice", "carb", "g", "cooked", 130, 2.7, 28, 0.3, 0.4, "Basmati rice, dry", 0.35],
  ["Potatoes, boiled", "carb", "g", "cooked", 87, 1.9, 20, 0.1, 1.8, "Potatoes", 1],
  ["Wholewheat pasta", "carb", "g", "cooked", 124, 5.3, 26.5, 0.5, 4, "Wholewheat pasta, dry", 0.4],
  ["Sourdough", "carb", "g", null, 289, 11.8, 56, 1.8, 2.4, null, null],
  ["Sweet potato", "carb", "g", null, 86, 1.6, 20, 0.1, 3, null, null],
  ["Banana", "fruit", "piece", null, 89, 1.1, 22.8, 0.3, 2.6, null, null, 120],
  ["Medjool dates", "fruit", "piece", null, 277, 1.8, 75, 0.2, 6.7, null, null, 24],
  ["Broccoli", "veg", "g", null, 34, 2.8, 6.6, 0.4, 2.6, null, null],
  ["Mixed salad", "veg", "g", null, 20, 1.2, 3.5, 0.2, 1.5, null, null],
  ["Avocado", "fat", "g", null, 160, 2, 8.5, 14.7, 6.7, null, null],
  ["Almonds", "fat", "g", null, 579, 21, 22, 50, 12.5, null, null],
  ["Olive oil", "fat", "ml", null, 884, 0, 0, 100, 0, null, null],
];

export function seedFoods() {
  return RAW_FOODS.map(([name, category, unit, state, kcal, protein, carbs, fat, fibre, groceryName, groceryFactor, pieceGrams]) => ({
    id: uid(), name, brand: "", state, category, unit,
    pieceGrams: pieceGrams || null,
    kcal, protein, carbs, fat, fibre,
    groceryName, groceryFactor: groceryFactor || 1,
    archived: false,
  }));
}

export function seedGuidelines() {
  return [
    "Weights are cooked unless marked raw.",
    "Protein first at every meal.",
    "Swap only within the same row.",
    "One flexible meal a week. Keep the protein.",
    "Message me before changing anything else.",
  ];
}
