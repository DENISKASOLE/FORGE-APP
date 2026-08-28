// Values point at the CSS custom properties defined in src/styles/tokens.css
// (ported from forge-app-v2) rather than literal hex codes. Every consumer in
// this codebase reads colors through BRAND.x / T.x in inline `style={{}}`
// objects, so retargeting these two objects re-themes the whole app without
// having to touch each call site - a plain string like "var(--ember)" is a
// perfectly valid CSS value for a React inline style.
export const BRAND = {
  bg: "var(--ink)",
  panel: "var(--ink2)",
  card: "var(--surface)",
  card2: "var(--surface2)",
  line: "var(--line)",
  text: "var(--bone)",
  muted: "var(--boneDim)",
  dim: "var(--muted)",
  gold: "var(--ember)",
  red: "var(--red)",
  green: "var(--sage)",
  cyan: "var(--court)",
  blue: "var(--court)",
  purple: "var(--violet)",
  orange: "var(--amber)",
};

export const T = {
  bg: "var(--ink)", panel: "var(--ink2)", card: "var(--surface)", card2: "var(--surface2)",
  line: "var(--line)", muted: "var(--boneDim)", dim: "var(--muted)", accent: "var(--ember)",
  gold: "var(--amber)",
  meal: { breakfast: "var(--amber)", lunch: "var(--court)", dinner: "var(--violet)", snacks: "var(--sage)" },
  good: "var(--sage)", warn: "var(--amber)", bad: "var(--red)",
};

export const GLOBAL_TEXT_CSS = `
  html, body, #root { margin: 0 !important; padding: 0 !important; border: none !important; outline: none !important; box-shadow: none !important; background: ${BRAND.bg} !important; min-height: 100%; }
  body { min-height: 100vh; }
  * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; }
  button { color: inherit; background: none; }
  button:disabled { opacity: 0.5; }
  button:not(:disabled) { transition: filter .12s ease, transform .1s ease; }
  button:not(:disabled):active { transform: scale(0.96); filter: brightness(0.92); }
  @media (hover: hover) and (pointer: fine) {
    button:not(:disabled):hover { filter: brightness(1.1); }
  }
  ::placeholder { font-weight: 600 !important; opacity: 0.8; }
  * { box-sizing: border-box; }
  html, body, #root { max-width: 100vw; overflow-x: hidden; }
  img, video { max-width: 100%; }
  select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1a1' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 16px;
    padding-right: 32px !important;
  }
  select option { background: ${BRAND.card2}; color: ${BRAND.text}; }
  input[type="checkbox"], input[type="radio"] { accent-color: ${BRAND.text}; width: 18px; height: 18px; }
  input[type="date"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.7; }
`;
