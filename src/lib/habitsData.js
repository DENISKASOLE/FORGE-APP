// Progress > Habits (Nov 2026). Steps / sleep / water the client logs on
// Home (client.nutrition.habits[date]), summarised per week against the
// Home goals. Averages count logged days only.
import { isoDate } from "./dateUtils.js";
import { habitLogFor } from "./nutrition.js";
import { HABIT_GOALS } from "../features/home/homeData.js";

export const HABITS = [
  { key: "steps", label: "Steps", color: "var(--green)", unit: "", goalText: "10,000 a day" },
  { key: "sleep", label: "Sleep", color: "var(--violet)", unit: "h", goalText: "8h a night" },
  { key: "water", label: "Water", color: "var(--blue)", unit: "L", goalText: "3L a day" },
];
export const goalOf = (k) => HABIT_GOALS[k];

const dayISO = (base, offset) => { const d = new Date(`${base}T12:00:00`); d.setDate(d.getDate() + offset); return isoDate(d); };

// Last 7 days ending today (oldest first).
export function weekDays(today = isoDate()) {
  return Array.from({ length: 7 }, (_, i) => dayISO(today, i - 6));
}

export function habitRows(nutrition, days) {
  return days.map((date) => {
    const h = habitLogFor(nutrition || {}, date);
    const n = (v) => { const x = parseFloat(v); return Number.isFinite(x) && x > 0 ? x : null; };
    return { date, steps: n(h.steps), sleep: n(h.sleep), water: n(h.water) };
  });
}

export function summarize(rows) {
  const out = {};
  for (const { key } of HABITS) {
    const vals = rows.map((r) => r[key]).filter((v) => v != null);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    out[key] = { avg, logged: vals.length, hits: vals.filter((v) => v >= goalOf(key)).length, pct: avg == null ? 0 : Math.min(1, avg / goalOf(key)) };
  }
  out.daysLogged = rows.filter((r) => r.steps || r.sleep || r.water).length;
  return out;
}

export function fmtHabit(key, v) {
  if (v == null) return "—";
  if (key === "steps") return Math.round(v).toLocaleString();
  return `${(Math.round(v * 10) / 10).toFixed(1)}${key === "sleep" ? "h" : "L"}`;
}
export function fmtShort(key, v) {
  if (v == null) return "—";
  return key === "steps" ? `${(v / 1000).toFixed(1)}k` : fmtHabit(key, v);
}

// One-line coach summary of the week.
export function insightFor(sum) {
  const logged = HABITS.filter((h) => sum[h.key].logged > 0);
  if (!logged.length) return "No habits logged this week.";
  const weakest = [...logged].sort((a, b) => sum[a.key].pct - sum[b.key].pct)[0];
  const w = sum[weakest.key];
  const parts = [];
  const days = (n) => `${n} day${n === 1 ? "" : "s"}`;
  if (w.pct >= 1) parts.push("Every habit is averaging on goal this week.");
  else parts.push(`${weakest.label} is the weak spot: goal hit ${w.hits} of ${days(w.logged)} logged (avg ${fmtHabit(weakest.key, w.avg)} vs ${fmtHabit(weakest.key, goalOf(weakest.key))}).`);
  logged.filter((h) => h !== weakest).forEach((h) => parts.push(`${h.label} on goal ${sum[h.key].hits} of ${days(sum[h.key].logged)}.`));
  if (sum.daysLogged < 7) parts.push(`Logged ${sum.daysLogged} of 7 days.`);
  return parts.join(" ");
}

// Weekly averages for the last n weeks (oldest first), each ending on a
// day 7*i before today.
export function lastWeeks(nutrition, today = isoDate(), n = 4) {
  return Array.from({ length: n }, (_, i) => {
    const end = dayISO(today, -7 * (n - 1 - i));
    const s = summarize(habitRows(nutrition, weekDays(end)));
    return { end, steps: s.steps.avg, sleep: s.sleep.avg, water: s.water.avg, daysLogged: s.daysLogged };
  });
}
