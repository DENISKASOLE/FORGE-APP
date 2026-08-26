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
  ::placeholder { font-weight: 600 !important; opacity: 0.8; }
  * { box-sizing: border-box; }
  html, body, #root { max-width: 100vw; overflow-x: hidden; }
  img, video { max-width: 100%; }
`;
