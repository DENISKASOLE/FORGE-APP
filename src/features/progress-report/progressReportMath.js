// Pure functions only - no React, no Supabase - same rule as
// nutritionV2Math.js, so every number in the Progress Report can be unit
// tested directly and is guaranteed identical between the live preview
// and the exported PDF (both call buildReportModel()).
//
// This is the real-Forge-data port of the "Forge Progress Report"
// prototype's window()/calc()/renderVals() logic (DECISIONS.md). Where
// the prototype assumed data Forge doesn't have (a resting-HR wearable,
// a fixed energy/soreness/stress 1-5 scale) the corresponding section
// just comes back unavailable/empty, same graceful-omission the
// prototype itself already designed in - not re-derived here.
import { addDaysISO } from "../nutrition-v2/nutritionV2Math.js";
import { planForDate, mealStatus, loggedDayTotals, mergeLegacyMacroLog } from "../nutrition-v2/nutritionV2Math.js";
import { buildProgramDays } from "../../lib/programModel.js";
import { sessionStatsV2, estimateOneRepMax, pbsInDateRange } from "../../lib/trainingLogs.js";
import { habitLogFor } from "../../lib/nutrition.js";
import { weightHistoryFromCheckins } from "../../lib/clientMetrics.js";
import { EXERCISE_TAXONOMY } from "../train/exerciseTaxonomy.js";
import { categoryForExercise, TRAINING_CATEGORIES, REPORT_SECTIONS, REPORT_SECTION_LABELS } from "./progressReportModel.js";

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function diffDaysISO(aISO, bISO) { return Math.round((new Date(`${bISO}T00:00:00`) - new Date(`${aISO}T00:00:00`)) / 86400000); }
export function datesInRange(fromISO, toISO) {
  const out = [];
  for (let d = fromISO; d <= toISO; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

// ---------- §period / comparison windows ----------
export function dateWindowFor(period, customA, customB, todayISO) {
  const fallback = { a: addDaysISO(todayISO, -27), b: todayISO };
  if (period === "custom") {
    if (!customA || !customB) return { ...fallback, err: "Choose both dates." };
    if (customA > customB) return { ...fallback, err: "Start date must be before the end date." };
    if (customB > todayISO) return { ...fallback, err: "End date can't be in the future." };
    const len = diffDaysISO(customA, customB) + 1;
    if (len < 7) return { ...fallback, err: "Choose at least 7 days so trends are meaningful." };
    if (len > 182) return { ...fallback, err: "Choose 26 weeks or fewer." };
    return { a: customA, b: customB, err: null };
  }
  const n = { "7d": 7, "4w": 28, "12w": 84 }[period] || 28;
  return { a: addDaysISO(todayISO, -(n - 1)), b: todayISO, err: null };
}
export function comparisonWindowFor(cmp, window, trackingStartISO) {
  if (cmp === "none") return { window: null, reason: "Comparison switched off." };
  const len = diffDaysISO(window.a, window.b) + 1;
  let cw = null;
  if (cmp === "prev") cw = { a: addDaysISO(window.a, -len), b: addDaysISO(window.a, -1) };
  if (cmp === "base" && trackingStartISO) cw = { a: trackingStartISO, b: addDaysISO(trackingStartISO, len - 1) };
  if (!cw) return { window: null, reason: "Not available." };
  if (trackingStartISO && cw.a < trackingStartISO) {
    return { window: null, reason: `Not available — tracking for this client began ${trackingStartISO}, so a full ${len}-day comparison window doesn't exist.` };
  }
  if (cw.b >= window.a) {
    return { window: null, reason: `Not available — the baseline window (${cw.a} – ${cw.b}) overlaps this period.` };
  }
  return { window: cw, reason: "" };
}

// ---------- §rolling mean (generic port of the prototype's rollMap) ----------
export function rollingMean(series, days, windowDays = 7, minPoints = 4) {
  const byDate = {};
  (series || []).forEach((p) => { byDate[p.date] = p.value; });
  return days.map((d) => {
    const vals = [];
    for (let k = 0; k < windowDays; k++) {
      const v = byDate[addDaysISO(d, -k)];
      if (v != null) vals.push(v);
    }
    return vals.length >= minPoints ? { date: d, value: mean(vals) } : null;
  }).filter(Boolean);
}

// ---------- §body: weight + measurements ----------
export function weightSeriesInRange(checkIns, fromISO, toISO) {
  return weightHistoryFromCheckins(checkIns).filter((p) => p.date >= fromISO && p.date <= toISO);
}
// baseline = the very first entry ever logged; previous = the last entry
// strictly before this period began; inRange = entries within [from, to].
// history = everything up to `toISO`, for a sparkline that spans all time.
export function measurementContext(measurementsHistory, fromISO, toISO) {
  const all = [...(measurementsHistory || [])].filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date));
  const history = all.filter((e) => e.date <= toISO);
  const inRange = all.filter((e) => e.date >= fromISO && e.date <= toISO);
  const prev = [...history].filter((e) => e.date < fromISO).slice(-1)[0] || null;
  const base = history[0] || null;
  const latest = inRange[inRange.length - 1] || null;
  return { history, inRange, prev, base, latest };
}

