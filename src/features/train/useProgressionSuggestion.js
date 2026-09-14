import { useEffect, useState } from "react";
import { getProgressionSuggestion } from "../../lib/ai.js";

// In-memory only (per app session, not persisted) - re-fetching after a
// reload is fine, the point is just not re-firing on every keystroke
// re-render while a set is being logged.
const cache = new Map();

// Progressive enhancement on top of the instant, local suggestPlateauBump/
// suggestProgression badge (see trainingLogs.js): when a plateau is
// detected, ask the AI for an exercise-aware increment (a lateral raise
// and a deadlift shouldn't both jump +2.5kg) and swap the badge text to
// it once it resolves. Scoped to the plateau case only - suggestProgression's
// own tiered bump (5/2.5/1.25/0.5kg by absolute load) already varies
// sensibly for the non-plateau case. Fails silently on error/timeout so a
// slow or unavailable AI call never blocks or breaks the logging screen -
// the deterministic badge just stays as-is.
export function useProgressionSuggestion(exerciseName, prog, exMeta, recentSets, timed) {
  const isPlateau = prog?.reason === "plateau";
  const key = isPlateau ? `${exerciseName}|${prog.weight}` : null;
  const [ai, setAi] = useState(() => (key && cache.has(key) ? cache.get(key) : null));

  useEffect(() => {
    if (!key) return;
    if (cache.has(key)) { setAi(cache.get(key)); return; }
    let cancelled = false;
    getProgressionSuggestion({
      exerciseName,
      muscleGroup: exMeta?.muscleGroup,
      movementPattern: exMeta?.movementPattern,
      workingWeight: prog.weight,
      timed,
      recentSets,
    })
      .then((result) => {
        cache.set(key, result);
        if (!cancelled) setAi(result);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return key ? ai : null;
}
