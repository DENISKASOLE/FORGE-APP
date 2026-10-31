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

export function hydrateProgram(raw: any, existingId?: string): any {
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
          videoUrl: "",
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
