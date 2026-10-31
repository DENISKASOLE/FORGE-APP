// Minimal, read-only subset ported from src/lib/trainingLogs.js, for a
// chat-facing client overview: the best logged set per exercise, and the
// most recent completed sessions. Deliberately simpler than the in-app
// detectSessionPBs (which ranks chronologically and distinguishes "new
// PB" from "best ever") - flagged as a simplification in
// forge-mcp-setup.md, not a silent shortcut.
import { TIMED_EXERCISES } from "./timedExercises.ts";

function isTimed(name: string): boolean {
  const n = (name || "").toLowerCase();
  return TIMED_EXERCISES.some((x) => n.includes(x));
}
function parseSeconds(text = ""): number {
  const t = String(text).toLowerCase().trim();
  if (!t) return 0;
  const min = t.match(/(\d+(?:\.\d+)?)\s*m/);
  const sec = t.match(/(\d+(?:\.\d+)?)\s*s/);
  if (min || sec) return Math.round((min ? parseFloat(min[1]) * 60 : 0) + (sec ? parseFloat(sec[1]) : 0));
  const n = parseFloat(t);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
// Ported verbatim from trainingLogs.js's setScoreV2/fmtLoggedSet.
function setScore(set: any, timed: boolean): number {
  if (timed) return parseSeconds(set?.duration || set?.reps || "");
  const load = parseFloat(set?.load) || 0;
  const reps = parseFloat(set?.reps) || 0;
  if (!load && !reps) return 0;
  if (!load) return reps * 0.001;
  return load * (1 + reps / 30);
}
function fmtSet(set: any, timed: boolean): string {
  if (timed) return set?.duration || set?.reps || "-";
  const load = set?.load ? `${set.load}kg` : "";
  const reps = set?.reps ? `${set.reps} reps` : "";
  return [load, reps].filter(Boolean).join(" x ") || "-";
}

export function bestLiftsFrom(trainingLogs: any): Record<string, { best: string; date: string }> {
  const best: Record<string, { score: number; set: any; date: string }> = {};
  (trainingLogs?.sessions || []).forEach((s: any) => {
    if (s.status !== "completed") return;
    (s.entries || []).forEach((e: any) => {
      const name = e.substitutedName || e.name;
      if (!name) return;
      const timed = isTimed(name);
      (e.sets || []).forEach((set: any) => {
        const score = setScore(set, timed);
        if (score > 0 && (!best[name] || score > best[name].score)) best[name] = { score, set, date: s.date };
      });
    });
  });
  const out: Record<string, { best: string; date: string }> = {};
  Object.entries(best).forEach(([name, b]) => { out[name] = { best: fmtSet(b.set, isTimed(name)), date: b.date }; });
  return out;
}

export function recentSessions(trainingLogs: any, limit = 5) {
  return (trainingLogs?.sessions || [])
    .filter((s: any) => s.status === "completed")
    .slice()
    .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, limit)
    .map((s: any) => ({ date: s.date, weekNum: s.weekNum, exercise_count: (s.entries || []).length, completed_at: s.completedAt }));
}
