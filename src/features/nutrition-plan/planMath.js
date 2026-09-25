// Pure functions only - no React, no Supabase - so they can be unit
// tested directly and reused identically by the builder UI, the client
// Fuel UI, and the PDF export, the same "one source of truth, many render
// targets" approach already used for the Weekly Report (lib/weeklyReport.js).
// See NUTRITION_SPEC.md §4 for the rules these implement.

// ---------- item / meal / day macros ----------

// grams: ml is treated like g (1ml ~= 1g for these macro tables, per spec
// §Appendix A note on olive oil). Keep sums unrounded; round only at the
// point of display.
export function itemGrams(item) {
  return item.food.unit === "piece" ? item.amount * (item.food.pieceGrams || 0) : item.amount;
}
export function itemMacros(item) {
  const factor = itemGrams(item) / 100;
  const per100 = item.food.per100;
  return {
    kcal: per100.kcal * factor, protein: per100.protein * factor,
    carbs: per100.carbs * factor, fat: per100.fat * factor,
  };
}
function sumMacros(list) {
  return list.reduce((t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}
export function mealTotals(meal) {
  if (meal.type !== "meal") return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return sumMacros(meal.items.map(itemMacros));
}
export function dayTotals(day) {
  return sumMacros((day.blocks || []).filter((b) => b.type === "meal").map(mealTotals));
}
export function roundMacros(m) {
  return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
}
export function fmtKcal(kcal) { return Math.round(kcal).toLocaleString("en-US"); }

// ---------- §4.2 target status chip ----------
// Worst (largest) deviation across kcal/P/C/F decides the chip; the chip
// text reports that same worst deviation, not an average of all four.
export function targetStatus(totals, targets) {
  const keys = ["kcal", "protein", "carbs", "fat"];
  let worstPct = 0;
  keys.forEach((k) => {
    if (!targets[k]) return;
    const dev = Math.abs(1 - totals[k] / targets[k]);
    if (dev > worstPct) worstPct = dev;
  });
  const pctLabel = Math.max(1, Math.round(worstPct * 100));
  if (worstPct <= 0.05) return { level: "good", label: `WITHIN ${pctLabel}%` };
  if (worstPct <= 0.10) return { level: "warn", label: `OFF BY ${pctLabel}%` };
  return { level: "bad", label: `OFF BY ${pctLabel}%` };
}
// Bar width for one macro: caps at 100% visually; caller decides to flip
// the number amber when over (pct > 1), per spec §4.2.
export function barPct(total, target) {
  if (!target) return 0;
  return Math.min(1, total / target) * 100;
}

// ---------- §4.3 adherence ----------
// itemScore per the spec's exact table. portion is on the LOG ENTRY, not
// the plan item - it's how much of the prescribed amount the client says
// they actually ate.
export function itemScore(entry) {
  if (!entry) return 0; // no entry yet
  if (entry.status === "skipped") return 0;
  if (entry.status === "eaten" || entry.status === "swapped") {
    const portion = entry.portion ?? 1;
    return portion >= 0.75 && portion <= 1.25 ? 1 : 0.5;
  }
  return 0;
}
// entriesByItemId: Map/object of itemId -> entry, for every item across
// every meal block in the day. plannedItemCount: total planned items that
// day (denominator) - passed in rather than recomputed here since the log
// row already stores it (spec's planned_items column) and it must stay
// fixed even if the plan doc is edited later.
export function dayAdherence(entriesByItemId, plannedItemCount) {
  if (!plannedItemCount) return null;
  let sum = 0;
  Object.values(entriesByItemId).forEach((entry) => { sum += itemScore(entry); });
  return sum / plannedItemCount;
}

// ---------- §4.4 swap amount suggestion ----------
// Default match: protein items match on protein, carb on carbs, fat on
// fat, anything else (veg/fruit/dairy/drink/snack/other) falls back to kcal.
const DEFAULT_MATCH = { protein: "protein", carb: "carbs", fat: "fat" };
export function suggestSwapAmount(sourceItem, swapFood, matchOn) {
  const match = matchOn || DEFAULT_MATCH[sourceItem.food.category] || "kcal";
  const sourceMacros = itemMacros(sourceItem);
  const sourceValue = sourceMacros[match];
  const swapPer100Value = swapFood.per100[match];
  if (!swapPer100Value) return { amount: 0, match, diff: 0 };
  const rawGrams = sourceValue / (swapPer100Value / 100);
  const grams = swapFood.unit === "piece"
    ? Math.round((rawGrams / (swapFood.pieceGrams || 1)) * 2) / 2 // nearest 0.5 piece
    : Math.round(rawGrams / 5) * 5; // nearest 5g
  const swapValue = (swapFood.unit === "piece" ? grams * (swapFood.pieceGrams || 0) : grams) / 100 * swapPer100Value;
  const diff = Math.max(1, Math.round(Math.abs(swapValue - sourceValue)));
  return { amount: grams, match, diff };
}

// ---------- §4.5 grocery list ----------
// schedule: { mon: dayId, tue: dayId, ... }. days: PlanDay[]. Rounds up
// per the spec's display rules; grouping is fixed to 3 columns.
const GROCERY_GROUPS = { protein: "PROTEIN", dairy: "PROTEIN", carb: "CARBS", fruit: "FRUIT", veg: "VEG & OTHER" };
function groceryGroupFor(category) { return GROCERY_GROUPS[category] || "VEG & OTHER"; }
function roundGroceryQty(qty, unit) {
  if (unit === "piece") return Math.ceil(qty);
  if (qty >= 1000) { const v = Math.round(qty / 100) / 10; return `${v % 1 === 0 ? v.toFixed(0) : v} ${unit === "ml" ? "L" : "kg"}`; }
  return `${Math.ceil(qty / 10) * 10} ${unit}`;
}
export function buildGroceryList(days, schedule) {
  const qtyByFood = new Map(); // foodId -> { food, qty }
  Object.values(schedule || {}).forEach((dayId) => {
    const day = days.find((d) => d.id === dayId);
    if (!day) return;
    (day.blocks || []).filter((b) => b.type === "meal").forEach((meal) => {
      meal.items.forEach((item) => {
        const existing = qtyByFood.get(item.food.foodId) || { food: item.food, qty: 0 };
        existing.qty += item.amount;
        qtyByFood.set(item.food.foodId, existing);
      });
    });
  });
  const groups = { PROTEIN: [], CARBS: [], FRUIT: [], "VEG & OTHER": [] };
  qtyByFood.forEach(({ food, qty }) => {
    const scaledQty = qty * (food.groceryFactor || 1);
    const label = food.groceryName || food.name;
    const display = roundGroceryQty(scaledQty, food.unit);
    groups[groceryGroupFor(food.category)].push({ label, display });
  });
  Object.values(groups).forEach((list) => list.sort((a, b) => a.label.localeCompare(b.label)));
  return groups;
}
