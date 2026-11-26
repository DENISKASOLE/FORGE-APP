// Injuries are normally a text note, but some profiles store a list (or
// an object) - turn any of them into plain text instead of crashing
// (Nov 26 2026: "(... || "").trim is not a function" on the coach app).
export function injuriesText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.name || x?.label || x?.text || "")).map((x) => String(x).trim()).filter(Boolean).join(", ");
  if (typeof v === "object") return String(v.text || v.note || v.name || "").trim();
  return String(v).trim();
}
