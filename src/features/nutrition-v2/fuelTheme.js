// Fixed palette for the Fuel tab redesign (DECISIONS.md "Fuel tab
// redesign"), approved by Denis in docs/design/fuel-tab/*.dc.html. These
// are deliberately plain hex, not the adaptive NT/BRAND tokens the rest
// of nutrition-v2 uses - same one-off-departure precedent as
// NutritionV2Flow.jsx's HERO_BLUE - because the approved design is a
// fixed dark look, not a light/dark-adaptive one. Every Fuel screen
// (Today, Change-a-meal, My week, the coach Nutrition dashboard) reads
// its colors through this one file.
export const FUEL = {
  bg: "#000000",
  card: "#0d0d0d",
  card2: "#171717",
  line: "#262626",
  lineSoft: "#333333",
  lineDashed: "#3a3a3a",
  text: "#EDEDED",
  muted: "#a1a1a1",
  dim: "#8f8f8f",
  protein: "#3DD68C",
  proteinTrack: "#123326",
  proteinSwapped: "#9fe8c4",
  amber: "#FFA94D",
  red: "#ED000A",
  // Soft coral - a second, milder red distinct from the solid brand red
  // (#ED000A, reserved for the coach avatar per the brief's ground
  // rules). Confirmed against the actual rendered mockups: Swap.dc.html's
  // "Skip" eating-out tile and Coach.dc.html's most-severe roster flag
  // ("No log for 6 days") both use this exact #FF7A7A, never the brand red.
  coral: "#FF7A7A",
};
export const fuelLbl = { fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: FUEL.muted, fontWeight: 700 };
