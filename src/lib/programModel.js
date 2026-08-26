import { uid } from "./uid.js";
import { isoDate, startOfWeek, addDays } from "./dateUtils.js";
import { sessionForWorkout } from "./trainingLogs.js";
import { DEFAULT_EXERCISE_VIDEOS } from "./exerciseVideos.js";

export function newSet() { return { id: uid(), targetReps: "", targetLoad: "", targetRpe: "" }; }
export function newExercise(name = "") {
  return { id: uid(), name, loadType: "kg", tempo: "", rest: "", note: "", videoUrl: DEFAULT_EXERCISE_VIDEOS[name] || "", sets: [newSet(), newSet(), newSet()] };
}
export function newBlock(type = "straight") { return { id: uid(), type, rounds: type === "circuit" ? 3 : 1, exercises: [] }; }
export function newWorkout(name = "Workout") { return { id: uid(), name, note: "", blocks: [], dayOfWeek: null }; }
export function newProgWeek(n = 1) { return { id: uid(), weekNum: n, label: "", focus: "", targetRpe: "", workouts: [], restDays: {} }; }
export function newProgram(name = "New Program", goal = "General Fitness", weeksCount = 4) {
  return { version: 2, id: uid(), name, goal, startDate: isoDate(), weeks: Array.from({ length: weeksCount }, (_, i) => newProgWeek(i + 1)) };
}
export function cloneWithNewIds(node) {
  if (Array.isArray(node)) return node.map(cloneWithNewIds);
  if (node && typeof node === "object") {
    const out = {};
    for (const k of Object.keys(node)) out[k] = cloneWithNewIds(node[k]);
    if (out.id) out.id = uid();
    return out;
  }
  return node;
}
// ---------- Program calendar: day allocation + rest days ----------
// A program day is derived from the program's start date, so the calendar and
// the adherence numbers always agree. Any day without a workout is a rest day.
export const DOW_LETTER = ["M", "T", "W", "T", "F", "S", "S"];
export const DOW_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function programStart(program) {
  const raw = program?.startDate;
  const d = raw ? new Date(`${raw}T00:00:00`) : new Date();
  const valid = isNaN(d.getTime()) ? new Date() : d;
  return startOfWeek(valid);
}
export function dayDate(program, weekNum, dow) {
  return addDays(programStart(program), (weekNum - 1) * 7 + (dow - 1));
}
export function restNoteFor(week, dow) { return week?.restDays?.[dow] || ""; }
// Programs built before day allocation existed have no dayOfWeek on their workouts.
// Rather than have those weeks render as seven rest days, lay the workouts out
// Mon, Tue, Wed... in order. Nothing disappears, and the coach can move them after.
export function weekDayMap(week) {
  const map = {};
  const spare = [];
  (week?.workouts || []).forEach((w) => {
    const dow = Number(w.dayOfWeek);
    if (dow >= 1 && dow <= 7 && !map[dow]) map[dow] = w;
    else spare.push(w);
  });
  let cursor = 1;
  spare.forEach((w) => {
    while (cursor <= 7 && map[cursor]) cursor += 1;
    if (cursor <= 7) map[cursor] = w;
  });
  return map;
}
export function workoutForDay(week, dow) { return weekDayMap(week)[dow] || null; }
export function unassignedWorkouts(week) { return (week?.workouts || []).filter((w) => !w.dayOfWeek); }
// Writes the implied layout back onto the workouts, so what the builder shows is
// exactly what gets saved.
export function normalizeProgramDays(program) {
  if (!program?.weeks) return program;
  return {
    ...program,
    startDate: program.startDate || isoDate(),
    weeks: program.weeks.map((week) => {
      const map = weekDayMap(week);
      const dowOf = {};
      Object.entries(map).forEach(([dow, w]) => { dowOf[w.id] = Number(dow); });
      return {
        ...week,
        restDays: week.restDays || {},
        workouts: (week.workouts || []).map((w) => ({ ...w, dayOfWeek: dowOf[w.id] ?? null })),
      };
    }),
  };
}
export function buildProgramDays(program, logs) {
  if (!program?.weeks?.length) return [];
  const todayISO = isoDate(new Date());
  const out = [];
  program.weeks.forEach((week) => {
    for (let dow = 1; dow <= 7; dow++) {
      const date = dayDate(program, week.weekNum, dow);
      const dateISO = isoDate(date);
      const workout = workoutForDay(week, dow);
      const session = workout ? sessionForWorkout(logs, week.id, workout.id) : null;
      let state;
      if (!workout) state = "rest";
      else if (session?.status === "completed") state = "completed";
      else if (dateISO === todayISO) state = "today";
      else if (session?.status === "in_progress") state = "in_progress";
      else if (dateISO < todayISO) state = "missed";
      else state = "scheduled";
      out.push({
        key: `${week.id}_${dow}`, week, weekNum: week.weekNum, dow,
        date, dateISO, workout, session,
        isRest: !workout, note: restNoteFor(week, dow), state,
      });
    }
  });
  return out;
}
export function currentProgramWeek(program) {
  if (!program?.weeks?.length) return 1;
  const diff = Math.floor((new Date(`${isoDate(new Date())}T00:00:00`) - new Date(`${isoDate(programStart(program))}T00:00:00`)) / 86400000);
  return Math.min(Math.max(1, Math.floor(diff / 7) + 1), program.weeks.length);
}
export function exerciseCountOf(workout) {
  return (workout?.blocks || []).reduce((n, b) => n + (b.exercises?.length || 0), 0);
}
export function findPrescribedExercise(workout, entry) {
  for (const b of workout?.blocks || []) {
    for (const ex of b.exercises || []) {
      if (ex.id === entry.exerciseId) return ex;
    }
  }
  return null;
}
