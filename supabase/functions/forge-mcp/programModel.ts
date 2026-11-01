// Ported, dependency-free subset of src/lib/programModel.js's
// hydrateAIProgram + normalizeProgramDays + currentProgramWeek - the
// exact same shape and hydration rules the in-app AI program assistant
// already produces, so a program written here is indistinguishable from
// one built by hand in ProgramBuilder.
const LOAD_TYPES = ["kg", "%1RM", "RPE", "BW"];
const BLOCK_TYPES = ["straight", "superset", "circuit"];
const uid = () => crypto.randomUUID();

function weekDayMap(week: any): Record<number, any> {
  const map: Record<number, any> = {};
  const spare: any[] = [];
  (week?.workouts || []).forEach((w: any) => {
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

function normalizeProgramDays(program: any): any {
  if (!program?.weeks) return program;
  return {
    ...program,
    weeks: program.weeks.map((week: any) => {
      const map = weekDayMap(week);
      const dowOf: Record<string, number> = {};
      Object.entries(map).forEach(([dow, w]: [string, any]) => { dowOf[w.id] = Number(dow); });
      return { ...week, restDays: week.restDays || {}, workouts: (week.workouts || []).map((w: any) => ({ ...w, dayOfWeek: dowOf[w.id] ?? null })) };
    }),
  };
}

// ---------- exercise video links ----------
// Only http(s) links are kept, so a save can never store a javascript: or
// data: URL that the client app would later open.
export function cleanVideoUrl(v: any): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? s : "";
  } catch {
    return "";
  }
}

// Case/spacing-insensitive key so "DB Lateral Raises" matches
// "DB LATERAL RAISES" and "SkiErg" matches "SKIERG".
export function exerciseKey(name: any): string {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// name-key -> videoUrl, from every exercise in a stored program.
export function videoMapFromProgram(program: any): Record<string, string> {
  const map: Record<string, string> = {};
  (program?.weeks || []).forEach((w: any) => (w?.workouts || []).forEach((wo: any) => (wo?.blocks || []).forEach((b: any) => (b?.exercises || []).forEach((ex: any) => {
    const url = cleanVideoUrl(ex?.videoUrl);
    const key = exerciseKey(ex?.name);
    if (url && key && !map[key]) map[key] = url;
  }))));
  return map;
}

// name-key -> videoUrl, from the coach's custom exercise library items.
export function videoMapFromLibrary(items: any): Record<string, string> {
  const map: Record<string, string> = {};
  (Array.isArray(items) ? items : []).forEach((it: any) => {
    const url = cleanVideoUrl(it?.videoUrl);
    const key = exerciseKey(it?.name);
    if (url && key && !map[key]) map[key] = url;
  });
  return map;
}

// fallbackVideos: name-key -> url, used when an exercise is saved without
// its own videoUrl (so re-saving a program never wipes the coach's links).
export function hydrateProgram(raw: any, existingId?: string, fallbackVideos: Record<string, string> = {}): any {
  const weeks = (raw?.weeks || []).map((w: any, wi: number) => ({
    id: uid(),
    weekNum: Number(w?.weekNum) || wi + 1,
    label: w?.label || "",
    focus: w?.focus || "",
    targetRpe: w?.targetRpe || "",
    restDays: {},
    workouts: (w?.workouts || []).map((wo: any) => ({
      id: uid(),
      name: wo?.name || "Workout",
      note: wo?.note || "",
      dayOfWeek: Number(wo?.dayOfWeek) >= 1 && Number(wo?.dayOfWeek) <= 7 ? Number(wo.dayOfWeek) : null,
      blocks: (wo?.blocks || []).map((b: any) => ({
        id: uid(),
        type: BLOCK_TYPES.includes(b?.type) ? b.type : "straight",
        rounds: Number(b?.rounds) || (b?.type === "circuit" ? 3 : 1),
        exercises: (b?.exercises || []).map((ex: any) => ({
          id: uid(),
          name: ex?.name || "",
          loadType: LOAD_TYPES.includes(ex?.loadType) ? ex.loadType : "kg",
          tempo: ex?.tempo || "",
          rest: ex?.rest || "",
          note: ex?.note || "",
          videoUrl: cleanVideoUrl(ex?.videoUrl) || fallbackVideos[exerciseKey(ex?.name)] || "",
          sets: (ex?.sets?.length ? ex.sets : [{}]).map((s: any) => ({
            id: uid(), targetReps: s?.targetReps || "", targetLoad: s?.targetLoad || "", targetRpe: s?.targetRpe || "",
          })),
        })),
      })),
    })),
  }));
  return normalizeProgramDays({
    version: 2,
    id: existingId || uid(),
    name: raw?.name || "Program",
    goal: raw?.goal || "",
    startDate: raw?.startDate || new Date().toISOString().slice(0, 10),
    weeks: weeks.length ? weeks : [{ id: uid(), weekNum: 1, label: "", focus: "", targetRpe: "", workouts: [], restDays: {} }],
  });
}

// Note: "today" is computed in UTC (edge functions have no local
// timezone) - only matters right at the UTC midnight boundary, and only
// as a fallback when startDate/current-week aren't explicit.
export function currentProgramWeek(program: any): number {
  if (!program?.weeks?.length) return 1;
  const start = new Date(`${program.startDate || new Date().toISOString().slice(0, 10)}T00:00:00`);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day)); // Monday of start week
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`);
  const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return Math.min(Math.max(1, Math.floor(diff / 7) + 1), program.weeks.length);
}
