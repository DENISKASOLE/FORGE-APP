// Warm redesign (DECISIONS.md) - the Nutrition feature's own visual
// identity, scoped to its screens only. Not the app's global BRAND/T
// tokens (src/theme/tokens.js), which every other feature keeps using
// unchanged. Matches the design canvas Denis approved:
// https://claude.ai/artifact/VHBGywgetUqSjdWt5Agrp9
export const NT = {
  bg: "#15120F", card: "#1E1A16", card2: "#2A251F",
  line: "rgba(255,255,255,.06)", lineSoft: "rgba(255,255,255,.08)", lineDashed: "#4F483E",
  text: "#F3EEE6", muted: "#A69C8D", dim: "#7A7265", faint: "#4F483E",
  accent: "#E3A45C", accentBg: "rgba(227,164,92,.14)",
  protein: "#8FB996", proteinBg: "rgba(143,185,150,.14)",
  carbs: "#7FA6C9", carbsBg: "rgba(127,166,201,.14)",
  fat: "#B49BD0", fatBg: "rgba(180,155,208,.14)",
  bad: "#D98A85", badBg: "rgba(180,97,91,.16)", badBorder: "rgba(180,97,91,.25)",
  display: "'Fraunces', serif", sans: "'Inter', system-ui, sans-serif",
};
export const MACRO_COLORS = { kcal: NT.accent, protein: NT.protein, carbs: NT.carbs, fat: NT.fat };
export const MACRO_BG = { kcal: NT.accentBg, protein: NT.proteinBg, carbs: NT.carbsBg, fat: NT.fatBg };

export function pillStyle(selected) {
  return {
    border: `1px solid ${selected ? "transparent" : "rgba(255,255,255,.1)"}`,
    background: selected ? NT.accent : "transparent",
    color: selected ? NT.bg : NT.muted,
    fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".01em",
    padding: "9px 14px", borderRadius: 999, cursor: "pointer",
  };
}
export function cardStyle(extra = {}) {
  return { background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, ...extra };
}
