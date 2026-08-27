import { uid } from "./uid.js";
import { isoDate } from "./dateUtils.js";
import { isTimedExercise } from "./browser.js";

export function fmtLoad(load, loadType = "kg") {
  if (loadType === "BW") return load ? `BW +${load}kg` : "BW";
  if (!load) return "";
  if (loadType === "%1RM") return `${load}%`;
  if (loadType === "RPE") return `@${load}`;
  return `${load}kg`;
}
export function fmtSetTarget(set = {}, ex = {}) {
  const timed = isTimedExercise(ex.name);
  const parts = [];
  if (set.targetReps) parts.push(timed ? set.targetReps : `${set.targetReps} reps`);
  const load = fmtLoad(set.targetLoad, ex.loadType);
  if (load) parts.push(load);
  if (set.targetRpe) parts.push(`RPE ${set.targetRpe}`);
  return parts.join(" · ");
}
export function fmtExerciseSummary(ex = {}) {
  const sets = ex.sets || [];
  const reps = [...new Set(sets.map((s) => s.targetReps || "?"))];
  const setsReps = reps.length === 1 ? `${sets.length} x ${reps[0]}` : sets.map((s) => s.targetReps || "?").join("/");
  const parts = [setsReps];
  const loads = [...new Set(sets.map((s) => fmtLoad(s.targetLoad, ex.loadType)).filter(Boolean))];
  if (loads.length === 1) parts.push(loads[0]);
  if (ex.tempo) parts.push(`Tempo ${ex.tempo}`);
  if (ex.rest) parts.push(`Rest ${ex.rest}`);
  return parts.join(" · ");
}
export function blockTitle(block, index) {
  const letter = String.fromCharCode(65 + index);
  if (block.type === "superset") return `${letter} · Superset`;
  if (block.type === "circuit") return `${letter} · Circuit x${block.rounds || 3}`;
  return `${letter} · Straight sets`;
}
export function exerciseTag(block, blockIndex, exIndex) {
  const letter = String.fromCharCode(65 + blockIndex);
  if (block.type === "straight" && block.exercises.length === 1) return letter;
  return `${letter}${exIndex + 1}`;
}
export function parseSeconds(text = "") {
  const t = String(text).toLowerCase().trim();
  if (!t) return 0;
  const min = t.match(/(\d+(?:\.\d+)?)\s*m/);
  const sec = t.match(/(\d+(?:\.\d+)?)\s*s/);
  if (min || sec) return Math.round((min ? parseFloat(min[1]) * 60 : 0) + (sec ? parseFloat(sec[1]) : 0));
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
export function fmtClock(totalSec = 0) {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export function emptyTrainingLogs() { return { version: 2, sessions: [] }; }
export function startSession(program, week, workout) {
  return {
    id: uid(), programId: program.id, programName: program.name, weekId: week.id, weekNum: week.weekNum,
    workoutId: workout.id, workoutName: workout.name, date: isoDate(),
    startedAt: new Date().toISOString(), completedAt: null, status: "in_progress",
    entries: (workout.blocks || []).flatMap((block, bi) => (block.exercises || []).map((ex, ei) => ({
      id: uid(), exerciseId: ex.id, blockId: block.id, tag: exerciseTag(block, bi, ei), name: ex.name, substitutedName: "",
      sets: (ex.sets || []).map((s) => ({ setId: s.id, reps: "", load: "", duration: "", rpe: "", done: false })),
    }))),
    metrics: { kcal: "", maxHR: "", avgHR: "" }, notes: "", sessionRpe: "",
  };
}
export function sessionForWorkout(logs, weekId, workoutId) {
  const sessions = logs?.sessions || [];
  const inProgress = sessions.find((s) => s.weekId === weekId && s.workoutId === workoutId && s.status === "in_progress");
  if (inProgress) return inProgress;
  const completed = sessions.filter((s) => s.weekId === weekId && s.workoutId === workoutId && s.status === "completed");
  return completed.length ? completed[completed.length - 1] : null;
}
// Turns the flat entries array into logging "steps": a normal exercise is
// its own step, but entries that share a blockId whose block is a superset
// are grouped into one step so they can be logged side by side. Relies on
// startSession() flatMap-ing block.exercises in order, which keeps entries
// from the same block contiguous.
export function groupSessionSteps(session, workout) {
  const blockById = {};
  (workout?.blocks || []).forEach((b) => { blockById[b.id] = b; });
  const steps = [];
  const entries = session?.entries || [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    const block = blockById[entry.blockId];
    if (block?.type === "superset") {
      const group = [];
      while (i < entries.length && entries[i].blockId === entry.blockId) { group.push(entries[i]); i += 1; }
      if (group.length >= 2) { steps.push({ type: "superset", blockId: entry.blockId, entries: group }); continue; }
      group.forEach((e) => steps.push({ type: "single", entry: e }));
    } else {
      steps.push({ type: "single", entry });
      i += 1;
    }
  }
  return steps;
}
export function upsertSessionInLogs(logs, session) {
  const base = logs && Array.isArray(logs.sessions) ? logs : emptyTrainingLogs();
  const idx = base.sessions.findIndex((s) => s.id === session.id);
  const sessions = idx >= 0 ? base.sessions.map((s, i) => (i === idx ? session : s)) : [...base.sessions, session];
  return { ...base, sessions };
}
export function setScoreV2(set, timed) {
  if (timed) return parseSeconds(set.duration || set.reps || "");
  const load = parseFloat(set.load) || 0;
  const reps = parseFloat(set.reps) || 0;
  if (!load && !reps) return 0;
  if (!load) return reps * 0.001;
  return load * (1 + reps / 30);
}
export function fmtLoggedSet(set, timed) {
  if (timed) return set.duration || set.reps || "-";
  const load = set.load ? `${set.load}kg` : "";
  const reps = set.reps ? `${set.reps} reps` : "";
  return [load, reps].filter(Boolean).join(" x ") || "-";
}
export function suggestProgression(lastSets) {
  if (!lastSets || lastSets.length === 0) return null;
  const completed = lastSets.filter((s) => s.done);
  if (completed.length === 0 || completed.length < lastSets.length) return null; // didn't finish every set last time - don't push more
  const rpes = completed.map((s) => Number(s.rpe)).filter((n) => !isNaN(n) && n > 0);
  if (rpes.length < completed.length) return null; // missing RPE data - not enough to go on
  const avgRpe = rpes.reduce((a, b) => a + b, 0) / rpes.length;
  if (avgRpe > 7.5) return null; // was already hard - hold, don't add load
  const loads = completed.map((s) => Number(s.load)).filter((n) => !isNaN(n) && n > 0);
  if (loads.length < completed.length) return null; // bodyweight/time-based - no load to bump
  const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
  const bump = avgLoad >= 60 ? 5 : avgLoad >= 30 ? 2.5 : avgLoad >= 10 ? 1.25 : 0.5;
  return { bump, avgRpe: Math.round(avgRpe * 10) / 10 };
}
export function lastSessionSetsFor(logs, exerciseName) {
  const name = String(exerciseName || "").toLowerCase();
  const sessions = [...(logs?.sessions || [])].filter((s) => s.status === "completed" && s.date).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = sessions.length - 1; i >= 0; i--) {
    const entry = (sessions[i].entries || []).find((e) => String(e.substitutedName || e.name || "").toLowerCase() === name);
    if (entry && entry.sets?.length) return entry.sets;
  }
  return [];
}
export function exerciseHistoryV2(logs, exerciseName) {
  const name = String(exerciseName || "").toLowerCase();
  const timed = isTimedExercise(exerciseName);
  const rows = [];
  for (const s of logs?.sessions || []) {
    if (s.status !== "completed" && s.status !== "in_progress") continue;
    for (const e of s.entries || []) {
      const effective = String(e.substitutedName || e.name || "").toLowerCase();
      if (effective !== name) continue;
      for (const set of e.sets || []) {
        const score = setScoreV2(set, timed);
        if (score > 0) rows.push({ score, set, date: s.date });
      }
    }
  }
  const best = rows.length ? rows.reduce((a, b) => (b.score > a.score ? b : a), rows[0]) : null;
  const recent = rows.length ? rows[rows.length - 1] : null;
  return {
    hasData: rows.length > 0,
    best: best ? `${fmtLoggedSet(best.set, timed)} · ${best.date || ""}` : "No PB yet",
    bestScore: best ? best.score : 0,
    recent: recent ? `${fmtLoggedSet(recent.set, timed)} · ${recent.date || ""}` : "No recent log",
  };
}
export function sessionStatsV2(session) {
  let volume = 0, setsDone = 0, setsTotal = 0;
  for (const e of session?.entries || []) for (const s of e.sets || []) {
    setsTotal += 1;
    if (s.done || s.reps || s.load || s.duration) { setsDone += 1; volume += (parseFloat(s.load) || 0) * (parseFloat(s.reps) || 0); }
  }
  const dur = session?.startedAt && session?.completedAt ? Math.round((new Date(session.completedAt) - new Date(session.startedAt)) / 1000) : 0;
  return { volume: Math.round(volume), setsDone, setsTotal, durationSec: dur };
}
export function detectSessionPBs(session, logsBefore) {
  const pbs = []; const seen = new Set();
  for (const e of session?.entries || []) {
    const name = e.substitutedName || e.name;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const timed = isTimedExercise(name);
    const prior = exerciseHistoryV2(logsBefore, name).bestScore;
    let bestNow = 0, bestSet = null;
    for (const s of e.sets || []) { const sc = setScoreV2(s, timed); if (sc > bestNow) { bestNow = sc; bestSet = s; } }
    if (bestSet && bestNow > 0 && (bestNow > prior || prior === 0)) pbs.push({ name, detail: fmtLoggedSet(bestSet, timed) + (prior === 0 ? " (first log)" : "") });
  }
  return pbs;
}
