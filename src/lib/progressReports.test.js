import { describe, it, expect } from "vitest";
import { normalizeMeasurementHistory, newMeasurementEntry, emptyReportNotes, normalizeReportNotes, normalizeReportHistory, newReportHistoryEntry } from "./progressReports.js";

describe("progressReports normalizers", () => {
  it("normalizeMeasurementHistory defaults to an empty array", () => {
    expect(normalizeMeasurementHistory(undefined)).toEqual([]);
    expect(normalizeMeasurementHistory(null)).toEqual([]);
    expect(normalizeMeasurementHistory([{ id: "a" }])).toEqual([{ id: "a" }]);
  });
  it("newMeasurementEntry stamps an id and the given date", () => {
    const entry = newMeasurementEntry({ waist: 80 }, "2026-10-14");
    expect(entry.date).toBe("2026-10-14");
    expect(entry.waist).toBe(80);
    expect(typeof entry.id).toBe("string");
    expect(entry.id.length).toBeGreaterThan(0);
  });
  it("normalizeReportNotes fills in missing fields from the empty default", () => {
    const notes = normalizeReportNotes({ summary: "Good block" });
    expect(notes.summary).toBe("Good block");
    expect(notes.prios).toEqual(emptyReportNotes().prios);
    expect(notes.goals).toEqual(emptyReportNotes().goals);
  });
  it("normalizeReportHistory defaults to an empty array", () => {
    expect(normalizeReportHistory(undefined)).toEqual([]);
  });
  it("newReportHistoryEntry stamps an id and savedAt timestamp", () => {
    const entry = newReportHistoryEntry({ periodLabel: "Sep 16 - Oct 14, 2026", from: "2026-09-16", to: "2026-10-14", filename: "x.pdf", storagePath: "clients/1/progress-reports/x.pdf" });
    expect(entry.filename).toBe("x.pdf");
    expect(typeof entry.savedAt).toBe("string");
    expect(typeof entry.id).toBe("string");
  });
});
