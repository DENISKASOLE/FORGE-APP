import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildInsights, niceName, trainingPillar, prioritiesFor } from "./reportInsights.js";
import { buildProgressReportPDF } from "../../lib/progressReportPdf.js";

const base = () => ({
  client: { id: "c1", name: "DENIS" }, trainerName: "Denis", generatedAt: "2026-11-19",
  period: { from: "2026-10-23", to: "2026-11-19", days: 28 },
  training: { planned: 16, completedCount: 4, missed: 7, sessions: [{ date: "2026-10-30" }], weeklyVolume: [{ start: "2026-10-23" }, { start: "2026-10-30" }],
    progression: [{ name: "V-SQUAT QUADS FOCUS", hasData: true, first: { load: 100, reps: 12 }, last: { load: 140, reps: 10 }, change: 40 }],
    pbs: [{ date: "2026-11-10", name: "V-SQUAT QUADS FOCUS", detail: "140kg x 10 reps" }] },
  nutrition: { days: [{ date: "2026-11-10", has: true, totals: { kcal: 1665, protein: 110 }, target: { kcal: 1700, protein: 115 } }], loggedCount: 12, totalDays: 28, kcalWithinTarget: 5 },
  recovery: { sleep: [{ value: 6.5 }, { value: 6 }], steps: [], checkins: { hasCheck: false } },
  body: { weight: [], measurements: { latest: { weight: 79 }, prev: null } },
});

describe("report insights", () => {
  it("counts sessions against those actually due (done + missed)", () => {
    const t = trainingPillar(base().training);
    expect(t.value).toBe("4 of 11");
    expect(t.status.key).toBe("low");
  });
  it("tells the client in plain words, with the coach's override winning", () => {
    const ins = buildInsights(base(), {});
    expect(ins.headline).toMatch(/stronger/);
    expect(ins.wins[0]).toMatchObject({ big: "+40 kg", title: "V-Squat Quads Focus" });
    expect(ins.priorities.map((p) => p.title)).toEqual(["Train 4 times a week, every week", "Log your food every day", "Get 7 or more hours of sleep"]);
    expect(buildInsights(base(), { headline: "Great month" }).headline).toBe("Great month");
    expect(prioritiesFor(base(), { prios: ["Hit 3 sessions", "", ""] })).toEqual([{ title: "Hit 3 sessions", line: "" }]);
  });
  it("cleans up exercise names", () => {
    expect(niceName("DB REVERSE LUNGES")).toBe("DB Reverse Lunges");
    expect(niceName("MACHINE PEC FLY")).toBe("Machine Pec Fly");
  });
  it("builds a two-page PDF", async () => {
    const blob = await buildProgressReportPDF(base(), { summary: "Well done → keep going", prios: ["", "", ""], goals: [] });
    const doc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    expect(doc.getPageCount()).toBe(2);
  });
});
