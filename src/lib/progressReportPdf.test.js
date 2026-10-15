import { describe, it, expect } from "vitest";
import { buildProgressReportPDF } from "./progressReportPdf.js";
import { buildReportModel } from "../features/progress-report/progressReportMath.js";
import { emptyReportNotes } from "./progressReports.js";
import { emptyTrainingLogs } from "./trainingLogs.js";

function minimalClient() {
  return {
    id: "c1", name: "Ahmed", joinDate: "2026-06-01", checkIns: [], measurementsHistory: [],
    program: null, trainingLogs: emptyTrainingLogs(), nutrition: {},
    nutritionV2Plans: [], nutritionV2Logs: {}, nutritionV2Marks: {},
  };
}

describe("buildProgressReportPDF", () => {
  it("doesn't throw on text pdf-lib's WinAnsi font can't encode (arrows, multiplication signs, smart quotes)", async () => {
    const model = buildReportModel(minimalClient(), "Coach", { period: "4w", todayISO: "2026-10-14" });
    const notes = {
      ...emptyReportNotes(),
      summary: "Great block — protein is “the” gap.",
      wins: ["DB lateral raise: 8kg × 12 → 10kg × 12 at the same rep target.", null, null],
      challenge: "Logging consistency → needs work.",
    };
    await expect(buildProgressReportPDF(model, notes)).resolves.toBeInstanceOf(Blob);
  });
});
