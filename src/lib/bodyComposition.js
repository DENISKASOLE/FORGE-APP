// Body composition scans (Nov 19 2026). Replaces the AI-read "Body
// Analysis" uploads: the coach (or Claude, from a report Denis shares)
// enters the three numbers that matter from an InBody/DEXA/bioimpedance
// report - body weight, body fat % and lean body mass - plus the date.
// Stored in the client_data section `body_composition` as { scans: [] }.
//
// Older AI-read reports (section `body_analysis`) are folded in read-only,
// so no history is lost.
import { upsertSection } from "./clientData.js";

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

// Lean mass when only weight and body fat are known.
export function leanFrom(weight, bodyFat) {
  const w = num(weight), bf = num(bodyFat);
  return w != null && bf != null ? round1(w * (1 - bf / 100)) : null;
}

export function normalizeScan(s) {
  const weight = round1(num(s.weight));
  const bodyFat = round1(num(s.bodyFat));
  const leanMass = round1(num(s.leanMass)) ?? leanFrom(weight, bodyFat);
  return { ...s, weight, bodyFat, leanMass };
}

function legacyScans(bodyAnalysis = []) {
  const pick = (metrics, re) => {
    const m = metrics.find((x) => re.test(`${x.key || ""} ${x.label || ""}`));
    return m ? num(m.value) : null;
  };
  return bodyAnalysis.map((r) => {
    const metrics = r.extracted?.metrics || [];
    const weight = pick(metrics, /^weight\b|body weight|\bweight\b/i);
    const bodyFat = pick(metrics, /body_fat_percent|body\s*fat\s*(%|percent|percentage)|pbf/i);
    const leanMass = pick(metrics, /lean_body_mass|lean body mass|fat[_\s-]*free mass|\bffm\b|\blbm\b/i);
    return normalizeScan({ id: `legacy-${r.id}`, date: r.extracted?.testDate || r.date, weight, bodyFat, leanMass, storagePath: r.storagePath || "", fileName: r.fileName || "", legacy: true });
  }).filter((s) => s.date && (s.weight != null || s.bodyFat != null || s.leanMass != null));
}

// All scans, newest first. Manual scans win over a legacy report on the same date.
export function scansFor(client) {
  const manual = (client.bodyComposition || []).map(normalizeScan);
  const dates = new Set(manual.map((s) => s.date));
  const legacy = legacyScans(client.bodyAnalysis || []).filter((s) => !dates.has(s.date));
  return [...manual, ...legacy].filter((s) => /^\d{4}-\d{2}-\d{2}/.test(String(s.date))).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// Latest value of one metric and its change from the scan before that had it.
export function latestWithChange(scans, key) {
  const has = scans.filter((s) => s[key] != null);
  if (!has.length) return null;
  const [now, prev] = has;
  return { value: now[key], date: now.date, change: prev ? round1(now[key] - prev[key]) : null, prevDate: prev?.date || null };
}

export async function saveScans(client, manualScans, updateClient) {
  const scans = manualScans.map(normalizeScan).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  updateClient({ ...client, bodyComposition: scans });
  return upsertSection(client.id, "body_composition", { scans });
}
