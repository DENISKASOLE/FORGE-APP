// Coach's Exercise Library lookups for forge-mcp. The library lives in
// trainer_data (section "custom_exercise_library") as
// { items: [{ id, name, videoUrl, muscleGroup, movementPattern, coachingCues, substitutes }] }
// - the same row the app's Exercise Library screen reads and writes.
// Pure functions only (no Supabase), so they can be tested anywhere.

export type LibraryItem = { id: string; name: string; videoUrl?: string; muscleGroup?: string; movementPattern?: string };

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function libraryItems(raw: any): LibraryItem[] {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return items.filter((it: any) => it && it.id && it.name);
}

// search_exercises: case-insensitive partial name match, sorted by name,
// names that START with the query first.
export function searchLibrary(items: LibraryItem[], query?: string, limit = 50) {
  const q = norm(query);
  const hits = items.filter((it) => !q || norm(it.name).includes(q));
  hits.sort((a, b) => {
    if (q) {
      const as = norm(a.name).startsWith(q) ? 0 : 1, bs = norm(b.name).startsWith(q) ? 0 : 1;
      if (as !== bs) return as - bs;
    }
    return a.name.localeCompare(b.name);
  });
  return hits.slice(0, Math.max(1, limit)).map((it) => ({
    id: it.id, name: it.name, videoUrl: it.videoUrl || "",
    ...(it.muscleGroup ? { muscleGroup: it.muscleGroup } : {}),
    ...(it.movementPattern ? { movementPattern: it.movementPattern } : {}),
  }));
}

// Fills name/videoUrl on every exercise of a raw (not yet hydrated)
// program, in place on a copy:
//   1. libraryExerciseId given and found -> library name + video
//   2. otherwise exact case-insensitive name match -> library video
//   3. an explicit videoUrl on the exercise always wins over the library
// Returns the resolved program plus the names still without a video and
// any libraryExerciseIds that weren't found.
export function resolveProgramVideos(program: any, items: LibraryItem[]) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const byName = new Map<string, LibraryItem>();
  items.forEach((it) => { if (!byName.has(norm(it.name))) byName.set(norm(it.name), it); });
  const unmatched = new Set<string>();
  const unknownIds = new Set<string>();
  let exercises = 0;
  let workouts = 0;
  const weeks = (program?.weeks || []).map((w: any) => ({
    ...w,
    workouts: (w?.workouts || []).map((wo: any) => {
      workouts += 1;
      return {
        ...wo,
        blocks: (wo?.blocks || []).map((b: any) => ({
          ...b,
          exercises: (b?.exercises || []).map((ex: any) => {
            exercises += 1;
            let lib: LibraryItem | undefined;
            if (ex?.libraryExerciseId) {
              lib = byId.get(ex.libraryExerciseId);
              if (!lib) unknownIds.add(ex.libraryExerciseId);
            }
            if (!lib && ex?.name) lib = byName.get(norm(ex.name));
            const name = lib?.name || ex?.name || "";
            const videoUrl = String(ex?.videoUrl || "").trim() || lib?.videoUrl || "";
            if (!videoUrl) unmatched.add(name || String(ex?.libraryExerciseId || "(unnamed)"));
            return { ...ex, name, videoUrl, libraryExerciseId: lib?.id || undefined };
          }),
        })),
      };
    }),
  }));
  return {
    program: { ...program, weeks },
    counts: { weeks: weeks.length, workouts, exercises },
    unmatchedExercises: [...unmatched],
    unknownLibraryIds: [...unknownIds],
  };
}
