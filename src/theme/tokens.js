export const BRAND = {
  bg: "#000000",
  panel: "#070707",
  card: "#0d0d0d",
  card2: "#171717",
  line: "#262626",
  text: "#ffffff",
  muted: "#a1a1a1",
  dim: "#6e6e6e",
  gold: "#FFFFFF",
  red: "#FF5C5C",
  green: "#3DD68C",
  cyan: "#3FC7C0",
  blue: "#5B9EF9",
  purple: "#A78BFA",
  orange: "#FFA94D",
};

export const T = {
  bg: "#000000", panel: "#070707", card: "#0d0d0d", card2: "#171717",
  line: "#262626", muted: "#a1a1a1", dim: "#6e6e6e", accent: "#EDEDED",
  gold: "#E8C547",
  meal: { breakfast: "#FFA94D", lunch: "#38BDF8", dinner: "#A78BFA", snacks: "#3DD68C" },
  good: "#3DD68C", warn: "#FFA94D", bad: "#FF5C5C",
};

export const GLOBAL_TEXT_CSS = `
  html, body, #root { margin: 0 !important; padding: 0 !important; border: none !important; outline: none !important; box-shadow: none !important; background: ${BRAND.bg} !important; min-height: 100%; }
  body { min-height: 100vh; }
  * { font-weight: 700 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; }
  input, textarea, select, button { font-weight: 700 !important; }
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
