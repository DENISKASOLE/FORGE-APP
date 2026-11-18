// Pure helpers + writers for the + quick-log menu (Nov 2026). Every write
// goes to the SAME stores the rest of the app already reads, so nothing
// logged here is a second source of truth:
//   food      -> client.nutritionV2Logs (section nutrition_v2_logs)
//   habits    -> client.nutrition.habits[date] (section nutrition)
//   weight /  -> client.measurementsHistory (section measurements_history)
//   measurements  + the latest-snapshot (section progress)
import { isoDate } from "../../lib/dateUtils.js";
import { uid } from "../../lib/uid.js";
import { normalizeLogs, normalizePlans, saveLogs } from "../../lib/nutritionV2.js";
import { habitLogFor, saveNutritionState } from "../../lib/nutrition.js";
import { normalizeMeasurementHistory, newMeasurementEntry, saveMeasurementHistory, saveLatestMeasurementsSnapshot } from "../../lib/progressReports.js";
import { planForDate, mealOutcomeFor } from "../nutrition-v2/nutritionV2Math.js";

const FALLBACK_MEALS = [
  { key: "breakfast", name: "Breakfast", time: "08:00" },
  { key: "lunch", name: "Lunch", time: "13:00" },
  { key: "snack", name: "Snack", time: "16:30" },
  { key: "dinner", name: "Dinner", time: "19:30" },
];

function nowHHMM(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Today's meals (from the client's plan, else a default four) and which one
// to pre-select: the first meal not logged yet, else the one closest to now.
export function mealChoices(client, dateISO = isoDate(), now = new Date()) {
  const plan = planForDate(normalizePlans(client.nutritionV2Plans), dateISO);
  const meals = plan?.meals?.length ? [...plan.meals].sort((a, b) => a.time.localeCompare(b.time)) : FALLBACK_MEALS;
  const entries = normalizeLogs(client.nutritionV2Logs)[dateISO] || [];
  const open = plan?.meals?.length ? meals.find((m) => mealOutcomeFor(dateISO, dateISO, m, entries, {}) === "missed") : null;
  const hhmm = nowHHMM(now);
  const upcoming = meals.find((m) => m.time >= hhmm);
  const def = open || upcoming || meals[meals.length - 1];
  return { meals: meals.map((m) => ({ key: m.key, name: m.name, time: m.time })), defaultKey: def.key };
}

// A FatSecret serving x quantity -> one log entry. `extra: true` marks it
// as added on top of the meal (not the planned meal itself), so logging
// the meal as planned later keeps it, and it never counts as the meal's
// outcome. source "quick" = the coach dashboard shows it as off-plan food.
export function foodEntry({ food, serving, qty, mealKey, dateISO = isoDate(), now = new Date() }) {
  const m = Number(qty) || 0;
  return {
    id: uid(), date: dateISO, meal: mealKey, name: food.brand ? `${food.name} (${food.brand})` : food.name,
    foodId: food.id ? `fs:${food.id}` : null, qty: m, unit: serving.desc || "serving",
    macros: { kcal: (serving.kcal || 0) * m, protein: (serving.protein || 0) * m, carbs: (serving.carbs || 0) * m, fat: (serving.fats || 0) * m },
    source: "quick", time: nowHHMM(now), planItemId: null, estimate: false, replaces: null, reason: null, photo: null, extra: true,
  };
}

export async function addFoodEntry(client, updateClient, entry) {
  const logs = normalizeLogs(client.nutritionV2Logs);
  const next = { ...logs, [entry.date]: [...(logs[entry.date] || []), entry] };
  updateClient({ ...client, nutritionV2Logs: next });
  await saveLogs(client.id, next);
}

export function todaysHabits(client, dateISO = isoDate()) {
  return habitLogFor(client.nutrition || {}, dateISO);
}
export async function saveHabit(client, updateClient, key, value, dateISO = isoDate()) {
  const nutrition = client.nutrition || {};
  const nextDay = { ...habitLogFor(nutrition, dateISO), [key]: value };
  const updated = { ...nutrition, habits: { ...(nutrition.habits || {}), [dateISO]: nextDay } };
  updateClient({ ...client, nutrition: updated });
  await saveNutritionState(client.id, updated);
}

export function latestWeight(client) {
  const h = normalizeMeasurementHistory(client.measurementsHistory).filter((e) => parseFloat(e.weight) > 0);
  return h.length ? parseFloat([...h].sort((a, b) => a.date.localeCompare(b.date))[h.length - 1].weight) : null;
}
export async function saveMeasurements(client, updateClient, fields, dateISO = isoDate()) {
  const filled = Object.fromEntries(Object.entries(fields).filter(([, v]) => String(v ?? "").trim() !== "" && !isNaN(parseFloat(v))).map(([k, v]) => [k, parseFloat(v)]));
  if (!Object.keys(filled).length) return false;
  const history = normalizeMeasurementHistory(client.measurementsHistory);
  const next = [...history, newMeasurementEntry(filled, dateISO)].sort((a, b) => a.date.localeCompare(b.date));
  await saveMeasurementHistory(client.id, next);
  const snap = Object.fromEntries(Object.entries(filled).filter(([k]) => k !== "weight"));
  if (Object.keys(snap).length) await saveLatestMeasurementsSnapshot(client.id, { progress: client.progress, measurements: client.measurements }, snap);
  updateClient({ ...client, measurementsHistory: next, measurements: { ...(client.measurements || {}), ...snap } });
  return true;
}
