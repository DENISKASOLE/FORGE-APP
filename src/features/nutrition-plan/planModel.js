// PlanDoc — the coach-authored, client-ticked nutrition plan document.
// Adapted from NUTRITION_SPEC.md §3 (TypeScript in the spec) to plain JS
// factory functions + a hand-written validator, matching how every other
// structured document in this app is modeled (see programModel.js's
// newProgram/newBlock/etc.) - this codebase has no TypeScript tooling at
// all, so introducing one just for this feature would be a much bigger
// and riskier change than the library swaps already agreed with Denis.
//
// All ids are client-generated via uid() (the same helper every other
// feature in this app uses for ids) and never change once created - logs
// point at meal_id/item_id, so a stable id is load-bearing, not cosmetic.
import { uid } from "../../lib/uid.js";

export const FOOD_CATEGORIES = ["protein", "carb", "fat", "veg", "fruit", "dairy", "drink", "snack", "other"];
export const FOOD_UNITS = ["g", "ml", "piece"];
export const DAY_TYPES = ["training", "rest", "any"];
export const BLOCK_TYPES = ["meal", "swaps", "note", "education", "supplement", "hydration", "photo", "divider"];

export function emptyMacros() { return { kcal: 0, protein: 0, carbs: 0, fat: 0 }; }

// foodRow = a row from the coach's food library (trainer_data.foods).
// Denormalises the macros the plan actually needs so a later edit to the
// library, or the food being archived, never changes a signed plan or an
// old log - the whole point of copying rather than referencing.
export function foodRefFromRow(foodRow) {
  return {
    foodId: foodRow.id,
    name: foodRow.name,
    category: foodRow.category,
    unit: foodRow.unit,
    pieceGrams: foodRow.pieceGrams ?? null,
    per100: { kcal: foodRow.kcal, protein: foodRow.protein, carbs: foodRow.carbs, fat: foodRow.fat, fibre: foodRow.fibre ?? null },
    groceryName: foodRow.groceryName || null,
    groceryFactor: foodRow.groceryFactor || 1,
  };
}

export function newSwapOption(food, amount) { return { id: uid(), food, amount }; }
export function newMealItem(food, amount = food?.unit === "piece" ? 1 : 100) {
  return { id: uid(), food, amount, swaps: [], swapMatchOn: null };
}
export function newMealBlock(name = "MEAL", time = "12:00") {
  return { id: uid(), type: "meal", name, time, items: [], showTotals: true, allowSwaps: true };
}
export function newSwapsBlock(mealId, itemId) { return { id: uid(), type: "swaps", mealId, itemId }; }
export function newNoteBlock(text = "") { return { id: uid(), type: "note", text }; }
export function newEducationBlock(title = "", body = "", articleId = null) { return { id: uid(), type: "education", title, body, articleId }; }
export function newSupplementBlock() { return { id: uid(), type: "supplement", items: [] }; }
export function newHydrationBlock(litres = 3, trainingExtraLitres = 0) { return { id: uid(), type: "hydration", litres, trainingExtraLitres }; }
export function newPhotoBlock(source = "checkin") { return { id: uid(), type: "photo", source, poses: ["front", "side", "back"], imageUrl: null, caption: "" }; }
export function newDividerBlock(label = "") { return { id: uid(), type: "divider", label }; }

export function newPlanDay(name = "DAY 1", type = "training") {
  return {
    id: uid(), name, type, targets: emptyMacros(),
    blocks: [newMealBlock("BREAKFAST", "07:30"), newMealBlock("LUNCH", "13:00"), newMealBlock("DINNER", "20:00")],
  };
}

export function newPlanDoc(name = "New Plan") {
  return {
    schemaVersion: 1, name, goal: "",
    settings: { showGuidelines: true, showGrocery: true },
    guidelines: [],
    days: [newPlanDay()],
  };
}

