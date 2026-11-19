import { describe, it, expect } from "vitest";

describe("progress-report UI module load", () => {
  it("ProgressReportBuilder.jsx loads without throwing", async () => {
    const mod = await import("./ProgressReportBuilder.jsx");
    expect(typeof mod.ProgressReportBuilder).toBe("function");
  });
  it("PdfPagePreview.jsx loads without throwing", async () => {
    const mod = await import("./PdfPagePreview.jsx");
    expect(typeof mod.ReportPreview).toBe("function");
  });
});
