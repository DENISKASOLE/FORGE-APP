// Single source of truth for the coach-facing weekly report: both the
// on-screen WeeklyReportModal and the exported PDF read from this exact
// function, so the numbers a coach sees on screen and the numbers they
// hand a client on paper can never quietly drift apart.
import { isoDate, addDays } from "./dateUtils.js";
import { sessionStatsV2, detectSessionPBs } from "./trainingLogs.js";
import { dayLogFor, habitLogFor, macroDayFor, macroDayTotals, MEAL_SLOTS } from "./nutrition.js";

function weekBuckets(weeksBack) {
  const todayEnd = new Date(`${isoDate()}T00:00:00`);
  // Oldest first, so charts read left-to-right as a timeline.
  return Array.from({ length: weeksBack }, (_, i) => {
    const offset = weeksBack - 1 - i;
    const end = addDays(todayEnd, -offset * 7);
    const start = addDays(end, -6);
    return { start: isoDate(start), end: isoDate(end) };
  });
}
function inWeek(date, week) { return !!date && date >= week.start && date <= week.end; }
function short(dateISO) { return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

export function buildWeeklyReport(client, weeksBack = 4) {
  const buckets = weekBuckets(weeksBack);
  const logs = client.trainingLogs;
  const nutrition = client.nutrition || {};
  const macrosOnly = nutrition.tracking_mode === "macros";
  const windowStart = buckets[0].start;

  const completedSessions = (logs?.sessions || []).filter((s) => s.status === "completed" && s.date);

  const weeks = buckets.map((bucket) => {
    const sessions = completedSessions.filter((s) => inWeek(s.date, bucket));
    const volume = sessions.reduce((sum, s) => sum + sessionStatsV2(s).volume, 0);
    const rpes = sessions.flatMap((s) => (s.entries || []).flatMap((e) => (e.sets || []).map((set) => Number(set.rpe)))).filter((n) => !isNaN(n) && n > 0);

    const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(new Date(`${bucket.start}T00:00:00`), i)));
    let nutritionDaysLogged = 0;
    const calDays = [], proteinDays = [], carbDays = [], fatDays = [];
    const stepDays = [], sleepDays = [];
    days.forEach((date) => {
      const macroTotals = macroDayTotals(macroDayFor(nutrition, date));
      const foodLog = dayLogFor(nutrition, date);
      const loggedFood = MEAL_SLOTS.some((s) => foodLog[s]?.description) || foodLog.snacks?.length;
      if (macroTotals.kcal > 0) { calDays.push(macroTotals.kcal); proteinDays.push(macroTotals.protein); carbDays.push(macroTotals.carbs); fatDays.push(macroTotals.fats); }
      if (macroTotals.kcal > 0 || loggedFood) nutritionDaysLogged += 1;
      const habits = habitLogFor(nutrition, date);
      if (habits.steps) stepDays.push(Number(habits.steps));
      if (habits.sleep) sleepDays.push(Number(habits.sleep));
    });

    return {
      label: short(bucket.end), start: bucket.start, end: bucket.end,
      sessionsCompleted: sessions.length, volume: Math.round(volume), avgRpe: avg(rpes),
      nutritionDaysLogged, hasNumericNutrition: calDays.length > 0,
      avgCalories: avg(calDays), avgProtein: avg(proteinDays), avgCarbs: avg(carbDays), avgFats: avg(fatDays),
      avgSteps: avg(stepDays), avgSleep: avg(sleepDays),
    };
  });

  // Bodyweight: every check-in point across the report window, not just
  // one-per-week, so a genuine trend line is possible even with a client
  // who checks in more or less than weekly.
  const weightPoints = [];
  (client.checkIns || []).forEach((c) => {
    if (!c.date || c.date < windowStart) return;
    const ans = (c.answers || []).find((a) => /weight/i.test(a.question));
    const val = ans ? parseFloat(String(ans.answer).replace(/[^0-9.]/g, "")) : NaN;
    if (!isNaN(val) && val > 0) weightPoints.push({ date: c.date, value: val });
  });
  weightPoints.sort((a, b) => a.date.localeCompare(b.date));
  const weightChange = weightPoints.length >= 2 ? +(weightPoints[weightPoints.length - 1].value - weightPoints[0].value).toFixed(1) : null;

  // PBs actually achieved inside the report window (not just "recent N",
  // which could reach back further than what this report claims to cover).
  const pbs = [];
  const sortedCompleted = [...completedSessions].sort((a, b) => a.date.localeCompare(b.date));
  sortedCompleted.forEach((session, i) => {
    if (session.date < windowStart) return;
    const before = { ...logs, sessions: sortedCompleted.slice(0, i) };
    detectSessionPBs(session, before).forEach((pb) => { if (!pb.detail.includes("first log")) pbs.push({ ...pb, date: session.date }); });
  });

  const totalVolume = weeks.reduce((s, w) => s + w.volume, 0);
  const totalSessions = weeks.reduce((s, w) => s + w.sessionsCompleted, 0);
  const firstHalfVol = weeks.slice(0, Math.floor(weeks.length / 2)).reduce((s, w) => s + w.volume, 0);
  const secondHalfVol = weeks.slice(Math.ceil(weeks.length / 2)).reduce((s, w) => s + w.volume, 0);
  const volumeTrendPct = firstHalfVol > 0 ? Math.round(((secondHalfVol - firstHalfVol) / firstHalfVol) * 100) : null;

  return {
    generatedAt: isoDate(), windowStart, windowEnd: buckets[buckets.length - 1].end, weeksBack,
    macrosOnly, weeks, weightPoints, weightChange, pbs, totalVolume, totalSessions, volumeTrendPct,
  };
}
