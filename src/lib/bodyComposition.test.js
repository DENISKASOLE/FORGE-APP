import { describe, it, expect } from "vitest";
import { scansFor, latestWithChange, leanFrom, normalizeScan } from "./bodyComposition.js";

describe("body composition scans", () => {
  it("works out lean mass from weight and body fat when not entered", () => {
    expect(leanFrom(80, 20)).toBe(64);
    expect(normalizeScan({ date: "2026-11-18", weight: "79,2", bodyFat: "18.4" }).leanMass).toBe(64.6);
    expect(normalizeScan({ date: "2026-11-18", weight: 79, bodyFat: 18, leanMass: 65.1 }).leanMass).toBe(65.1);
  });
  it("merges older AI-read reports, newest first, manual scans winning on the same date", () => {
    const client = {
      bodyComposition: [{ id: "a", date: "2026-11-18", weight: 79, bodyFat: 18, leanMass: 64.8 }],
      bodyAnalysis: [
        { id: "x", date: "2026-10-01", extracted: { metrics: [{ key: "weight", label: "Weight", value: "81.0" }, { key: "body_fat_percent", label: "Body fat %", value: "20.5" }, { key: "lean_body_mass", label: "Lean body mass", value: "64.4" }] } },
        { id: "y", date: "2026-11-18", extracted: { metrics: [{ key: "weight", value: "90" }] } },
      ],
    };
    const scans = scansFor(client);
    expect(scans.map((s) => s.date)).toEqual(["2026-11-18", "2026-10-01"]);
    expect(scans[0].weight).toBe(79);
    expect(latestWithChange(scans, "bodyFat")).toMatchObject({ value: 18, change: -2.5 });
    expect(latestWithChange(scans, "leanMass")).toMatchObject({ value: 64.8, change: 0.4 });
  });
});
