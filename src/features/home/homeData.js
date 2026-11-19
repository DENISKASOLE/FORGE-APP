// Pure data helpers for the client "Today" Home screen (Nov 2026 redesign,
// approved mockup home-redesign). Every tile reads data the app already
// stores - nothing here invents a second copy:
//   calories/macros -> nutritionV2Logs + the signed plan's targets
//   steps/water/sleep -> nutrition.habits[date]
//   weight -> check-in weights + quick-log weigh-ins (weightHistoryFromCheckins)
//   waist / VO2 max / resting HR -> measurementsHistory
//   body fat -> latest body analysis report
//   mood -> moodLog (section mood_log)
import { scansFor, latestWithChange } from "../../lib/bodyComposition.js";
import { isoDate, startOfWeek, addDays } from "../../lib/dateUtils.js";
import { normalizeLogs, normalizePlans } from "../../lib/nutritionV2.js";
import { habitLogFor } from "../../lib/nutrition.js";
import { weightHistoryFromCheckins } from "../../lib/clientMetrics.js";
import { planForDate, mergeLegacyMacroLog, addDaysISO } from "../nutrition-v2/nutritionV2Math.js";

export const HABIT_GOALS = { steps: 10000, water: 3, sleep: 8 };
export const MOODS = ["😫", "🙁", "😐", "🙂", "😄"];

export function weekOf(dateISO) {
  const monday = startOfWeek(new Date(`${dateISO}T00:00:00`));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    return { iso: isoDate(d), name: d.toLocaleDateString(undefined, { weekday: "short" }), num: d.getDate() };
  });
}

function entriesFor(client, dateISO) {
  const logs = normalizeLogs(client.nutritionV2Logs);
  if (logs[dateISO]?.length) return logs[dateISO];
  const legacy = client.nutrition?.macro_log?.[dateISO];
  return legacy ? mergeLegacyMacroLog(legacy, dateISO) : [];
}
export function dayNutrition(client, dateISO) {
  const eaten = entriesFor(client, dateISO).reduce((t, e) => ({
    kcal: t.kcal + (e.macros?.kcal || 0), protein: t.protein + (e.macros?.protein || 0),
    carbs: t.carbs + (e.macros?.carbs || 0), fat: t.fat + (e.macros?.fat || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const plan = planForDate(normalizePlans(client.nutritionV2Plans), dateISO);
  const t = plan?.targets || null;
  const target = t && (t.kcal || t.protein) ? { kcal: t.kcal || 0, protein: t.protein || 0, carbs: t.carbs || 0, fat: t.fat || 0 } : null;
  return { eaten, target };
}

export function habitsFor(client, dateISO) {
  return habitLogFor(client.nutrition || {}, dateISO);
}
export function habitGoals(client) {
  return { ...HABIT_GOALS, ...(client.habitGoals || {}) };
}

export function weightInfo(client, dateISO) {
  const pts = weightHistoryFromCheckins(client.checkIns, client.measurementsHistory).filter((p) => p.date <= dateISO);
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const weekAgo = addDaysISO(last.date, -7);
  const prior = [...pts].reverse().find((p) => p.date <= weekAgo);
  return { value: last.value, date: last.date, change: prior ? Math.round((last.value - prior.value) * 10) / 10 : null };
}

// Latest value of one measurement key on or before dateISO, plus its
// change versus the latest reading at least `days` earlier.
export function measurementInfo(client, key, dateISO, days = 28) {
  const rows = (Array.isArray(client.measurementsHistory) ? client.measurementsHistory : [])
    .filter((e) => e?.date && e.date <= dateISO && !isNaN(parseFloat(e[key])))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) {
    const snap = parseFloat(client.measurements?.[key]);
    return isNaN(snap) ? null : { value: snap, date: null, change: null };
  }
  const last = rows[rows.length - 1];
  const cutoff = addDaysISO(last.date, -days);
  const prior = [...rows].reverse().find((e) => e.date <= cutoff);
  const v = parseFloat(last[key]);
  return { value: v, date: last.date, change: prior ? Math.round((v - parseFloat(prior[key])) * 10) / 10 : null };
}

export function bodyFatInfo(client) {
  const bf = latestWithChange(scansFor(client), "bodyFat");
  return bf ? { value: bf.value, date: bf.date } : null;
}

// Consecutive days, counting back from dateISO, where protein eaten met the
// plan's protein target. Today only counts once it's hit (so an
// in-progress day doesn't break the streak).
export function proteinStreak(client, dateISO) {
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const d = addDaysISO(dateISO, -i);
    const { eaten, target } = dayNutrition(client, d);
    if (!target?.protein) break;
    if (eaten.protein >= target.protein) { streak += 1; continue; }
    if (i === 0) continue;
    break;
  }
  return streak;
}

const ENERGY_WORDS = { struggling: 3, steady: 5, strong: 8, "crushing it": 10 };
// Energy out of 10: today's mood when logged, else the latest check-in's
// energy answer.
export function energyInfo(client, dateISO) {
  const mood = client.moodLog?.[dateISO];
  if (mood) return { value: mood * 2, source: "Today's mood" };
  const ci = [...(client.checkIns || [])].sort((a, b) => (a.date || "").localeCompare(b.date || "")).reverse();
  for (const c of ci) {
    const a = (c.answers || []).find((x) => /energy/i.test(x.question || ""));
    if (!a) continue;
    const s = String(a.answer || "").trim().toLowerCase();
    const n = ENERGY_WORDS[s] ?? parseFloat(s);
    if (!isNaN(n) && n > 0) return { value: Math.min(10, Math.round(n)), source: "From check-in" };
  }
  return null;
}

export function shortDate(dateISO, todayISO = isoDate()) {
  if (!dateISO) return "";
  if (dateISO === todayISO) return "Today";
  if (dateISO === addDaysISO(todayISO, -1)) return "Yesterday";
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
