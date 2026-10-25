// Storage for the unified Nutrition redesign (DECISIONS.md "Nutrition
// redesign"). Client-owned day/plan state only - the trainer-owned foods
// library and meal-preset templates are reused as-is from
// lib/nutritionPlan.js (loadFoodLibrary/saveFoodLibrary,
// loadMealPresets/saveMealPresets), not duplicated here.
import { upsertSection } from "./clientData.js";

export function normalizePlans(raw) { return Array.isArray(raw) ? raw : []; }
export async function savePlans(clientId, plans) { return await upsertSection(clientId, "nutrition_v2_plans", plans); }

export function normalizeLogs(raw) { return raw && typeof raw === "object" ? raw : {}; }
export function logsForDate(logs, dateISO) { return logs?.[dateISO] || []; }
export async function saveLogs(clientId, logs) { return await upsertSection(clientId, "nutrition_v2_logs", logs); }

export function normalizeMarks(raw) { return raw && typeof raw === "object" ? raw : {}; }
export function marksForDate(marks, dateISO) { return marks?.[dateISO] || {}; }
export async function saveMarks(clientId, marks) { return await upsertSection(clientId, "nutrition_v2_marks", marks); }

export function emptyNotes() { return { draft: "", shared: "", sharedDate: "" }; }
export function normalizeNotes(raw) { return { ...emptyNotes(), ...(raw && typeof raw === "object" ? raw : {}) }; }
export async function saveNotes(clientId, notes) { return await upsertSection(clientId, "nutrition_v2_notes", notes); }

// Client-built reusable meals (DECISIONS.md "Nutrition redesign v2 - warm
// redesign + client meal builder"). A brand-new section - purely additive,
// never read from or written into nutrition_v2_logs, so building this
// feature can never touch a client's existing logged history.
export function normalizeMeals(raw) { return Array.isArray(raw) ? raw : []; }
export async function saveMeals(clientId, meals) { return await upsertSection(clientId, "nutrition_v2_meals", meals); }
