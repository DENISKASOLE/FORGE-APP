// Readable text colour for a solid background. Client colours are plain
// hex (CLIENT_COLORS), so we can pick dark or light ink by luminance;
// anything else (a CSS var such as the theme accent) gets --btn-ink, the
// ink token made to sit on the accent in both themes.
export const INK_DARK = "#152321";
export const INK_LIGHT = "#FFFFFF";
export function inkOn(bg) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(bg || "").trim());
  if (!m) return "var(--btn-ink)";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast vs white (1.05/(L+.05)) against contrast vs dark ink.
  const dark = 0.0137; // luminance of INK_DARK
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / (dark + 0.05)) ? INK_LIGHT : INK_DARK;
}