// Deep-clones a doc with every id regenerated - used when the coach edits
// a per-client copy of a template (spec §5.3 step 5) so the copy can
// diverge freely without touching the template it came from.
export function cloneDocWithNewIds(doc) {
  const remapBlock = (b) => {
    if (b.type === "meal") return { ...b, id: uid(), items: b.items.map((it) => ({ ...it, id: uid(), swaps: it.swaps.map((s) => ({ ...s, id: uid() })) })) };
    return { ...b, id: uid() };
  };
  return {
    ...doc,
    days: doc.days.map((d) => ({ ...d, id: uid(), targets: { ...d.targets }, blocks: d.blocks.map(remapBlock) })),
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Hand-written rather than zod (not installed, and this app has no
// schema-validation library anywhere else either) - run on every load and
// before every save/sign per spec §3. Returns a plain string[] of
// problems, empty when valid, so callers can show them directly.
export function validatePlanDoc(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") return ["Plan is missing."];
  if (!doc.name?.trim()) errors.push("Plan needs a name.");
  if (!Array.isArray(doc.days) || doc.days.length === 0) { errors.push("Plan needs at least one day."); return errors; }

  doc.days.forEach((day, di) => {
    const dayLabel = day.name || `Day ${di + 1}`;
    if (!DAY_TYPES.includes(day.type)) errors.push(`${dayLabel}: invalid day type.`);
    const meals = (day.blocks || []).filter((b) => b.type === "meal");
    if (meals.length === 0) { errors.push(`${dayLabel}: needs at least one meal block.`); return; }
    meals.forEach((meal) => {
      if (!meal.items || meal.items.length === 0) errors.push(`${dayLabel} / ${meal.name || "meal"}: has no food items.`);
      if (!TIME_RE.test(meal.time || "")) errors.push(`${dayLabel} / ${meal.name || "meal"}: time "${meal.time}" isn't HH:MM (24h).`);
      (meal.items || []).forEach((item) => {
        if (!(Number(item.amount) > 0)) errors.push(`${dayLabel} / ${meal.name || "meal"} / ${item.food?.name || "item"}: amount must be greater than 0.`);
        if (item.food?.unit === "piece" && !(Number(item.food?.pieceGrams) > 0)) errors.push(`${dayLabel} / ${meal.name || "meal"} / ${item.food?.name || "item"}: piece foods need a gram weight.`);
      });
    });
  });
  return errors;
}

// ---------- §8.2 AI refine: applying a coach-accepted proposal ----------
// forge-nutrition-refine (see lib/ai.js's refineMealWithAI) never touches
// the doc itself - it only proposes `ops`. This is the one place those ops
// become a real MealBlock, called exactly once, at the moment the coach
// clicks Accept, so it lands as a single undo step like any other edit.
function refDrivenFood(op, foods) {
  if (op.foodId) {
    const row = foods.find((f) => f.id === op.foodId);
    if (row) return foodRefFromRow(row);
  }
  if (op.newFood) {
    return {
      foodId: null, name: op.newFood.name || "Unnamed food", category: "other", unit: op.newFood.unit || "g", pieceGrams: null,
      per100: { kcal: op.newFood.kcal || 0, protein: op.newFood.protein || 0, carbs: op.newFood.carbs || 0, fat: op.newFood.fat || 0, fibre: op.newFood.fibre ?? null },
      groceryName: null, groceryFactor: 1,
    };
  }
  return null;
}
export function applyRefineOps(meal, ops, foods) {
  let items = [...meal.items];
  for (const op of ops || []) {
    if (op.op === "remove") {
      items = items.filter((it) => it.id !== op.itemId);
    } else if (op.op === "set_amount") {
      items = items.map((it) => (it.id === op.itemId ? { ...it, amount: Number(op.amount) || it.amount } : it));
    } else if (op.op === "replace") {
      const food = refDrivenFood(op, foods);
      if (!food) continue;
      items = items.map((it) => (it.id === op.itemId ? { ...it, food, swaps: [] } : it));
    } else if (op.op === "add") {
      const food = refDrivenFood(op, foods);
      if (!food) continue;
      items = [...items, newMealItem(food, op.amount || (food.unit === "piece" ? 1 : 100))];
    }
  }
  return { ...meal, items };
}