// ---------- §training: planned/completed sessions, volume, progression, categories ----------
export function sessionWindowFor(program, logs, fromISO, toISO) {
  const days = buildProgramDays(program, logs).filter((d) => d.dateISO >= fromISO && d.dateISO <= toISO);
  const planned = days.filter((d) => !d.isRest);
  const completed = planned.filter((d) => d.state === "completed");
  const missed = planned.filter((d) => d.state === "missed");
  return {
    planned: planned.length, completedCount: completed.length, missed: missed.length,
    sessions: completed.map((d) => ({ date: d.dateISO, session: d.session, workout: d.workout })),
  };
}
export function weeklyVolumeFor(sessions, fromISO, toISO) {
  const weeks = [];
  for (let start = fromISO; start <= toISO; start = addDaysISO(start, 7)) {
    const end = addDaysISO(start, Math.min(6, diffDaysISO(start, toISO)));
    const inWeek = sessions.filter((s) => s.date >= start && s.date <= end);
    weeks.push({ start, end, volume: inWeek.reduce((sum, s) => sum + sessionStatsV2(s.session).volume, 0), count: inWeek.length });
  }
  return weeks;
}
// First vs. last top set logged for each exercise name, within [from, to],
// with an estimated 1RM at each end (null when the formula isn't trusted,
// e.g. >10 reps - see estimateOneRepMax).
export function strengthProgressionFor(logs, exerciseNames, fromISO, toISO) {
  const completed = (logs?.sessions || []).filter((s) => s.status === "completed" && s.date >= fromISO && s.date <= toISO).sort((a, b) => a.date.localeCompare(b.date));
  return exerciseNames.map((name) => {
    const lower = name.toLowerCase();
    const hits = [];
    completed.forEach((s) => {
      (s.entries || []).forEach((e) => {
        if (String(e.substitutedName || e.name || "").toLowerCase() !== lower) return;
        let best = null;
        (e.sets || []).forEach((set) => {
          const load = parseFloat(set.load) || 0, reps = parseFloat(set.reps) || 0;
          if (!load || !reps) return;
          if (!best || load * reps > best.load * best.reps) best = { load, reps };
        });
        if (best) hits.push({ date: s.date, ...best });
      });
    });
    if (hits.length < 2) return { name, hasData: false };
    const first = hits[0], last = hits[hits.length - 1];
    return {
      name, hasData: true, first, last, change: +(last.load - first.load).toFixed(1),
      e1rmFirst: estimateOneRepMax(first.load, first.reps), e1rmLast: estimateOneRepMax(last.load, last.reps),
    };
  });
}
export function categoryVolumeFor(sessions, taxonomy = EXERCISE_TAXONOMY) {
  const totals = {};
  sessions.forEach(({ session }) => {
    (session?.entries || []).forEach((e) => {
      const name = e.substitutedName || e.name;
      const cat = categoryForExercise(name, taxonomy);
      (e.sets || []).forEach((s) => {
        const load = parseFloat(s.load) || 0, reps = parseFloat(s.reps) || 0;
        if (load && reps) totals[cat] = (totals[cat] || 0) + load * reps;
      });
    });
  });
  return totals;
}
export { pbsInDateRange };

// ---------- §nutrition: logging/adherence/target attainment ----------
export function entriesForDate(client, dateISO) {
  const v2 = client.nutritionV2Logs?.[dateISO];
  if (v2 && v2.length) return v2;
  const legacy = client.nutrition?.macro_log?.[dateISO];
  return legacy ? mergeLegacyMacroLog(legacy, dateISO) : [];
}
export function nutritionSummaryFor(client, fromISO, toISO, todayISO) {
  const plans = client.nutritionV2Plans || [];
  const days = datesInRange(fromISO, toISO);
  const counts = { eaten: 0, partial: 0, substituted: 0, skipped: 0 };
  let loggedCount = 0, kcalWithinTarget = 0, proteinWithinTarget = 0;
  const perDay = days.map((d) => {
    const plan = planForDate(plans, d);
    const entries = entriesForDate(client, d);
    const marks = client.nutritionV2Marks?.[d] || {};
    const totals = loggedDayTotals(entries);
    const has = entries.length > 0;
    if (plan) {
      plan.meals.forEach((m) => {
        const st = mealStatus(d, todayISO, m, entries, marks);
        if (st === "open" || st === "future") return;
        counts[st] = (counts[st] || 0) + 1;
      });
    }
    if (has) {
      loggedCount += 1;
      if (plan?.targets?.kcal && Math.abs(totals.kcal - plan.targets.kcal) / plan.targets.kcal <= 0.1) kcalWithinTarget += 1;
      if (plan?.targets?.protein && totals.protein >= 0.9 * plan.targets.protein) proteinWithinTarget += 1;
    }
    return { date: d, has, totals, target: plan?.targets || null };
  });
  const outcome = counts.eaten + counts.partial + counts.substituted + counts.skipped;
  return { days: perDay, loggedCount, totalDays: days.length, counts, outcome, adherence: outcome ? counts.eaten / outcome : null, kcalWithinTarget, proteinWithinTarget };
}

