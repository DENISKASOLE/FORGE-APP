// BRAND/T hold the app's color values as CSS var() references rather than
// hex literals, so every component that already imports them (nearly all
// of them - this predates the CSS variable system) picks up the central
// token system in src/styles/theme.css automatically. See DECISIONS.md for
// the mapping from the old hex palette to the new tokens.
export const BRAND = {
  bg: "var(--page)",
  panel: "var(--card-soft)",
  card: "var(--card)",
  card2: "var(--chip)",
  line: "var(--line)",
  lineSoft: "var(--line-soft)",
  lineStrong: "var(--line-strong)",
  text: "var(--ink)",
  muted: "var(--ink-2)",
  dim: "var(--ink-3)",
  gold: "var(--accent)",
  accentDeep: "var(--accent-deep)",
  red: "var(--red)",
  redBg: "var(--red-bg)",
  green: "var(--green)",
  greenBg: "var(--green-bg)",
  cyan: "var(--blue)",
  blue: "var(--blue)",
  blueBg: "var(--blue-bg)",
  yellow: "var(--yellow)",
  yellowBg: "var(--yellow-bg)",
  violet: "var(--violet)",
  violetBg: "var(--violet-bg)",
  purple: "var(--violet)",
  orange: "var(--accent)",
  btnBg: "var(--btn-bg)",
  btnInk: "var(--btn-ink)",
  display: "var(--display)",
  sans: "var(--sans)",
  radiusCard: "var(--radius-card)",
  radiusControl: "var(--radius-control)",
  hairline: "var(--hairline)",
};

export const T = {
  bg: "var(--page)", panel: "var(--card-soft)", card: "var(--card)", card2: "var(--chip)",
  line: "var(--line)", lineSoft: "var(--line-soft)", lineStrong: "var(--line-strong)",
  muted: "var(--ink-2)", dim: "var(--ink-3)", accent: "var(--ink)",
  gold: "var(--accent)", accentDeep: "var(--accent-deep)",
  meal: { breakfast: "var(--accent)", lunch: "var(--blue)", dinner: "var(--violet)", snacks: "var(--green)" },
  good: "var(--green)", goodBg: "var(--green-bg)",
  warn: "var(--yellow)", warnBg: "var(--yellow-bg)",
  bad: "var(--red)", badBg: "var(--red-bg)",
  blue: "var(--blue)", blueBg: "var(--blue-bg)",
  violet: "var(--violet)", violetBg: "var(--violet-bg)",
  display: "var(--display)", sans: "var(--sans)",
  radiusCard: "var(--radius-card)", radiusControl: "var(--radius-control)", hairline: "var(--hairline)",
};
