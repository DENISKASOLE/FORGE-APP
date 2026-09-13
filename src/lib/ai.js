import { supabase } from "../supabaseClient.js";
import { addDays, isoDate } from "./dateUtils.js";
import { dayLogFor, habitLogFor, macroDayFor, macroDayTotals, MACRO_SLOTS } from "./nutrition.js";
import { sessionStatsV2, sessionEntriesV2 } from "./trainingLogs.js";

async function callForgeAI(action, body) {
  const { data, error } = await supabase.functions.invoke("forge-ai", { body: { action, ...body } });
  if (error) throw new Error(error.message || "AI request failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ==================== Nutrition report drafting ====================

const MEAL_SLOT_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

// Walks the 7 days starting at nutrition.week_of, computing real numeric
// macro averages from macro_log (when the client used the food-search
// tracker) and a plain-text summary of the photo/description diary +
// habits, for the AI to read as context. Never asks the model to do the
// arithmetic itself.
function buildWeekSummary(nutrition) {
  const start = nutrition.week_of;
  if (!start) return { averages: null, hasNumericData: false, summaryText: "" };

  const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(new Date(`${start}T00:00:00`), i)));

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

// Drafts the qualitative parts of a nutrition report, merges in the
// deterministically-computed numeric averages. Returns a full ReportData
// object ready to review/edit in the existing "Set report" JSON textarea -
// this never saves anything itself, the coach still reviews and clicks
// Save.
export async function draftNutritionReport(client, nutrition) {
  const { averages, hasNumericData, summaryText } = buildWeekSummary(nutrition);
  const supplementStack = (nutrition.supplement_stack || []).map((s) => `${s.name} (${s.dose}${s.timing ? `, ${s.timing}` : ""})`).join("; ");

  const data = await callForgeAI("nutrition_report", {
    goal: client.goals?.join(", ") || client.goal || "",
    weightKg: client.weight || null,
    phase: nutrition.phase,
    weekSummary: summaryText,
    hasNumericData,
    supplementStack,
  });
  if (!data?.draft) throw new Error("AI report request returned nothing usable");

  // Only ever the real computed average from logged macro data - never a
  // stand-in value (e.g. falling back to the proposed targets would make
  // the report's progress bars falsely show the client already hitting
  // targets they haven't even started yet).
  return { ...data.draft, averages: averages || {} };
}

// ==================== 4-week client summary ====================

function buildTrainingSummary(client, days) {
  const sessions = client.trainingLogs?.sessions || [];
  const cutoff = isoDate(addDays(new Date(), -days));
  const recent = sessions.filter((s) => s.status === "completed" && s.date && s.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  if (!recent.length) return "No completed sessions in this period.";

  const lines = recent.map((s) => {
    const stats = sessionStatsV2(s);
    const rpes = (s.entries || []).flatMap((e) => (e.sets || []).map((set) => Number(set.rpe)).filter((n) => !isNaN(n) && n > 0));
    const avgRpe = rpes.length ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : null;
    return `${s.date}: ${s.workoutName || "workout"} - ${stats.setsDone}/${stats.setsTotal} sets, ${Math.round(stats.volume)}kg volume${avgRpe ? `, avg RPE ${avgRpe}` : ""}${s.sessionRpe ? `, session RPE ${s.sessionRpe}` : ""}`;
  });
  return `${recent.length} completed sessions:\n${lines.join("\n")}`;
}

function buildNutritionSummary(nutrition, days) {
  if (!nutrition) return "No nutrition data available.";
  const today = new Date();
  const numericDays = [];
  const foodLines = [];
  const habitVals = { steps: [], sleep: [], water: [] };

  for (let i = days - 1; i >= 0; i--) {
    const date = isoDate(addDays(today, -i));
    const foodLog = dayLogFor(nutrition, date);
    const habits = habitLogFor(nutrition, date);
    const macroTotals = macroDayTotals(macroDayFor(nutrition, date));
    if (macroTotals.kcal > 0) numericDays.push(macroTotals);
    if (habits.steps) habitVals.steps.push(Number(habits.steps));
    if (habits.sleep) habitVals.sleep.push(Number(habits.sleep));
    if (habits.water) habitVals.water.push(Number(habits.water));

    const loggedMeal = ["breakfast", "lunch", "dinner"].some((s) => foodLog[s]?.description) || foodLog.snacks?.length || macroTotals.kcal > 0;
    if (loggedMeal) foodLines.push(date);
  }

  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const parts = [`Logged food on ${foodLines.length}/${days} days.`];
  if (numericDays.length) {
    parts.push(`Avg on tracked days (${numericDays.length}): ${avg(numericDays.map((d) => d.kcal))}kcal, ${avg(numericDays.map((d) => d.protein))}p/${avg(numericDays.map((d) => d.carbs))}c/${avg(numericDays.map((d) => d.fats))}f.`);
  }
  if (habitVals.steps.length) parts.push(`Avg steps: ${avg(habitVals.steps)} (${habitVals.steps.length} days logged).`);
  if (habitVals.sleep.length) parts.push(`Avg sleep: ${avg(habitVals.sleep)}h (${habitVals.sleep.length} days logged).`);
  if (habitVals.water.length) parts.push(`Avg water: ${avg(habitVals.water)}L (${habitVals.water.length} days logged).`);
  return parts.join(" ");
}

function weightTrendFromCheckins(checkIns, days) {
  const cutoff = isoDate(addDays(new Date(), -days));
  const points = [];
  (checkIns || []).forEach((c) => {
    if (!c.date || c.date < cutoff) return;
    const ans = (c.answers || []).find((a) => /weight/i.test(a.question));
    const val = ans ? parseFloat(String(ans.answer).replace(/[^0-9.]/g, "")) : NaN;
    if (!isNaN(val) && val > 0) points.push({ date: c.date, value: val });
  });
  points.sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) return "";
  const delta = +(points[points.length - 1].value - points[0].value).toFixed(1);
  return ` Bodyweight ${delta > 0 ? "up" : delta < 0 ? "down" : "unchanged"} ${Math.abs(delta)}kg over the period (${points[0].value}kg -> ${points[points.length - 1].value}kg).`;
}

// Drafts a coach-facing summary of a client's recent training + nutrition
// + habits, for the coach to review before a check-in. Purely a read-only
// analysis - generates nothing that gets saved or shown to the client.
export async function generateClientSummary(client, days = 28) {
  const trainingSummary = buildTrainingSummary(client, days);
  const nutritionSummary = buildNutritionSummary(client.nutrition, days) + weightTrendFromCheckins(client.checkIns, days);

  const data = await callForgeAI("client_summary", {
    clientName: client.name?.split(" ")[0] || "",
    goal: client.goals?.join(", ") || client.goal || "",
    periodLabel: `Last ${days} days`,
    trainingSummary,
    nutritionSummary,
  });
  if (!data?.summary) throw new Error("AI summary request returned nothing usable");
  return data.summary;
}

// ==================== Daily nutrition feedback ====================

// Names of what's actually been eaten today, for the model to reference
// specifically and to base meal suggestions on similar foods.
function buildLoggedTodayText(day) {
  const parts = [];
  for (const slot of MACRO_SLOTS) {
    const items = day[slot] || [];
    if (items.length) parts.push(`${slot}: ${items.map((i) => i.name).filter(Boolean).join(", ")}`);
  }
  return parts.join(" | ");
}

// On-demand, client-facing feedback on today's eating so far vs targets.
// totals/targets are passed in already computed (MacroTracker.jsx already
// has this data on screen) rather than recomputed here.
export async function getDailyNutritionFeedback(client, day, totals, targets) {
  const data = await callForgeAI("daily_nutrition_feedback", {
    goal: client.goals?.join(", ") || client.goal || "",
    targets: targets ? { calories: targets.calories, protein: targets.protein, carbs: targets.carbs, fats: targets.fats } : null,
    totals: { kcal: Math.round(totals.kcal), protein: Math.round(totals.protein), carbs: Math.round(totals.carbs), fats: Math.round(totals.fats) },
    loggedToday: buildLoggedTodayText(day) || "nothing logged yet",
  });
  if (!data?.feedback) throw new Error("AI feedback request returned nothing usable");
  return data.feedback;
}

// ==================== Training trend insight ====================

// Groups logged sets by exercise, one line per session showing that
// session's top set (max value logged) and its RPE if given - compact
// enough to fit many exercises/sessions in one prompt while still showing
// a real week-over-week trajectory per exercise.
function buildExerciseTrendSummary(client, weeks) {
  const entries = sessionEntriesV2(client.trainingLogs);
  const cutoff = isoDate(addDays(new Date(), -weeks * 7));
  const byExercise = {};
  for (const e of entries) {
    if (!e.date || e.date < cutoff) continue;
    byExercise[e.exercise] = byExercise[e.exercise] || {};
    const bySession = byExercise[e.exercise];
    const rpe = Number(e.rpe) || 0;
    if (!bySession[e.date] || e.value > bySession[e.date].value) {
      bySession[e.date] = { value: e.value, rpe, timed: e.timed };
    }
  }

  const lines = [];
  for (const [exercise, bySession] of Object.entries(byExercise)) {
    const sessions = Object.entries(bySession).sort(([a], [b]) => a.localeCompare(b));
    if (sessions.length < 2) continue; // need at least 2 points to show a trend
    const recent = sessions.slice(-6);
    const points = recent.map(([date, s]) => `${date}: ${s.value}${s.timed ? "s" : "kg"}${s.rpe ? `@RPE${s.rpe}` : ""}`);
    lines.push(`${exercise} — ${points.join(", ")}`);
  }
  return lines.join("\n");
}

// On-demand, client-facing pattern-level insight across recent training
// (never a specific prescribed load - see the edge function's prompt for
// why). Purely informational.
export async function getTrainingInsight(client, weeks = 6) {
  const trainingSummary = buildExerciseTrendSummary(client, weeks);
  const data = await callForgeAI("training_insight", {
    goal: client.goals?.join(", ") || client.goal || "",
    trainingSummary,
  });
  if (!data?.insight) throw new Error("AI insight request returned nothing usable");
  return data.insight;
}