// ---------- §heart: workout HR/kcal only - resting HR has no data source in Forge ----------
export function workoutHeartRateFor(sessions) {
  const withHr = sessions.filter((s) => s.session?.metrics?.maxHR || s.session?.metrics?.avgHR);
  const withKcal = sessions.filter((s) => s.session?.metrics?.kcal);
  return {
    hasHr: withHr.length > 0, hasKcal: withKcal.length > 0, totalSessions: sessions.length,
    hr: withHr.map((s) => ({ date: s.date, avg: Number(s.session.metrics.avgHR) || null, max: Number(s.session.metrics.maxHR) || null })),
    kcal: withKcal.map((s) => ({ date: s.date, value: Number(s.session.metrics.kcal) || 0 })),
  };
}

// ---------- §recovery: sleep, steps, check-ins ----------
export function sleepStepsFor(nutrition, fromISO, toISO) {
  const days = datesInRange(fromISO, toISO);
  const sleep = [], steps = [];
  days.forEach((d) => {
    const h = habitLogFor(nutrition || {}, d);
    if (h.sleep) sleep.push({ date: d, value: Number(h.sleep) });
    if (h.steps) steps.push({ date: d, value: Number(h.steps) });
  });
  return { sleep, steps };
}
const CHECKIN_KEYWORDS = { energy: /energy/i, soreness: /sorenes/i, stress: /stress/i };
function numericAnswer(raw) {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}
// Matches by the check-in answer's own stored question label text, not a
// template id - Forge's check-in questions are coach-configurable with no
// fixed energy/soreness/stress scale, so a client without matching scale
// questions configured simply gets hasCheck:false (section omitted), same
// graceful-omission the prototype already designed for missing data.
export function checkinsFor(checkIns, fromISO, toISO) {
  const inRange = (checkIns || []).filter((c) => c.date >= fromISO && c.date <= toISO).sort((a, b) => a.date.localeCompare(b.date));
  const rows = inRange.map((c) => {
    // First NUMERIC-answered question matching the keyword - a client can
    // have both a choice-type "Energy this week" and a custom numeric
    // scale question; only the latter is usable here.
    const pick = (re) => {
      for (const a of c.answers || []) {
        if (!re.test(a.question)) continue;
        const n = numericAnswer(a.answer);
        if (n != null) return n;
      }
      return null;
    };
    return { date: c.date, energy: pick(CHECKIN_KEYWORDS.energy), soreness: pick(CHECKIN_KEYWORDS.soreness), stress: pick(CHECKIN_KEYWORDS.stress) };
  }).filter((r) => r.energy != null || r.soreness != null || r.stress != null);
  return { hasCheck: rows.length > 0, checks: rows };
}

// ---------- §availability + coverage/sections checklists ----------
export function pageAvailabilityFor({ hasWeight, hasMeasurements, hasPlannedSessions, hasNutritionLogs, hasHeart, hasRecovery }) {
  return { summary: true, body: hasWeight || hasMeasurements, training: hasPlannedSessions, nutrition: hasNutritionLogs, heart: hasHeart, recovery: hasRecovery, review: true };
}
export function sectionsChecklistFor(availability, offMap = {}) {
  return REPORT_SECTIONS.map((key) => {
    const fixed = key === "summary" || key === "review";
    const available = availability[key];
    return { key, label: REPORT_SECTION_LABELS[key], available, fixed, included: fixed || (available && !offMap[key]) };
  });
}
export { TRAINING_CATEGORIES };

