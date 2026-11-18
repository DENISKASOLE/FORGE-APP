// Fuel tab palette. Originally a fixed dark-only hex palette (DECISIONS.md
// "Fuel tab redesign"); Nov 2026 Denis asked for Fuel to match the rest of
// the app, including light mode, so every key now points at the shared
// CSS-variable tokens (src/styles/theme.css) instead of plain hex. Key
// names are unchanged so every Fuel screen (Today, Change-a-meal, My week,
// the coach Nutrition dashboard) keeps reading colors through this file.
export const FUEL = {
  bg: "transparent",
  card: "var(--card)",
  card2: "var(--chip)",
  line: "var(--line)",
  lineSoft: "var(--line-strong)",
  lineDashed: "var(--line-strong)",
  text: "var(--ink)",
  // Text sitting on a filled FUEL.text (selected day, "Ate it", "Next").
  onText: "var(--btn-ink)",
  // Text sitting on a filled protein/amber outcome mark.
  onColor: "#000",
  muted: "var(--ink-2)",
  dim: "var(--ink-3)",
  protein: "var(--green)",
  proteinTrack: "var(--green-bg)",
  proteinSwapped: "color-mix(in srgb, var(--green) 50%, var(--page))",
  amber: "var(--orange)",
  red: "#ED000A",
  coral: "var(--red)",
};
// Macro colors - the app-wide convention (nutritionV2Theme MACRO_COLORS):
// carbs blue, fat violet, protein green.
export const MACRO_COLOR = { carbs: "var(--blue)", fat: "var(--violet)", protein: "var(--green)" };
export const fuelLbl = { fontFamily: "var(--sans)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: FUEL.dim, fontWeight: 500 };

// The 4-state outcome model's visual mark - shared by the client My week
// day-by-day grid and the coach dashboard's last-7-days heatmap (brief:
// "the same states and legend as the client week grid"). Shapes differ,
// not just color, so the legend reads without relying on color alone.
export const OUTCOME_MARK = {
  planned: { bg: FUEL.protein, fg: FUEL.onColor, mark: "✓", label: "As planned" },
  swapped: { bg: FUEL.proteinSwapped, fg: FUEL.onColor, mark: "⇄", label: "Swapped" },
  offplan: { bg: FUEL.amber, fg: FUEL.onColor, mark: "+", label: "Off-plan" },
  missed: { bg: "transparent", fg: FUEL.dim, mark: "", label: "Missed", border: true },
};
