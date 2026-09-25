// Design tokens for the nutrition-plan feature, per NUTRITION_SPEC.md
// §0.2 ("design tokens - do not change"). Scoped to this feature only,
// not merged into the app's global BRAND/theme.css - that's a deliberate
// separate reconciliation pass (see docs/nutrition-recon.md), not
// something to fold in silently while building screens.
//
// This mockup set uses solid black cards with hairline borders, not the
// rest of the app's translucent "glass" look - a real visual language
// difference, not an oversight. Every nutrition-plan screen should use NP,
// not BRAND/T, to stay consistent with the approved mockups.
export const NP = {
  bg: "#000000", panel: "#070707", card: "#0d0d0d", card2: "#171717",
  line: "#262626", lineDashed: "#333333",
  text: "#EDEDED", muted: "#a1a1a1", dim: "#6e6e6e",
  brandRed: "#ED000A",
  kcal: "#22D3EE", protein: "#3DD68C", carbs: "#FFA94D", fat: "#A78BFA", water: "#38BDF8",
  good: "#3DD68C", warn: "#FFA94D", bad: "#FF5C5C",
  radiusCard: 16, radiusControl: 10,
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

// font-weight 700 on everything, labels uppercase + letter-spacing, per
// spec §0.3. Shared so every screen in this feature applies it identically
// instead of forty near-duplicate inline style objects.
export const npCard = (extra = {}) => ({ background: NP.card, border: `1px solid ${NP.line}`, borderRadius: NP.radiusCard, fontFamily: NP.font, ...extra });
export const npLabel = (extra = {}) => ({ fontFamily: NP.font, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: NP.dim, ...extra });
export const npInput = (extra = {}) => ({ fontFamily: NP.font, fontWeight: 700, height: 44, boxSizing: "border-box", padding: "0 12px", background: NP.card, border: `1px solid ${NP.line}`, borderRadius: NP.radiusControl, color: NP.text, fontSize: 13, width: "100%", outline: "none", ...extra });
export const npButton = (variant = "outline", extra = {}) => {
  const base = { fontFamily: NP.font, fontWeight: 700, height: 44, padding: "0 16px", borderRadius: NP.radiusControl, fontSize: 12, letterSpacing: "0.1em", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 };
  if (variant === "fill") return { ...base, background: NP.text, color: "#000000", border: 0, ...extra };
  if (variant === "ghost") return { ...base, background: "transparent", color: NP.dim, border: "none", ...extra };
  if (variant === "red") return { ...base, background: "transparent", color: "#FF6B61", border: `1px solid ${NP.line}`, ...extra };
  return { ...base, background: "transparent", color: NP.text, border: `1px solid ${NP.line}`, ...extra }; // outline
};

export function NPToggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      style={{ width: 44, height: 26, flexShrink: 0, borderRadius: 999, border: 0, background: checked ? NP.text : NP.line, padding: 3, display: "flex", justifyContent: checked ? "flex-end" : "flex-start", cursor: "pointer" }}>
      <span style={{ width: 20, height: 20, borderRadius: 999, background: checked ? "#000000" : NP.dim }} />
    </button>
  );
}