// ---------- §composer: the one object both the live preview and the PDF read from ----------
export function buildReportModel(client, trainerName, { period = "4w", customA = "", customB = "", cmp = "prev", offMap = {}, todayISO } = {}) {
  const today = todayISO || new Date().toISOString().slice(0, 10);
  const window = dateWindowFor(period, customA, customB, today);
  const trackingStart = client.joinDate || null;
  const { window: cmpWindow, reason: cmpReason } = comparisonWindowFor(cmp, window, trackingStart);

  const weight = weightSeriesInRange(client.checkIns, window.a, window.b);
  const weightDays = datesInRange(window.a, window.b);
  const weightRoll = rollingMean(weightHistoryFromCheckins(client.checkIns), weightDays);
  const measurements = measurementContext(client.measurementsHistory, window.a, window.b);

  const sessionWindow = sessionWindowFor(client.program, client.trainingLogs, window.a, window.b);
  const weeklyVolume = weeklyVolumeFor(sessionWindow.sessions, window.a, window.b);
  const exerciseNames = [...new Set(sessionWindow.sessions.flatMap((s) => (s.session?.entries || []).map((e) => e.substitutedName || e.name)))];
  const progression = strengthProgressionFor(client.trainingLogs, exerciseNames, window.a, window.b);
  const categories = categoryVolumeFor(sessionWindow.sessions);
  const pbs = pbsInDateRange(client.trainingLogs, window.a, window.b);
  const totalVolume = sessionWindow.sessions.reduce((sum, s) => sum + sessionStatsV2(s.session).volume, 0);
  const completionRate = sessionWindow.planned ? sessionWindow.completedCount / sessionWindow.planned : 0;

  const nutrition = nutritionSummaryFor(client, window.a, window.b, today);
  const heart = workoutHeartRateFor(sessionWindow.sessions);
  const sleepSteps = sleepStepsFor(client.nutrition, window.a, window.b);
  const checkins = checkinsFor(client.checkIns, window.a, window.b);

  const availability = pageAvailabilityFor({
    hasWeight: weight.length > 0, hasMeasurements: measurements.inRange.length > 0,
    hasPlannedSessions: sessionWindow.planned > 0, hasNutritionLogs: nutrition.loggedCount > 0,
    hasHeart: heart.hasHr || heart.hasKcal, hasRecovery: sleepSteps.sleep.length > 0 || sleepSteps.steps.length > 0 || checkins.hasCheck,
  });
  const sections = sectionsChecklistFor(availability, offMap);

  const model = {
    client: { id: client.id, name: client.name }, trainerName, generatedAt: today,
    period: { key: period, from: window.a, to: window.b, days: diffDaysISO(window.a, window.b) + 1, err: window.err },
    comparison: { key: cmp, window: cmpWindow, reason: cmpReason },
    availability, sections, includedSections: sections.filter((s) => s.included).map((s) => s.key),
    body: { weight, weightRoll, measurements },
    training: { ...sessionWindow, weeklyVolume, progression, categories, pbs, totalVolume, completionRate },
    nutrition, heart, recovery: { ...sleepSteps, checkins },
  };
  return { ...model, wins: suggestWins(model), challenge: suggestChallenge(model) };
}
export function suggestWins(model) {
  const sugg = [];
  const { training, nutrition, body } = model;
  if (training.planned && training.completionRate >= 0.85) {
    sugg.push({ text: `Completed ${training.completedCount} of ${training.planned} planned sessions (${Math.round(training.completionRate * 100)}%).`, source: "Session consistency" });
  }
  const bestProg = training.progression.filter((p) => p.hasData && p.change > 0).sort((a, b) => b.change - a.change)[0];
  if (bestProg) sugg.push({ text: `${bestProg.name}: ${bestProg.first.load}kg × ${bestProg.first.reps} → ${bestProg.last.load}kg × ${bestProg.last.reps} at the same rep target.`, source: "Strength progression" });
  const latestM = body.measurements.latest, prevM = body.measurements.prev;
  if (latestM && prevM && latestM.waist != null && prevM.waist != null && latestM.waist < prevM.waist) {
    sugg.push({ text: `Waist ${(latestM.waist - prevM.waist).toFixed(1)}cm since ${prevM.date}.`, source: "Measurements" });
  }
  if (sugg.length < 3 && nutrition.totalDays && nutrition.loggedCount / nutrition.totalDays >= 0.8) {
    sugg.push({ text: `Food logged on ${nutrition.loggedCount} of ${nutrition.totalDays} days.`, source: "Logging consistency" });
  }
  return sugg.slice(0, 3);
}
export function suggestChallenge(model) {
  const { nutrition } = model;
  if (nutrition.totalDays && nutrition.loggedCount < nutrition.totalDays * 0.5) {
    return `Food was logged on ${nutrition.loggedCount} of ${nutrition.totalDays} days, which is too few for reliable nutrition averages.`;
  }
  return "No single limiting factor stood out in this period.";
}
