// Coach-set challenges (Nov 26 2026): e.g. "as many push-ups as you can,
// every day for 90 days". The coach designs one and assigns it; each client
// gets their own copy and logs sets per day on a calendar.
//
// Stored per client in client_data section "challenges": { items: [Challenge] }
// Challenge = {
//   id, name, exercise, unit ("reps" | "seconds" | "minutes" | "km"),
//   days, startDate "YYYY-MM-DD",
//   target: { mode: "none" | "fixed" | "ramp", value, start, step },
//   logs: { "YYYY-MM-DD": [number, ...] },   // one number per set
//   createdAt, coachName, groupId              // groupId = same assignment
// }
import { isoDate } from "./dateUtils.js";
import { uid } from "./uid.js";

export const UNITS = ["reps", "seconds", "minutes", "km"];

const toDate = (iso) => new Date(`${iso}T12:00:00`);
const addDays = (iso, n) => isoDate(new Date(toDate(iso).getTime() + n * 86400000));
const diffDays = (a, b) => Math.round((toDate(a) - toDate(b)) / 86400000);

export function newChallenge({ name, exercise, unit = "reps", days = 30, startDate, target, coachName = "", groupId }) {
  return {
    id: uid(),
    name: String(name || "").trim() || `${days}-Day ${exercise || "Challenge"}`,
    exercise: String(exercise || "").trim() || "Push-ups",
    unit: UNITS.includes(unit) ? unit : "reps",
    days: Math.max(1, Math.min(365, Math.round(Number(days) || 30))),
    startDate: startDate || isoDate(new Date()),
    target: normalizeTarget(target),
    logs: {},
    createdAt: new Date().toISOString(),
    coachName,
    groupId: groupId || uid(),
  };
}

export function normalizeTarget(t) {
  const mode = ["fixed", "ramp"].includes(t?.mode) ? t.mode : "none";
  const n = (v, d = 0) => Math.max(0, Number(v) || d);
  return { mode, value: n(t?.value), start: n(t?.start), step: n(t?.step) };
}

export const challengeList = (client) => (Array.isArray(client?.challenges) ? client.challenges : []);
export const endDate = (ch) => addDays(ch.startDate, ch.days - 1);
// Day number 1..days for a date (0 = before start, > days = after end).
export const dayNumber = (ch, iso) => diffDays(iso, ch.startDate) + 1;
export const dateForDay = (ch, n) => addDays(ch.startDate, n - 1);

export function targetFor(ch, n) {
  const t = normalizeTarget(ch?.target);
  if (t.mode === "fixed") return t.value || 0;
  if (t.mode === "ramp") return Math.round(t.start + t.step * (n - 1));
  return 0;
}

export const dayTotal = (ch, iso) => (ch?.logs?.[iso] || []).reduce((s, v) => s + (Number(v) || 0), 0);

// "hit" | "part" | "miss" | "today" | "future" for one day of the challenge.
// No target: anything logged counts as hit.
export function dayState(ch, n, todayISO) {
  const iso = dateForDay(ch, n);
  const total = dayTotal(ch, iso);
  const target = targetFor(ch, n);
  const done = total > 0 && (target === 0 || total >= target);
  if (iso > todayISO) return "future";
  if (done) return "hit";
  if (iso === todayISO) return "today";
  return total > 0 ? "part" : "miss";
}

export function challengeStatus(ch, todayISO) {
  const n = dayNumber(ch, todayISO);
  if (n < 1) return "upcoming";
  if (n > ch.days) return "finished";
  return "active";
}

export function challengeStats(ch, todayISO) {
  const status = challengeStatus(ch, todayISO);
  const dayNow = Math.max(0, Math.min(ch.days, dayNumber(ch, todayISO)));
  let total = 0, best = 0, hit = 0;
  for (let n = 1; n <= ch.days; n++) {
    const iso = dateForDay(ch, n);
    if (iso > todayISO) break;
    const t = dayTotal(ch, iso);
    total += t;
    best = Math.max(best, t);
    if (dayState(ch, n, todayISO) === "hit") hit += 1;
  }
  // Streak: consecutive hit days ending today (today counts once hit,
  // otherwise the streak runs up to yesterday).
  let streak = 0;
  for (let n = Math.min(dayNow, ch.days); n >= 1; n--) {
    const st = dayState(ch, n, todayISO);
    if (st === "hit") streak += 1;
    else if (st === "today") continue;
    else break;
  }
  const todayISOInRange = status === "active" ? todayISO : null;
  return {
    status, dayNow, total, best, hit, streak,
    today: todayISOInRange ? dayTotal(ch, todayISO) : 0,
    todayTarget: todayISOInRange ? targetFor(ch, dayNow) : 0,
  };
}

// The challenge to show on the client's Home: active first, then upcoming,
// then one finished in the last 7 days.
export function featuredChallenge(client, todayISO = isoDate(new Date())) {
  const list = challengeList(client);
  const by = (st) => list.filter((c) => challengeStatus(c, todayISO) === st);
  return by("active")[0] || by("upcoming")[0] || by("finished").find((c) => diffDays(todayISO, endDate(c)) <= 7) || null;
}

export function addSet(ch, iso, amount) {
  const v = Math.round(Number(amount) * 100) / 100;
  if (!(v > 0)) return ch;
  return { ...ch, logs: { ...(ch.logs || {}), [iso]: [...(ch.logs?.[iso] || []), v] } };
}
export function removeSet(ch, iso, index) {
  const sets = (ch.logs?.[iso] || []).filter((_, i) => i !== index);
  const logs = { ...(ch.logs || {}) };
  if (sets.length) logs[iso] = sets; else delete logs[iso];
  return { ...ch, logs };
}
export function replaceChallenge(list, ch) {
  return list.map((c) => (c.id === ch.id ? ch : c));
}

export const unitShort = (unit) => ({ reps: "", seconds: "s", minutes: "min", km: "km" }[unit] ?? "");
export const fmtAmount = (v, unit) => `${Number(v).toLocaleString("en-US")}${unitShort(unit) ? ` ${unitShort(unit)}` : ""}`;
