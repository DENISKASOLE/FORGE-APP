import { describe, it, expect, vi } from "vitest";
vi.mock("../../supabaseClient.js", () => ({ supabase: {} }));
import { weekOf, dayNutrition, weightInfo, measurementInfo, bodyFatInfo, proteinStreak, energyInfo } from "./homeData.js";
import { newPlanVersion } from "../nutrition-v2/nutritionV2Model.js";

const plan = () => { const p = newPlanVersion({ from: "2026-01-01", targets: { kcal: 1700, protein: 115, carbs: 205, fat: 47 } }); p.status = "published"; return p; };
const e = (protein, kcal = 0) => ({ meal: "lunch", source: "confirm", macros: { kcal, protein, carbs: 0, fat: 0 } });

describe("homeData", () => {
  it("weekOf gives Mon..Sun around the date", () => {
    const w = weekOf("2026-11-18");
    expect(w.map((d) => d.iso)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  });
  it("dayNutrition sums logs against the plan targets", () => {
    const r = dayNutrition({ nutritionV2Plans: [plan()], nutritionV2Logs: { "2026-11-18": [e(40, 500), e(30, 300)] } }, "2026-11-18");
    expect(r.eaten.kcal).toBe(800); expect(r.eaten.protein).toBe(70); expect(r.target.kcal).toBe(1700);
  });
  it("weightInfo returns latest and change vs a week earlier", () => {
    const c = { checkIns: [], measurementsHistory: [{ date: "2026-11-10", weight: 79 }, { date: "2026-11-18", weight: 78.4 }] };
    expect(weightInfo(c, "2026-11-18")).toEqual({ value: 78.4, date: "2026-11-18", change: -0.6 });
  });
  it("measurementInfo finds latest value and 4-week change", () => {
    const c = { measurementsHistory: [{ date: "2026-10-15", waist: 86 }, { date: "2026-11-15", waist: 84 }] };
    expect(measurementInfo(c, "waist", "2026-11-18")).toEqual({ value: 84, date: "2026-11-15", change: -2 });
    expect(measurementInfo(c, "vo2max", "2026-11-18")).toBe(null);
  });
  it("bodyFatInfo reads the latest scan", () => {
    const c = { bodyAnalysis: [{ date: "2026-10-01", extracted: { metrics: [{ key: "body_fat_percent", value: "19.5" }] } }, { date: "2026-11-02", extracted: { metrics: [{ label: "Body Fat %", value: "18.2" }] } }] };
    expect(bodyFatInfo(c)).toEqual({ value: 18.2, date: "2026-11-02" });
  });
  it("proteinStreak counts consecutive days on target, ignoring an unfinished today", () => {
    const logs = { "2026-11-15": [e(120)], "2026-11-16": [e(116)], "2026-11-17": [e(130)], "2026-11-18": [e(20)] };
    expect(proteinStreak({ nutritionV2Plans: [plan()], nutritionV2Logs: logs }, "2026-11-18")).toBe(3);
  });
  it("energy prefers today's mood, else latest check-in", () => {
    expect(energyInfo({ moodLog: { "2026-11-18": 4 } }, "2026-11-18")).toEqual({ value: 8, source: "Today's mood" });
    expect(energyInfo({ checkIns: [{ date: "2026-11-14", answers: [{ question: "Energy this week", answer: "Steady" }] }] }, "2026-11-18")).toEqual({ value: 5, source: "From check-in" });
  });
});
