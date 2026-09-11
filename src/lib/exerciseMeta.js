import { EXERCISE_TAXONOMY } from "../features/train/exerciseTaxonomy.js";

// Resolves muscle-group/movement-pattern/cues for an exercise by NAME only -
// deliberately, so this works for exercises inside any program (old or new)
// without ever needing to touch stored program/session JSON. Precedence:
// a matching custom-exercise item (tagged via the add/edit form) > a DB row
// from exercise_library (once the taxonomy migration is seeded) > the
// bundled static fallback (src/features/train/exerciseTaxonomy.js), which is
// what makes cues show up immediately, even before the migration is run.
export function getExerciseMeta(name, { dbMetaByName = {}, customItems = [] } = {}) {
  if (!name) return null;
  const custom = (customItems || []).find((it) => it.name === name);
  if (custom && custom.muscleGroup) {
    return { muscleGroup: custom.muscleGroup, movementPattern: custom.movementPattern || null, cues: custom.coachingCues || [], needsReview: !!custom.needsReview, source: "custom" };
  }
  const db = dbMetaByName[name];
  if (db && db.muscleGroup) return { ...db, source: "db" };
  const fallback = EXERCISE_TAXONOMY[name];
  if (fallback) return { ...fallback, source: "static" };
  if (custom) return { muscleGroup: null, movementPattern: null, cues: custom.coachingCues || [], needsReview: !!custom.needsReview, source: "custom" };
  return null;
}
