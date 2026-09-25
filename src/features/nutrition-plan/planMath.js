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

// ---------- §6 Fuel log entries ----------
// One LogEntry shape (lib/nutritionPlan.js's DayLog.entries[itemId]) covers
// eaten/swapped/skipped so the day-total and adherence math never needs to
// know which action produced it - only the entry's own status/portion/macros.
export function allMealItems(day) {
  return (day.blocks || []).filter((b) => b.type === "meal").flatMap((b) => b.items.map((it) => ({ ...it, mealId: b.id })));
}
export function entryFromEatenItem(item, portion = 1) {
  const m = itemMacros(item);
  return {
    status: "eaten", portion, swapOptionId: null, name: item.food.name, amount: item.amount, unit: item.food.unit,
    kcal: m.kcal * portion, protein: m.protein * portion, carbs: m.carbs * portion, fat: m.fat * portion,
    loggedAt: new Date().toISOString(),
  };
}
export function entryFromSwap(swapOption) {
  const factor = (swapOption.food.unit === "piece" ? swapOption.amount * (swapOption.food.pieceGrams || 0) : swapOption.amount) / 100;
  const per100 = swapOption.food.per100;
  return {
    status: "swapped", portion: 1, swapOptionId: swapOption.id, name: swapOption.food.name, amount: swapOption.amount, unit: swapOption.food.unit,
    kcal: per100.kcal * factor, protein: per100.protein * factor, carbs: per100.carbs * factor, fat: per100.fat * factor,
    loggedAt: new Date().toISOString(),
  };
}
export function skippedEntry() {
  return { status: "skipped", portion: 0, swapOptionId: null, name: "", amount: 0, unit: "g", kcal: 0, protein: 0, carbs: 0, fat: 0, loggedAt: new Date().toISOString() };
}
export function extraTotals(extra) {
  if (!extra?.estimate?.items) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return sumMacros(extra.estimate.items.map((i) => ({ kcal: i.kcal || 0, protein: i.protein || 0, carbs: i.carbs || 0, fat: i.fat || 0 })));
}
export function loggedDayTotals(day, dayLog) {
  const itemTotal = sumMacros(allMealItems(day).map((it) => {
    const entry = dayLog.entries[it.id];
    return entry && entry.status !== "skipped" ? entry : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }));
  const extrasTotal = sumMacros((dayLog.extras || []).map(extraTotals));
  return sumMacros([itemTotal, extrasTotal]);
}

// ---------- §5.4 food-form macro sanity check ----------
// Warns (never blocks) when a food's stated kcal doesn't roughly match
// 4*protein + 4*carbs + 9*fat - catches typos (a decimal in the wrong
// place, protein/fat swapped) without stopping a coach entering a real
// food whose label genuinely rounds oddly.
export function macroSanityCheck({ kcal, protein, carbs, fat }) {
  const expected = 4 * (protein || 0) + 4 * (carbs || 0) + 9 * (fat || 0);
  if (expected <= 0) return { ok: true, expectedKcal: 0, pct: 0 };
  const pct = Math.abs((kcal || 0) - expected) / expected;
  return { ok: pct <= 0.15, expectedKcal: Math.round(expected), pct };
}

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

// ---------- §6.1 which plan day applies ----------
// Shared by the client Fuel tab and the Home ring hookup (§6.8) - both need
// to resolve "which PlanDay is today" the same way: a log row that already
// exists pins its dayId/planVersion (never re-derived); otherwise fall back
// to the active plan's weekly schedule for today's weekday.
export const DOW_KEY_BY_JS_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export function resolveSignedPlan(nutritionPlan, dayLog) {
  const active = nutritionPlan?.active;
  if (dayLog?.planVersion && active && active.version !== dayLog.planVersion) {
    const hist = (nutritionPlan?.history || []).find((h) => h.version === dayLog.planVersion);
    if (hist) return hist;
  }
  return active || null;
}
export function resolveDayForDate(signedPlan, dayLog, dateISO) {
  if (!signedPlan) return null;
  if (dayLog?.dayId) return signedPlan.doc.days.find((d) => d.id === dayLog.dayId) || null;
  const dowKey = DOW_KEY_BY_JS_DAY[new Date(`${dateISO}T00:00:00`).getDay()];
  const dayId = signedPlan.schedule?.[dowKey];
  return signedPlan.doc.days.find((d) => d.id === dayId) || null;
}

// ---------- §5.7 coach alerts ----------
// Computed client-side when the coach app loads (no automations Edge
// Function exists in this codebase to run it server-side), fed by
// CoachDashboard's computeNotifications. Thresholds live here, as the
// spec asks, rather than scattered at each call site.
export const LOW_ADHERENCE_THRESHOLD = 0.6;
export const LOW_ADHERENCE_WINDOW_DAYS = 3;
export const NO_LOG_STREAK_DAYS = 2;
export const HEAVY_EXTRAS_PCT = 0.15;
export const HEAVY_EXTRAS_DAYS_OF_7 = 3;

function isoDaysBefore(todayISO, n) {
  const d = new Date(`${todayISO}T00:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// "Complete" days only - yesterday backwards, never today (still in
// progress), and never before the plan's own start date.
function completeDaysBack(todayISO, startDate, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const date = isoDaysBefore(todayISO, i);
    if (date < startDate) break;
    out.push(date);
  }
  return out;
}
export function nutritionAlertSignals(nutritionPlan, logs, todayISO) {
  const active = nutritionPlan?.active;
  if (!active) return { lowAdherence: false, avgAdherence: null, noLogDays: 0, heavyExtrasDays: 0 };

  const sevenDays = completeDaysBack(todayISO, active.startDate, 7);
  const threeDays = sevenDays.slice(0, LOW_ADHERENCE_WINDOW_DAYS);
  const byId = Object.fromEntries(active.doc.days.map((d) => [d.id, d]));

  const adherenceScores = threeDays
    .map((date) => logs?.[date])
    .filter((l) => l && l.plannedItemCount)
    .map((l) => dayAdherence(l.entries || {}, l.plannedItemCount));
  const avgAdherence = adherenceScores.length ? adherenceScores.reduce((a, b) => a + b, 0) / adherenceScores.length : null;
  const lowAdherence = avgAdherence !== null && avgAdherence < LOW_ADHERENCE_THRESHOLD;

  let noLogDays = 0;
  for (const date of sevenDays) {
    const l = logs?.[date];
    const hasAnyLog = l && (Object.keys(l.entries || {}).length > 0 || (l.extras || []).length > 0);
    if (hasAnyLog) break;
    noLogDays += 1;
  }

  let heavyExtrasDays = 0;
  sevenDays.forEach((date) => {
    const l = logs?.[date];
    if (!l) return;
    const targetKcal = byId[l.dayId]?.targets?.kcal;
    if (!targetKcal) return;
    const extrasKcal = (l.extras || []).reduce((s, e) => s + extraTotals(e).kcal, 0);
    if (extrasKcal / targetKcal > HEAVY_EXTRAS_PCT) heavyExtrasDays += 1;
  });

  return { lowAdherence, avgAdherence, noLogDays, heavyExtrasDays };
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
