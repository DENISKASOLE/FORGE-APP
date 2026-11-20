// Shared screen styles (see Screen.jsx).
import { BRAND } from "../../theme/tokens.js";

export const screenCard = { background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 20, boxSizing: "border-box", minWidth: 0 };
export const screenLabel = { fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: BRAND.dim };
export const tint = (c = "var(--accent)") => `color-mix(in srgb, ${c} 12%, var(--card))`;
