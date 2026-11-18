import { mealTotals, resolvePlanDayNum, dayOfWeekISO } from "./nutritionV2Math.js";

function itemsSignature(items) {
  return items.map((it) => `${it.foodId || it.name}:${it.qty}${it.unit}`).sort().join("|");
}
export function shortTitle(items) {
  if (!items.length) return "Nothing planned";
  const first = items[0].name.split(",")[0].trim();
  return items.length > 1 ? `${first} +${items.length - 1}` : first;
}
// "Coach's options" = today's prescribed version of this meal first, then
// every distinct version of the same meal on the plan's other rotation
// days - the same coach-approved pool the swap sheet has always offered,
// shown up front as chips (Nov 2026 redesign).
export function mealOptionsFor(plan, meal, dateISO) {
  const today = dayOfWeekISO(dateISO);
  const seen = new Set([itemsSignature(meal.items)]);
  const opts = [{ id: "today", meal, totals: mealTotals(meal), title: shortTitle(meal.items), isToday: true }];
  for (let d = 1; d <= 7; d++) {
    if (d === today) continue;
    const m = resolvePlanDayNum(plan, d)?.meals?.find((x) => x.key === meal.key);
    if (!m || !m.items.length) continue;
    const sig = itemsSignature(m.items);
    if (seen.has(sig)) continue;
    seen.add(sig);
    opts.push({ id: `d${d}`, meal: m, totals: mealTotals(m), title: shortTitle(m.items), isToday: false });
  }
  return opts;
}

