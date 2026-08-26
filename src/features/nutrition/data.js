import { upsertSection } from "../../lib/clientData.js";
import { isoDate, startOfWeek } from "../../lib/dateUtils.js";

export const NUTRITION_PHASES = ["baseline", "report", "adjustment", "maintenance"];
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"];

export function weekOfFor(date = new Date()) {
  return isoDate(startOfWeek(date));
}

export function emptyMealEntry() {
  return { time: "", photo: "", description: "", method: "none", packaged: false, ingredients: [] };
}

export function emptyDayLog() {
  return { breakfast: null, lunch: null, dinner: null, snacks: [] };
}

export function emptyNutritionState() {
  return {
    phase: "baseline",
    week_of: weekOfFor(),
    supplement_stack: [],
    food_log: {},
    report: null,
  };
}

export function normalizeDayLog(raw) {
  const day = emptyDayLog();
  if (!raw || typeof raw !== "object") return day;
  MEAL_SLOTS.forEach((slot) => { if (raw[slot]) day[slot] = { ...emptyMealEntry(), ...raw[slot] }; });
  day.snacks = Array.isArray(raw.snacks) ? raw.snacks.map((s) => ({ ...emptyMealEntry(), ...s })) : [];
  return day;
}

export function normalizeNutritionState(raw) {
  const base = emptyNutritionState();
  if (!raw || typeof raw !== "object") return base;
  const foodLog = {};
  Object.entries(raw.food_log || {}).forEach(([date, day]) => { foodLog[date] = normalizeDayLog(day); });
  return {
    phase: NUTRITION_PHASES.includes(raw.phase) ? raw.phase : base.phase,
    week_of: raw.week_of || base.week_of,
    supplement_stack: Array.isArray(raw.supplement_stack) ? raw.supplement_stack : [],
    food_log: foodLog,
    report: raw.report || null,
  };
}

export function dayLogFor(state, date) {
  return state.food_log[date] || emptyDayLog();
}

export async function saveNutritionState(clientId, state) {
  await upsertSection(clientId, "nutrition", state);
}
