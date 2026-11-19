// Weekly check-in, Nov 2026 redesign. A fixed five-step flow (body, how you
// felt, training & food, your words, photos + overall). The check-in is
// always available: one entry per Mon-Sun week, and sending again in the
// same week updates that week's entry instead of adding a second one.
//
// Entries keep the old `answers: [{question, answer}]` list so everything
// that already reads check-ins (weight trend, coach views, MCP tools, the
// progress report) keeps working, and add `v: 2` + `values` with the raw
// taps for the trend charts.
import { isoDate, weekKey } from "./dateUtils.js";
import { weightHistoryFromCheckins } from "./clientMetrics.js";

export const FEEL_SCALES = [
  { key: "energy", label: "Energy", options: [["😫", "Drained"], ["😕", "Low"], ["😐", "OK"], ["🙂", "Good"], ["⚡", "Great"]] },
  { key: "sleep", label: "Sleep quality", options: [["😫", "Poor"], ["😕", "Patchy"], ["😐", "OK"], ["🙂", "Good"], ["😴", "Great"]] },
  { key: "stress", label: "Stress", options: [["😌", "Calm"], ["🙂", "Low"], ["😐", "Some"], ["😣", "High"], ["🤯", "Very high"]] },
  { key: "hunger", label: "Hunger", options: [["🙂", "Rarely"], ["😐", "Normal"], ["😋", "Often"], ["😩", "Always"], ["🍽️", "Starving"]] },
];
export const TRAINING_FEEL = ["Too easy", "Just right", "Tough", "Too much"];
export const ADHERENCE = ["Under 50%", "50–75%", "75–90%", "90%+"];
export const PHOTO_SLOTS = ["Front", "Side", "Back"];

export function emptyCheckinForm() {
  return { weight: "", waist: "", energy: 0, sleep: 0, stress: 0, hunger: 0, trainingFeel: "", adherence: "", pain: "", painNote: "", win: "", obstacle: "", help: "", overall: 0, notes: "" };
}

// Week a check-in belongs to (Monday ISO). Old entries have no `week`.
export function checkinWeek(entry) {
  return entry?.week || (entry?.date ? weekKey(new Date(`${entry.date}T12:00:00`)) : "");
}
export function thisWeeksCheckin(submissions, today = new Date()) {
  const wk = weekKey(today);
  return [...(submissions || [])].reverse().find((s) => checkinWeek(s) === wk) || null;
}
export function weekLabel(today = new Date()) {
  const start = new Date(`${weekKey(today)}T12:00:00`);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const m = (d) => d.toLocaleDateString("en-GB", { month: "short" });
  return start.getMonth() === end.getMonth() ? `${start.getDate()}–${end.getDate()} ${m(end)}` : `${start.getDate()} ${m(start)} – ${end.getDate()} ${m(end)}`;
}

// Completed sessions in the current Mon-Sun week, against the number of
// workouts in the program week the client is on (null when unknown).
export function sessionsThisWeek(client, today = new Date()) {
  const from = weekKey(today);
  const to = isoDate(new Date(new Date(`${from}T12:00:00`).getTime() + 6 * 86400000));
  const sessions = (client?.trainingLogs?.sessions || []).filter((s) => s.status === "completed" && s.date && s.date >= from && s.date <= to);
  const weeks = client?.program?.weeks || [];
  const latest = [...(client?.trainingLogs?.sessions || [])].filter((s) => s.weekId).sort((a, b) => (a.date || "").localeCompare(b.date || "")).pop();
  const week = (latest && weeks.find((w) => w.id === latest.weekId)) || weeks.find((w) => (w.workouts || []).length) || null;
  const planned = week ? (week.workouts || []).length : null;
  return { done: sessions.length, planned: planned || null };
}

// Last weight before this week, for the "since last week" line.
export function previousWeight(client, today = new Date()) {
  const wk = weekKey(today);
  const pts = weightHistoryFromCheckins((client?.checkIns || []).filter((c) => checkinWeek(c) !== wk), client?.measurementsHistory).filter((p) => p.date < wk);
  return pts.length ? pts[pts.length - 1].value : null;
}

