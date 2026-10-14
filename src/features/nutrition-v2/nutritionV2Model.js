// Nutrition v2 - the unified food-log/macros/prescribed-plan replacement
// (DECISIONS.md "Nutrition redesign"). Plain-JS factories, same convention
// as the feature it replaces (nutrition-plan/planModel.js) - this codebase
// has no TypeScript tooling, so a hand-written validator matches every
// other structured document here rather than introducing one.
//
// Adapted from the interactive prototype read directly from Denis's
// claude.ai/design project "Forge Nutrition coaching tab"
// (Forge Nutrition.dc.html) via the DesignSync tool - that file's own
// renderVals()/status()/confirmMeal()/etc. are the source of truth for
// every rule encoded here, just restated as plain exported functions
// instead of being embedded inline in one render method.
import { uid } from "../../lib/uid.js";

export const MEAL_KEYS = ["breakfast", "lunch", "dinner", "snack"];
export const MEAL_NAMES = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", other: "Other" };
export const LOG_SOURCES = ["confirm", "search", "quick", "photo", "sub"];
export const PLAN_STATUSES = ["draft", "published", "archived"];
const DEFAULT_TIME = { breakfast: "07:30", lunch: "12:30", dinner: "19:00", snack: "16:00" };
// Ported from the retired nutrition-plan feature's planModel.js (same
// Foods screen, FoodsLibraryScreen.jsx, just relocated here) rather than
// left behind on a file that's being deleted.
export const FOOD_CATEGORIES = ["protein", "carb", "fat", "veg", "fruit", "dairy", "drink", "snack", "other"];
export const FOOD_UNITS = ["g", "ml", "piece"];

export function emptyMacros() { return { kcal: 0, protein: 0, carbs: 0, fat: 0 }; }

// ---------- foods ----------
// Richer than the old per-100g-only library: a food's stated macros are
// "per basisGrams" (100g for most, but a container/scoop/egg/tbsp food can
// state its macros per-serving directly), and `servings` lists every unit
// a coach/client can type a quantity in, each with its own gram weight.
// normalizeFoodRow() upgrades last session's per-100g/ml/piece-only rows
// losslessly - no migration write needed, just a read-time default.
export function normalizeFoodRow(food) {
  if (food.basisGrams && food.servings?.length) return food;
  const unit = food.unit || "g";
  const servingLabel = unit === "ml" ? "ml" : unit === "piece" ? "piece" : "g";
  const servingGrams = unit === "piece" ? (food.pieceGrams || 1) : 1;
  return {
    ...food,
    basisGrams: 100,
    servings: [{ label: servingLabel, grams: servingGrams }, ...(servingLabel !== "g" ? [{ label: "g", grams: 1 }] : [])],
  };
}
// foodRow = a normalized row from the coach's food library (trainer_data "foods").
export function foodRefFromRow(foodRow) {
  const food = normalizeFoodRow(foodRow);
  return {
    foodId: food.id, name: food.name, brand: food.brand || null,
    basisGrams: food.basisGrams,
    macros: { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat },
    servings: food.servings,
  };
}
export function unitGramsFor(food, unitLabel) {
  const s = (food.servings || []).find((x) => x.label === unitLabel);
  return s ? s.grams : 1;
}

// ---------- plan items / meals / versions ----------
// A plan item snapshots both the macros AND the grams-per-unit at the
// moment it's added - never a live food-library lookup - so editing or
// archiving a food later never changes a historical plan or log (same
// principle as the feature this replaces).
export function newPlanItem(food, qty, unit) {
  return {
    id: uid(), foodId: food.foodId, name: food.name, qty, unit,
    unitGrams: unitGramsFor(food, unit),
    snapshot: { ...food.macros, basisGrams: food.basisGrams },
  };
}
export function newPlanMeal(key, time, note = "") {
  return { key, name: MEAL_NAMES[key] || key, time: time || DEFAULT_TIME[key] || "12:00", note, items: [] };
}
export function newPlanVersion({ version = 1, from = null, targets } = {}) {
  return {
    id: uid(), version, status: "draft", from, to: null, published: null,
    targets: targets || emptyMacros(),
    meals: MEAL_KEYS.map((k) => newPlanMeal(k)),
  };
}
export function cloneVersionWithNewIds(version) {
  return { ...version, id: uid(), meals: version.meals.map((m) => ({ ...m, items: m.items.map((it) => ({ ...it, id: uid() })) })) };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validatePlanVersion(plan) {
  const errors = [];
  if (!plan || typeof plan !== "object") return ["Plan is missing."];
  if (!plan.from) errors.push("Plan needs an effective-from date.");
  if (!PLAN_STATUSES.includes(plan.status)) errors.push("Invalid plan status.");
  (plan.meals || []).forEach((m) => {
    if (!TIME_RE.test(m.time || "")) errors.push(`${m.name}: time "${m.time}" isn't HH:MM (24h).`);
    (m.items || []).forEach((it) => {
      if (!(Number(it.qty) > 0)) errors.push(`${m.name} / ${it.name}: amount must be greater than 0.`);
    });
  });
  return errors;
}

// ---------- log entries ----------
// One flat per-date array, covering confirmed-planned, edited-portion,
// substituted AND free (search/quick/photo) entries alike - the whole
// point of the redesign being ONE unified log instead of three separate
// stores. macros is always a frozen value computed at write time, never
// re-derived from qty later, matching how plan items snapshot too.
export function newLogEntry({ date, meal, name, foodId = null, qty = null, unit = null, macros, source, time, planItemId = null, estimate = false, replaces = null, reason = null }) {
  if (!LOG_SOURCES.includes(source)) throw new Error(`Invalid log source: ${source}`);
  return { id: uid(), date, meal, name, foodId, qty, unit, macros: { ...emptyMacros(), ...macros }, source, time, planItemId, estimate, replaces, reason };
}
