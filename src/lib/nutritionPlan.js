// Trainer-owned storage shared by the nutrition feature: the coach's food
// library, saved meal templates, and leftover plan templates from the
// retired prescribed-plan feature (kept readable, never written to again,
// for FoodsLibraryScreen.jsx's hard-delete safety check). The client-owned
// "signed plan" storage this file used to hold (signClientPlan,
// nutrition_plan / nutrition_plan_logs) was retired along with that
// feature - see DECISIONS.md "Nutrition redesign" - and replaced by
// lib/nutritionV2.js's per-client plans/logs/marks/notes sections.
import { upsertTrainerData } from "./clientData.js";
import { supabase } from "../supabaseClient.js";

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

// Read-only going forward (nothing writes plan_templates anymore) - kept
// only so FoodsLibraryScreen.jsx's usedFoodIds check still protects any
// food referenced by a template built before the cutover.
export async function loadPlanTemplates(trainerId) {
  const data = await loadTrainerSection(trainerId, "plan_templates", { items: [] });
  return data.items || [];
}
