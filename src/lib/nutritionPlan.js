// Storage for the "prescribed plan" nutrition mode - a coach builds a
// plan of exact foods/amounts/times and the client ticks it off, per
// NUTRITION_SPEC.md. This is a THIRD tracking_mode alongside the existing
// "food_log" and "macros" modes (lib/nutrition.js) - additive, not a
// replacement. See docs/nutrition-recon.md for why this is JSONB sections
// on the app's existing client_data/trainer_data tables rather than the
// spec's literal relational schema.
import { upsertSection, upsertTrainerData } from "./clientData.js";
import { supabase } from "../supabaseClient.js";
import { validatePlanDoc } from "../features/nutrition-plan/planModel.js";

// ==================== coach-owned: trainer_data sections ====================
// "foods" (the coach's food library), "meal_presets", "plan_templates",
// "nutrition_studio_settings" - one section each, same shape as the
// existing "templates" section already used for training program
// templates (see loadTrainerTemplates in lib/clientData.js).

async function loadTrainerSection(trainerId, section, fallback) {
  if (!trainerId) return fallback;
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", section).maybeSingle();
  return data?.data ?? fallback;
}

export async function loadFoodLibrary(trainerId) {
  const data = await loadTrainerSection(trainerId, "foods", { items: [] });
  return data.items || [];
}
export async function saveFoodLibrary(trainerId, foods) {
  await upsertTrainerData(trainerId, "foods", { items: foods });
}

export async function loadMealPresets(trainerId) {
  const data = await loadTrainerSection(trainerId, "meal_presets", { items: [] });
  return data.items || [];
}
export async function saveMealPresets(trainerId, presets) {
  await upsertTrainerData(trainerId, "meal_presets", { items: presets });
}

export async function loadPlanTemplates(trainerId) {
  const data = await loadTrainerSection(trainerId, "plan_templates", { items: [] });
  return data.items || [];
}
// Returns {queued, error} from upsertTrainerData - the builder's autosave
// status pill (DRAFT/SAVING/SAVED/OFFLINE) needs to know whether this
// actually reached Supabase or just got queued for retry.
export async function savePlanTemplates(trainerId, templates) {
  return await upsertTrainerData(trainerId, "plan_templates", { items: templates });
}

export function emptyStudioSettings() { return { guidelines: [] }; }
export async function loadStudioSettings(trainerId) {
  return await loadTrainerSection(trainerId, "nutrition_studio_settings", emptyStudioSettings());
}
export async function saveStudioSettings(trainerId, settings) {
  await upsertTrainerData(trainerId, "nutrition_studio_settings", settings);
}

// ==================== client-owned: client_data sections ====================

// "nutrition_plan": the signed plan history for one client.
// { active: SignedPlan | null, history: SignedPlan[] }
// SignedPlan = { version, templateId, doc: PlanDoc (frozen snapshot,
//   guidelines already baked in), schedule: {mon..sun: dayId}, startDate,
//   status: 'active'|'archived', coachNote, signedAt }
export function emptyClientPlanState() { return { active: null, history: [] }; }
export function normalizeClientPlanState(raw) {
  if (!raw || typeof raw !== "object") return emptyClientPlanState();
  return { active: raw.active || null, history: Array.isArray(raw.history) ? raw.history : [] };
}

// The JS equivalent of the spec's sign_client_plan Postgres RPC (§2): a
// single upsertSection call is one JSONB row write, which Postgres already
// does atomically - no separate archive-then-insert transaction needed
// the way two relational statements would require. Version numbers
// continue from the highest ever issued (active or archived), never reused.
export async function signClientPlan(client, { templateId = null, doc, schedule, startDate, coachNote = "" }) {
  const errors = validatePlanDoc(doc);
  if (errors.length) throw new Error(errors[0]);

  const current = normalizeClientPlanState(client.nutritionPlan);
  const priorVersions = [...current.history.map((h) => h.version), ...(current.active ? [current.active.version] : [])];
  const nextVersion = priorVersions.length ? Math.max(...priorVersions) + 1 : 1;
  const nextHistory = current.active ? [...current.history, { ...current.active, status: "archived" }] : current.history;

  const nextActive = {
    version: nextVersion, templateId, doc, schedule, startDate,
    status: "active", coachNote, signedAt: new Date().toISOString(),
  };
  const nextState = { active: nextActive, history: nextHistory };
  await upsertSection(client.id, "nutrition_plan", nextState);
  return nextState;
}

// "nutrition_plan_logs": day-by-day ticks, keyed by local date - same
// shape convention as nutrition.habits/macro_log (lib/nutrition.js).
// { [date]: DayLog }
// DayLog = { planVersion, dayId, dayTypeSwitched, plannedItemCount,
//   entries: { [itemId]: LogEntry }, extras: ExtraEntry[] }
// LogEntry = { status: 'eaten'|'swapped'|'skipped', portion, swapOptionId,
//   name, amount, unit, kcal, protein, carbs, fat, loggedAt }
// ExtraEntry = { id, rawText, estimate, isEstimate, pendingEstimate, loggedAt }
export function emptyPlanDayLog() { return { planVersion: null, dayId: null, dayTypeSwitched: false, plannedItemCount: 0, entries: {}, extras: [] }; }
export function planDayLogFor(logs, date) {
  const raw = logs?.[date];
  if (!raw || typeof raw !== "object") return emptyPlanDayLog();
  return { ...emptyPlanDayLog(), ...raw, entries: raw.entries || {}, extras: raw.extras || [] };
}
export async function savePlanLogs(clientId, logs) {
  await upsertSection(clientId, "nutrition_plan_logs", logs);
}
