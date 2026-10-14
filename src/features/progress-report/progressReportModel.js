// Constants/factories for the Progress Report (DECISIONS.md). Ported from
// the "Forge Progress Report" prototype's own period/comparison/category
// choices, adapted to what Forge actually tracks - see progressReportMath.js
// for the real-data math these drive.
export const REPORT_PERIODS = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "4w", label: "4 weeks", days: 28 },
  { key: "12w", label: "12 weeks", days: 84 },
  { key: "custom", label: "Custom" },
];
export const COMPARISON_OPTIONS = [
  { key: "prev", label: "Previous" },
  { key: "base", label: "Baseline" },
  { key: "none", label: "None" },
];
export const REPORT_SECTIONS = ["summary", "body", "training", "nutrition", "heart", "recovery", "review"];
export const REPORT_SECTION_LABELS = {
  summary: "Executive summary", body: "Body metrics", training: "Training performance",
  nutrition: "Nutrition performance", heart: "Heart rate & workout energy",
  recovery: "Recovery & behaviour", review: "Coach review & next period",
};
// The prototype's 4 fixed training categories, mapped from Forge's real
// movement-pattern taxonomy (exerciseTaxonomy.js's MOVEMENT_PATTERNS).
// Exercises with no taxonomy match (custom/DB-only exercises not in the
// static fallback) fall into "Accessory" rather than being dropped.
export const TRAINING_CATEGORIES = ["Squat & hinge", "Push", "Pull", "Accessory"];
export const MOVEMENT_PATTERN_TO_CATEGORY = {
  Squat: "Squat & hinge", Hinge: "Squat & hinge", Lunge: "Squat & hinge",
  "Horizontal push": "Push", "Vertical push": "Push",
  "Horizontal pull": "Pull", "Vertical pull": "Pull",
  Carry: "Accessory", "Rotation/Anti-rotation": "Accessory", Isolation: "Accessory",
};
export function categoryForExercise(name, taxonomy) {
  const pattern = taxonomy?.[name]?.movementPattern;
  return MOVEMENT_PATTERN_TO_CATEGORY[pattern] || "Accessory";
}
// Fixed light-theme hex (src/styles/theme.css's light palette, not the
// live app theme) - a printed report is always a light page regardless
// of the coach's current app theme, matching buildWeeklyReportPDF's own
// convention. The chart PNGs below use these same hex values so the
// live preview and the exported PDF can never visually diverge - one
// chart-rendering code path for both surfaces (DECISIONS.md).
export const REPORT_COLORS = {
  ink: "#000000", ink2: "#5C5C5C", muted: "#8A8A8A",
  kcal: "#C06B1F", protein: "#2E9B68", carbs: "#4472C4", fat: "#7C5CD9",
  red: "#C3392F", yellow: "#B8860B", line: "#E2D8C8", card: "#F2EBDF",
};
