import { supabase } from "../supabaseClient.js";
import { addDays, isoDate } from "./dateUtils.js";
import { habitLogFor } from "./nutrition.js";
import { normalizeLogs } from "./nutritionV2.js";
import { loggedDayTotals, mergeLegacyMacroLog } from "../features/nutrition-v2/nutritionV2Math.js";
import { sessionStatsV2, sessionEntriesV2 } from "./trainingLogs.js";
import { hydrateAIProgram, summarizeProgramForAI } from "./programModel.js";

// Supabase's client wraps every non-2xx edge function response in a generic
// "Edge Function returned a non-2xx status code" message and discards the
// real response body unless you go dig it out of error.context - so without
// this, every AI failure (quota exceeded, missing API key, a bad Gemini
// response, anything) surfaced that one useless string to whatever UI
// caught it. Extract the real reason, and give the single most common real
// failure (the shared free-tier Gemini key's request quota) a message an
// end user can actually act on instead of a raw Google API error + URL.
async function callForgeAI(action, body) {
  const { data, error } = await supabase.functions.invoke("forge-ai", { body: { action, ...body } });
  if (error) {
    let message = error.message || "AI request failed";
    if (typeof error.context?.json === "function") {
      try {
        const errBody = await error.context.json();
        if (errBody?.error) message = errBody.error;
      } catch {}
    }
    if (/quota|rate.?limit/i.test(message)) {
      throw new Error("The AI coach is getting a lot of requests right now — try again in a minute.");
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ==================== Body analysis report (uploaded PDF) ====================

// Max file we'll send. Gemini's inline-data ceiling is far higher, but a
// body analysis report is a couple of pages - anything much bigger is
// almost certainly the wrong file, and base64 inflates it by ~33% on the
// way to the edge function.
export const MAX_BODY_ANALYSIS_BYTES = 10 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

// Reads an uploaded body-composition report into structured data. Pure
// extraction - the model is instructed to transcribe only what's printed
// (see the prompt in forge-ai/index.ts), never to estimate a missing value.
export async function extractBodyAnalysis(file) {
  if (file.size > MAX_BODY_ANALYSIS_BYTES) throw new Error("That file is too big - please upload a report under 10MB.");
  const fileBase64 = await fileToBase64(file);
  const data = await callForgeAI("body_analysis_extract", { fileBase64, mimeType: file.type || "application/pdf" });
  if (!data?.summary) throw new Error("Couldn't read that report - is it a body analysis report?");
  return data;
}

export function bodyAnalysisMetric(report, key) {
  return (report?.metrics || []).find((m) => m.key === key) || null;
}

// The whole point of storing these: every other AI feature gets grounded in
// the client's real body composition instead of just their bodyweight.
// Latest report, plus the one before it when there is one, so the model can
// see the direction of travel (e.g. fat down / muscle held).
function buildBodyAnalysisSummary(client) {
  const reports = client?.bodyAnalysis || [];
  if (!reports.length) return "";
  const describe = (r) => {
    const when = r.extracted?.testDate || r.date || "undated";
    const rows = (r.extracted?.metrics || []).map((m) => `${m.label}: ${m.value}${m.unit || ""}`).join(", ");
    return `${when}${r.extracted?.reportType ? ` (${r.extracted.reportType})` : ""}: ${rows || "no metrics captured"}`;
  };
  const parts = [`Latest body analysis — ${describe(reports[0])}`];
  if (reports[1]) parts.push(`Previous body analysis — ${describe(reports[1])}`);
  if (reports[0].extracted?.coachNotes) parts.push(`Notes from that report: ${reports[0].extracted.coachNotes}`);
  return parts.join("\n");
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

// Nutrition redesign (DECISIONS.md): reads the new unified
// nutrition_v2_logs shape, with the same read-time legacy-merge
// mergeLegacyMacroLog already uses elsewhere (lib/weeklyReport.js,
// NutritionV2Flow.jsx) so a client's older food_log/macro_log days still
// count here too, rather than this summary silently going quiet for
// anyone active before the cutover.
function buildNutritionSummary(client, days) {
  const nutrition = client?.nutrition;
  if (!nutrition) return "No nutrition data available.";
  const v2Logs = normalizeLogs(client.nutritionV2Logs);
  const today = new Date();
  const numericDays = [];
  const foodLines = [];
  const habitVals = { steps: [], sleep: [], water: [] };

  for (let i = days - 1; i >= 0; i--) {
    const date = isoDate(addDays(today, -i));
    const entries = v2Logs[date]?.length ? v2Logs[date] : (nutrition.macro_log?.[date] ? mergeLegacyMacroLog(nutrition.macro_log[date], date) : []);
    const macroTotals = loggedDayTotals(entries);
    const habits = habitLogFor(nutrition, date);
    if (macroTotals.kcal > 0) numericDays.push(macroTotals);
    if (habits.steps) habitVals.steps.push(Number(habits.steps));
    if (habits.sleep) habitVals.sleep.push(Number(habits.sleep));
    if (habits.water) habitVals.water.push(Number(habits.water));
    if (entries.length > 0) foodLines.push(date);
  }

  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const parts = [`Logged food on ${foodLines.length}/${days} days.`];
  if (numericDays.length) {
    parts.push(`Avg on tracked days (${numericDays.length}): ${avg(numericDays.map((d) => d.kcal))}kcal, ${avg(numericDays.map((d) => d.protein))}p/${avg(numericDays.map((d) => d.carbs))}c/${avg(numericDays.map((d) => d.fat))}f.`);
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
  const nutritionSummary = buildNutritionSummary(client, days) + weightTrendFromCheckins(client.checkIns, days);

  const data = await callForgeAI("client_summary", {
    clientName: client.name?.split(" ")[0] || "",
    goal: client.goals?.join(", ") || client.goal || "",
    periodLabel: `Last ${days} days`,
    trainingSummary,
    nutritionSummary,
    bodyAnalysis: buildBodyAnalysisSummary(client),
  });
  if (!data?.summary) throw new Error("AI summary request returned nothing usable");
  return data.summary;
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

// ==================== Coach assistant: AI program builder ====================
// Both functions below only ever return plain data for the coach to review -
// neither writes to client_data. generateProgramFromAI's result is meant to
// be opened in ProgramBuilder (pre-filling its state) and suggestProgramSwaps'
// accepted swaps are applied to a local copy via applyProgramSwaps and ALSO
// opened in ProgramBuilder - the coach's own "Save Program" click is the only
// thing that ever persists it, exactly like a hand-built program.

// Drafts a brand new program from a natural-language instruction, e.g.
// "Create a 3-day full body program for this client, avoid overhead pressing".
export async function generateProgramFromAI(client, instruction) {
  const data = await callForgeAI("coach_program_create", {
    clientName: client.name?.split(" ")[0] || "",
    goal: client.goals?.join(", ") || client.goal || "",
    injuries: client.profile?.injuries || client.injuries || "",
    instruction,
  });
  if (!data?.program) throw new Error("AI program request returned nothing usable");
  return { summary: data.summary || "", program: hydrateAIProgram(data.program) };
}

// Suggests exercise swaps against the client's CURRENT program, e.g.
// "Modify this workout because of knee pain" - never a full rewrite, just a
// reviewable list of {workoutName, exerciseName, suggestedReplacement, reason}.
export async function suggestProgramSwaps(client, program, instruction) {
  const data = await callForgeAI("coach_program_edit_suggest", {
    goal: client.goals?.join(", ") || client.goal || "",
    injuries: client.profile?.injuries || client.injuries || "",
    instruction,
    programSummary: summarizeProgramForAI(program),
  });
  if (!data) throw new Error("AI swap request returned nothing usable");
  return { note: data.note || "", swaps: data.swaps || [] };
}

// Applies only the accepted swaps to a local copy of the program by exact
// exercise-name match, leaving every other field (sets/reps/tempo/rest/notes,
// even on other exercises with the same name in a different workout) untouched.
export function applyProgramSwaps(program, acceptedSwaps) {
  const byWorkout = {};
  (acceptedSwaps || []).forEach((s) => {
    if (!byWorkout[s.workoutName]) byWorkout[s.workoutName] = [];
    byWorkout[s.workoutName].push(s);
  });
  if (!Object.keys(byWorkout).length) return program;
  return {
    ...program,
    weeks: program.weeks.map((w) => ({
      ...w,
      workouts: w.workouts.map((wo) => {
        const swaps = byWorkout[wo.name];
        if (!swaps?.length) return wo;
        return {
          ...wo,
          blocks: wo.blocks.map((b) => ({
            ...b,
            exercises: b.exercises.map((ex) => {
              const swap = swaps.find((s) => s.exerciseName === ex.name);
              return swap ? { ...ex, name: swap.suggestedReplacement } : ex;
            }),
          })),
        };
      }),
    })),
  };
}

// ==================== Client AI chat ====================
// Open-ended, multi-turn, grounded in the client's own real data. Reuses
// the same summary builders as the coach summary/training-insight features
// above rather than duplicating them.

// On-demand, sent fresh with every message rather than cached, since it's
// cheap to compute and the client's data may have changed since the chat
// was opened (a session logged, a meal tracked).
function buildChatGroundingContext(client) {
  return {
    trainingSummary: buildTrainingSummary(client, 28),
    nutritionSummary: client.nutrition ? buildNutritionSummary(client, 7) : "No nutrition data logged.",
    programOverview: summarizeProgramForAI(client.program),
    bodyAnalysis: buildBodyAnalysisSummary(client),
  };
}

// history: [{role: "user"|"model", text}], oldest first, NOT including the
// new message. Only the last 20 turns are sent to keep the request small -
// the full history still lives in client.aiChat for display/persistence.
export async function sendClientChatMessage(client, history, message) {
  const ctx = buildChatGroundingContext(client);
  const data = await callForgeAI("client_chat", {
    clientName: client.name?.split(" ")[0] || "",
    goal: client.goals?.join(", ") || client.goal || "",
    ...ctx,
    history: (history || []).slice(-20).map((m) => ({ role: m.role, text: m.text })),
    message,
  });
  if (!data?.reply) throw new Error("AI chat request returned nothing usable");
  return data.reply;
}

// ==================== Progression suggestion (plateau) ====================
// The one place AI is allowed to state a specific number (see the header
// comment in forge-ai/index.ts) - it's replacing what used to be a flat
// "+2.5kg" rule in suggestPlateauBump with an exercise-aware one, not
// contradicting a separate system. Called via useProgressionSuggestion.js
// as a progressive enhancement - the deterministic +2.5kg badge always
// shows first and stays if this fails or is slow.
export async function getProgressionSuggestion({ exerciseName, muscleGroup, movementPattern, workingWeight, timed, recentSets }) {
  const data = await callForgeAI("progression_suggestion", {
    exerciseName,
    muscleGroup: muscleGroup || "",
    movementPattern: movementPattern || "",
    workingWeight: workingWeight ?? null,
    timed: !!timed,
    recentSets: (recentSets || []).map((s) => ({ load: s.load, reps: s.reps, duration: s.duration, rpe: s.rpe })),
  });
  if (!data?.suggestion) throw new Error("AI progression request returned nothing usable");
  return { suggestion: data.suggestion, reasoning: data.reasoning || "" };
}