const label = (scaleKey, v) => FEEL_SCALES.find((s) => s.key === scaleKey)?.options[v - 1]?.[1] || "";

export function checkinFlags(f) {
  const flags = [];
  if (f.energy && f.energy <= 2) flags.push({ q: "Energy", a: label("energy", f.energy) });
  if (f.sleep && f.sleep <= 2) flags.push({ q: "Sleep quality", a: label("sleep", f.sleep) });
  if (f.stress >= 4) flags.push({ q: "Stress", a: label("stress", f.stress) });
  if (f.hunger >= 4) flags.push({ q: "Hunger", a: label("hunger", f.hunger) });
  if (f.trainingFeel === "Too much") flags.push({ q: "How training felt", a: "Too much" });
  if (f.adherence === "Under 50%") flags.push({ q: "Meal plan", a: "Under 50%" });
  if (f.pain === "Yes") flags.push({ q: "Pain or injury", a: f.painNote || "Yes" });
  if (f.overall && f.overall <= 4) flags.push({ q: "Overall week", a: `${f.overall}/10` });
  return flags;
}

export function buildCheckinEntry(form, { id, sessions, photoIds = [], today = new Date() }) {
  const f = form;
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
  const weight = num(f.weight);
  const waist = num(f.waist);
  const sess = sessions ? (sessions.planned ? `${sessions.done} of ${sessions.planned}` : String(sessions.done)) : "";
  const answers = [
    ["Current weight (kg)", weight ?? ""],
    ["Waist (cm)", waist ?? ""],
    ...FEEL_SCALES.map((s) => [s.label, label(s.key, f[s.key])]),
    ["Sessions logged this week", sess],
    ["How training felt", f.trainingFeel],
    ["Meal plan adherence", f.adherence],
    ["Pain or injury", f.pain === "Yes" ? `Yes${f.painNote ? ` – ${f.painNote}` : ""}` : f.pain],
    ["Biggest win this week", f.win],
    ["What got in the way", f.obstacle],
    ["Help wanted next week", f.help],
    ["Overall week (1-10)", f.overall ? String(f.overall) : ""],
    ["Anything else", f.notes],
  ].map(([question, answer]) => ({ question, answer: String(answer ?? "") }));
  return {
    id, v: 2, date: isoDate(today), week: weekKey(today),
    values: { weight, waist, energy: f.energy || null, sleep: f.sleep || null, stress: f.stress || null, hunger: f.hunger || null, trainingFeel: f.trainingFeel, adherence: f.adherence, pain: f.pain, painNote: f.painNote, win: f.win, obstacle: f.obstacle, help: f.help, overall: f.overall || null, notes: f.notes, sessions: sessions || null },
    answers, flags: checkinFlags(f), photoIds, photoId: photoIds[0] || null,
  };
}

// Same-week entry is replaced in place; otherwise appended.
export function upsertCheckin(submissions, entry) {
  const list = [...(submissions || [])];
  const i = list.findIndex((s) => checkinWeek(s) === entry.week);
  if (i >= 0) list[i] = entry; else list.push(entry);
  return list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

export function formFromEntry(entry) {
  const base = emptyCheckinForm();
  if (!entry?.values) return base;
  const v = entry.values;
  return { ...base, ...Object.fromEntries(Object.keys(base).map((k) => [k, v[k] ?? base[k]])), weight: v.weight != null ? String(v.weight) : "", waist: v.waist != null ? String(v.waist) : "" };
}

// 0-1 heights for the last `n` weeks of a value (null = no bar).
const ADH_SCORE = { "Under 50%": 0.35, "50–75%": 0.6, "75–90%": 0.82, "90%+": 1 };
export function trendSeries(submissions, key, n = 6) {
  const v2 = (submissions || []).filter((s) => s.v === 2 && s.values).slice(-n);
  return v2.map((s) => {
    if (key === "adherence") return ADH_SCORE[s.values.adherence] ?? null;
    const x = s.values[key];
    return x ? x / 5 : null;
  });
}
