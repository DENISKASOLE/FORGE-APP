// Ported, dependency-free subset of nutritionV2Model.js + nutritionV2Math.js -
// just enough to build and publish a plan version in exactly the shape
// the nutrition app already reads (CoachPlanBuilderV2.jsx, NutritionV2Flow.jsx).
// Items are built "quick-log style" (macros given directly as a total for
// the item, no foodId / food-library lookup) - the same path the
// client-facing "Describe it" fallback already uses, so there's no
// food-matching problem to solve here. basisGrams is deliberately set
// equal to qty (with unitGrams fixed at 1) so the app's own
// itemMacros()/mealTotals() scaling factor (qty*unitGrams/basisGrams)
// always resolves to exactly 1 - the snapshot macros are used as given.
const MEAL_NAMES: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const DEFAULT_TIME: Record<string, string> = { breakfast: "07:30", lunch: "12:30", dinner: "19:00", snack: "16:00" };
const uid = () => crypto.randomUUID();

export function emptyMacros() { return { kcal: 0, protein: 0, carbs: 0, fat: 0 }; }

export function buildPlanItem(input: { name: string; qty?: number; unit?: string; kcal: number; protein: number; carbs: number; fat: number }) {
  const qty = input.qty && input.qty > 0 ? input.qty : 1;
  return {
    id: uid(), foodId: null, name: input.name, qty, unit: input.unit || "serving", unitGrams: 1,
    snapshot: { kcal: input.kcal || 0, protein: input.protein || 0, carbs: input.carbs || 0, fat: input.fat || 0, basisGrams: qty },
  };
}
export function buildMeal(key: string, time: string | undefined, items: any[], note?: string) {
  return { key, name: MEAL_NAMES[key] || key, time: time || DEFAULT_TIME[key] || "12:00", note: note || "", items };
}
export function buildPlanVersion(input: { version: number; from: string; targets?: any; meals: any[]; publish: boolean; days?: Record<string, any> }) {
  return {
    id: uid(), version: input.version, status: input.publish ? "published" : "draft",
    from: input.from, to: null, published: input.publish ? new Date().toISOString() : null,
    targets: input.targets && Object.keys(input.targets).length ? { ...emptyMacros(), ...input.targets } : emptyMacros(),
    meals: input.meals,
    ...(input.days && Object.keys(input.days).length ? { days: input.days } : {}),
  };
}

// Local date-component formatting, not toISOString() (which converts to
// UTC first) - matches src/lib/dateUtils.js's isoDate() exactly. Using
// toISOString() here reproduces the "Dubai 23:59 vs 00:01" class of
// off-by-one bug this codebase explicitly guards against elsewhere.
function addDaysISO(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Ported verbatim from nutritionV2Math.js's publishPlan: archives any
// published version whose effective date is superseded before it ever
// started, and narrows the `to` date of the one it actually replaces.
export function publishPlan(plans: any[], draft: any, publishedAtISO: string): any[] {
  const updated = (plans || []).map((p: any) => {
    if (p.status !== "published") return p;
    if (p.from >= draft.from) return { ...p, status: "archived" };
    if (!p.to || p.to >= draft.from) return { ...p, to: addDaysISO(draft.from, -1) };
    return p;
  });
  const published = { ...draft, status: "published", to: null, published: publishedAtISO };
  return [...updated, published];
}

// Weekly rotation - ported from nutritionV2Math.js. A version may carry
// `days` keyed "1".."7" (Mon..Sun); each can override that weekday's
// meals/targets/label. planVersionForDate = stored version;
// planForDate = resolved to the weekday, exactly as the app reads it.
export function dayOfWeekISO(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00`).getDay();
  return d === 0 ? 7 : d;
}
export function resolvePlanDay(plan: any, dateISO: string): any {
  if (!plan) return null;
  const day = plan.days?.[String(dayOfWeekISO(dateISO))];
  if (!day) return plan;
  return {
    ...plan,
    meals: Array.isArray(day.meals) && day.meals.length ? day.meals : plan.meals,
    targets: day.targets ? { ...emptyMacros(), ...day.targets } : plan.targets,
    dayLabel: day.label || "",
  };
}
export function planVersionForDate(plans: any[], dateISO: string): any {
  return (plans || []).find((p: any) => p.status === "published" && p.from <= dateISO && (!p.to || p.to >= dateISO)) || null;
}
export function planForDate(plans: any[], dateISO: string): any {
  return resolvePlanDay(planVersionForDate(plans, dateISO), dateISO);
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function validatePlanVersion(plan: any): string[] {
  const errors: string[] = [];
  if (!plan?.from) errors.push("Plan needs an effective-from date.");
  const DAY_NAMES: Record<string, string> = { "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "7": "Sun" };
  const checkMeals = (meals: any[], prefix: string) => (meals || []).forEach((m: any) => {
    if (!TIME_RE.test(m.time || "")) errors.push(`${prefix}${m.name}: time "${m.time}" isn't HH:MM (24h).`);
    (m.items || []).forEach((it: any) => { if (!(Number(it.qty) > 0)) errors.push(`${prefix}${m.name} / ${it.name}: amount must be greater than 0.`); });
  });
  checkMeals(plan?.meals, "");
  Object.entries(plan?.days || {}).forEach(([k, d]: [string, any]) => checkMeals(d?.meals, `${DAY_NAMES[k] || k} · `));
  return errors;
}
