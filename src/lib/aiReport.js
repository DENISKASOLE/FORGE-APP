import { supabase } from "../supabaseClient.js";
import { addDays } from "./dateUtils.js";
import { dayLogFor, habitLogFor, macroDayFor, macroDayTotals } from "./nutrition.js";

const MEAL_SLOT_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

// Walks the 7 days starting at nutrition.week_of, computing real numeric
// macro averages from macro_log (when the client used the food-search
// tracker) and a plain-text summary of the photo/description diary +
// habits, for the AI to read as context. Never asks the model to do the
// arithmetic itself.
function buildWeekSummary(nutrition) {
  const start = nutrition.week_of;
  if (!start) return { averages: null, hasNumericData: false, summaryText: "" };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(`${start}T00:00:00`), i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const numericDays = [];
  const lines = [];
  for (const date of days) {
    const foodLog = dayLogFor(nutrition, date);
    const habits = habitLogFor(nutrition, date);
    const macroDay = macroDayFor(nutrition, date);
    const macroTotals = macroDayTotals(macroDay);
    const loggedAnyMacro = macroTotals.kcal > 0;
    if (loggedAnyMacro) numericDays.push(macroTotals);

    const mealParts = [];
    for (const slot of ["breakfast", "lunch", "dinner"]) {
      const entry = foodLog[slot];
      if (entry?.description) mealParts.push(`${MEAL_SLOT_LABELS[slot]}: ${entry.description}`);
    }
    if (foodLog.snacks?.length) mealParts.push(`Snacks: ${foodLog.snacks.map((s) => s.description).filter(Boolean).join("; ") || `${foodLog.snacks.length} logged`}`);
    const habitParts = [];
    if (habits.steps) habitParts.push(`${habits.steps} steps`);
    if (habits.sleep) habitParts.push(`${habits.sleep}h sleep`);
    if (habits.water) habitParts.push(`${habits.water}L water`);

    if (mealParts.length || habitParts.length || loggedAnyMacro) {
      lines.push(`${date}: ${mealParts.join(" | ") || "no meals described"}${loggedAnyMacro ? ` [tracked: ${macroTotals.kcal}kcal, ${macroTotals.protein}p/${macroTotals.carbs}c/${macroTotals.fats}f]` : ""}${habitParts.length ? ` (${habitParts.join(", ")})` : ""}`);
    }
  }

  const hasNumericData = numericDays.length > 0;
  const averages = hasNumericData ? {
    calories: Math.round(numericDays.reduce((s, d) => s + d.kcal, 0) / numericDays.length),
    protein: Math.round(numericDays.reduce((s, d) => s + d.protein, 0) / numericDays.length),
    carbs: Math.round(numericDays.reduce((s, d) => s + d.carbs, 0) / numericDays.length),
    fats: Math.round(numericDays.reduce((s, d) => s + d.fats, 0) / numericDays.length),
  } : null;

  return { averages, hasNumericData, summaryText: lines.join("\n") || "Nothing logged this week." };
}

// Calls the forge-ai-report edge function to draft the qualitative parts
// of a nutrition report, then merges in the deterministically-computed
// numeric averages. Returns a full ReportData object ready to review/edit
// in the existing "Set report" JSON textarea - this never saves anything
// itself, the coach still reviews and clicks Save.
export async function draftNutritionReport(client, nutrition) {
  const { averages, hasNumericData, summaryText } = buildWeekSummary(nutrition);
  const supplementStack = (nutrition.supplement_stack || []).map((s) => `${s.name} (${s.dose}${s.timing ? `, ${s.timing}` : ""})`).join("; ");

  const { data, error } = await supabase.functions.invoke("forge-ai-report", {
    body: {
      goal: client.goals?.join(", ") || client.goal || "",
      weightKg: client.weight || null,
      phase: nutrition.phase,
      weekSummary: summaryText,
      hasNumericData,
      supplementStack,
    },
  });
  if (error) throw new Error(error.message || "AI report request failed");
  if (data?.error) throw new Error(data.error);
  if (!data?.draft) throw new Error("AI report request returned nothing usable");

  // Only ever the real computed average from logged macro data - never a
  // stand-in value (e.g. falling back to the proposed targets would make
  // the report's progress bars falsely show the client already hitting
  // targets they haven't even started yet).
  return { ...data.draft, averages: averages || {} };
}
