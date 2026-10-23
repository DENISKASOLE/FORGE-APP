// Nutrition feature color/type tokens. Originally a separate warm custom
// palette (DECISIONS.md "Nutrition redesign v2"); Denis reviewed it live
// and asked for the app-native direction instead - no separate nutrition
// identity, just the app's own BRAND/T tokens (src/theme/tokens.js) and
// its existing macro-color convention (gold/green/blue/violet), so every
// nutrition screen looks like the rest of Forge rather than a different
// sub-brand. Every component in this feature reads colors through this
// one file, so this is the only place that needed to change - nothing
// else in the redesign (the hero ring, meal timeline, meal builder, the
// coach dashboard) depends on which palette backs it.
import { BRAND } from "../../theme/tokens.js";

export const NT = {
  bg: BRAND.bg, card: BRAND.card, card2: BRAND.card2,
  line: BRAND.line, lineSoft: BRAND.lineSoft, lineDashed: BRAND.lineSoft,
  text: BRAND.text, muted: BRAND.muted, dim: BRAND.dim, faint: BRAND.dim,
  accent: BRAND.gold, accentBg: "color-mix(in srgb, var(--accent) 14%, transparent)",
  protein: BRAND.green, proteinBg: BRAND.greenBg,
  carbs: BRAND.blue, carbsBg: BRAND.blueBg,
  fat: BRAND.violet, fatBg: BRAND.violetBg,
  bad: BRAND.red, badBg: BRAND.redBg, badBorder: "color-mix(in srgb, var(--red) 35%, transparent)",
  display: BRAND.display, sans: BRAND.sans,
};
export const MACRO_COLORS = { kcal: NT.accent, protein: NT.protein, carbs: NT.carbs, fat: NT.fat };
export const MACRO_BG = { kcal: NT.accentBg, protein: NT.proteinBg, carbs: NT.carbsBg, fat: NT.fatBg };

export function pillStyle(selected) {
  return {
    border: `${BRAND.hairline} solid ${selected ? "transparent" : NT.lineSoft}`,
    background: selected ? NT.accent : "transparent",
    color: selected ? BRAND.btnInk : NT.muted,
    fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".01em",
    padding: "9px 14px", borderRadius: 999, cursor: "pointer",
  };
}
export function cardStyle(extra = {}) {
  return { background: NT.card, border: `${BRAND.hairline} solid ${NT.line}`, borderRadius: BRAND.radiusCard, ...extra };
}
