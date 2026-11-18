// Small shared icons for the Fuel screens.
export function Chevron({ dir = "right", color = "currentColor", size = 16 }) {
  const d = dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6";
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function PlusIcon({ color = "currentColor", size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" /></svg>;
}
export function CheckIcon({ color = "#000", size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function ChartIcon({ color = "currentColor", size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>;
}
