// Storage for the Progress Report feature (DECISIONS.md). Three new
// client-owned sections: dated measurement history, a per-client coach-
// notes draft, and a list of previously exported reports. Trainer-owned
// data (clients list, program, training logs, nutrition) is all reused
// as-is from its existing lib files - nothing duplicated here.
import { upsertSection } from "./clientData.js";
import { uid } from "./uid.js";

export function normalizeMeasurementHistory(raw) { return Array.isArray(raw) ? raw : []; }
export function newMeasurementEntry(fields, dateISO) { return { id: uid(), date: dateISO, ...fields }; }
export async function saveMeasurementHistory(clientId, entries) {
  return await upsertSection(clientId, "measurements_history", { entries });
}
// Keeps the existing single-snapshot `progress.measurements` field (read
// by ProgressTab.jsx) in sync with the latest dated entry, so the two
// places that already display it on screen need no changes.
export async function saveLatestMeasurementsSnapshot(clientId, existingProgressSection, fields) {
  const next = { ...(existingProgressSection || {}), measurements: { ...(existingProgressSection?.measurements || {}), ...fields } };
  return await upsertSection(clientId, "progress", next);
}

export function emptyReportNotes() {
  return { summary: "", challenge: "", prios: ["", "", ""], wins: [null, null, null], goals: [["", ""], ["", ""], ["", ""]], reflOn: false, refl: "" };
}
export function normalizeReportNotes(raw) { return { ...emptyReportNotes(), ...(raw && typeof raw === "object" ? raw : {}) }; }
export async function saveReportNotes(clientId, notes) { return await upsertSection(clientId, "progress_report_notes", notes); }

export function normalizeReportHistory(raw) { return Array.isArray(raw) ? raw : []; }
export function newReportHistoryEntry({ periodLabel, from, to, filename, storagePath }) {
  return { id: uid(), savedAt: new Date().toISOString(), periodLabel, from, to, filename, storagePath };
}
export async function saveReportHistory(clientId, entries) { return await upsertSection(clientId, "progress_report_history", { entries }); }
