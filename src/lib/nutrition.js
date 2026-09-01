import { upsertSection } from "./clientData.js";
import { isoDate, startOfWeek } from "./dateUtils.js";

export const NUTRITION_PHASES = ["baseline", "report", "adjustment", "maintenance"];
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"];

export const SUPPLEMENT_TIMINGS = [
  { key: "any", label: "Any time" },
  { key: "morning", label: "Morning" },
  { key: "pre", label: "Pre-workout" },
  { key: "post", label: "Post-workout" },
  { key: "with_meals", label: "With meals" },
  { key: "bed", label: "Before bed" },
];

export const SUPPLEMENT_PRESETS = [
  { name: "Creatine monohydrate", dose: "5g", timing: "any" },
  { name: "Fish oil", dose: "2 caps", timing: "with_meals" },
  { name: "Vitamin D3", dose: "2000 IU", timing: "morning" },
  { name: "Magnesium", dose: "400mg", timing: "bed" },
  { name: "Multivitamin", dose: "1 tablet", timing: "morning" },
  { name: "Zinc", dose: "15mg", timing: "with_meals" },
  { name: "Electrolytes", dose: "1 serving", timing: "pre" },
];

export function weekOfFor(date = new Date()) {
  return isoDate(startOfWeek(date));
}

export function emptyMealEntry() {
  return { time: "", photo: "", description: "", method: "none", packaged: false, ingredients: [] };
}

export function emptyDayLog() {
  return { breakfast: null, lunch: null, dinner: null, snacks: [] };
}

// Daily habit log: steps (number), sleep/water (values from SLEEP_HOURS /
// WATER_LITERS in constants.js). All three are optional, logged
// independently of the meal diary but keyed by the same date.
export function emptyHabitLog() {
  return { steps: "", sleep: "", water: "" };
}

export function emptyNutritionState() {
  return {
    phase: "baseline",
    week_of: weekOfFor(),
    setup_complete: false,
    supplement_stack: [],
    food_log: {},
    habits: {},
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

export function normalizeHabitLog(raw) {
  return { ...emptyHabitLog(), ...(raw && typeof raw === "object" ? raw : {}) };
}

export function normalizeNutritionState(raw) {
  const base = emptyNutritionState();
  if (!raw || typeof raw !== "object") return base;
  const foodLog = {};
  Object.entries(raw.food_log || {}).forEach(([date, day]) => { foodLog[date] = normalizeDayLog(day); });
  const habits = {};
  Object.entries(raw.habits || {}).forEach(([date, day]) => { habits[date] = normalizeHabitLog(day); });
  return {
    phase: NUTRITION_PHASES.includes(raw.phase) ? raw.phase : base.phase,
    week_of: raw.week_of || base.week_of,
    setup_complete: !!raw.setup_complete,
    supplement_stack: Array.isArray(raw.supplement_stack) ? raw.supplement_stack : [],
    food_log: foodLog,
    habits,
    report: raw.report || null,
  };
}

export function dayLogFor(state, date) {
  return state.food_log[date] || emptyDayLog();
}

export function habitLogFor(state, date) {
  return state.habits?.[date] || emptyHabitLog();
}

export async function saveNutritionState(clientId, state) {
  await upsertSection(clientId, "nutrition", state);
}
