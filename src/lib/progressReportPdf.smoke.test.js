import { describe, it, expect } from "vitest";

describe("progressReportPdf module load", () => {
  it("loads without throwing and exports buildProgressReportPDF", async () => {
    const mod = await import("./progressReportPdf.js");
    expect(typeof mod.buildProgressReportPDF).toBe("function");
  });
});
