import { describe, it, expect } from "vitest";
import {
  dateWindowFor, comparisonWindowFor, rollingMean, measurementContext, sessionWindowFor,
  weeklyVolumeFor, strengthProgressionFor, categoryVolumeFor, nutritionSummaryFor, checkinsFor,
  pageAvailabilityFor, sectionsChecklistFor, buildReportModel, suggestWins, suggestChallenge, datesInRange,
} from "./progressReportMath.js";
import { newProgram, newWorkout, newBlock, newExercise } from "../../lib/programModel.js";
import { startSession, upsertSessionInLogs, emptyTrainingLogs } from "../../lib/trainingLogs.js";

const TODAY = "2026-10-14";

describe("dateWindowFor", () => {
  it("resolves fixed periods relative to today", () => {
    expect(dateWindowFor("7d", "", "", TODAY)).toEqual({ a: "2026-10-08", b: TODAY, err: null });
    expect(dateWindowFor("4w", "", "", TODAY)).toEqual({ a: "2026-09-17", b: TODAY, err: null });
  });
  it("validates a custom range and falls back to the last 4 weeks on error", () => {
    expect(dateWindowFor("custom", "", "2026-10-14", TODAY).err).toMatch(/both dates/);
    expect(dateWindowFor("custom", "2026-10-14", "2026-10-01", TODAY).err).toMatch(/before the end/);
    expect(dateWindowFor("custom", "2026-10-01", "2026-10-20", TODAY).err).toMatch(/future/);
    expect(dateWindowFor("custom", "2026-10-10", "2026-10-12", TODAY).err).toMatch(/at least 7 days/);
    expect(dateWindowFor("custom", "2026-01-01", "2026-10-14", TODAY).err).toMatch(/26 weeks/);
  });
  it("accepts a valid custom range", () => {
    expect(dateWindowFor("custom", "2026-09-01", "2026-09-30", TODAY)).toEqual({ a: "2026-09-01", b: "2026-09-30", err: null });
  });
});

describe("comparisonWindowFor", () => {
  const window = { a: "2026-09-17", b: "2026-10-14" };
  it("returns a 'none' reason when switched off", () => {
    expect(comparisonWindowFor("none", window, "2026-01-01").window).toBeNull();
  });
  it("computes an equal-length previous window", () => {
    const { window: cw } = comparisonWindowFor("prev", window, "2026-01-01");
    expect(cw).toEqual({ a: "2026-08-20", b: "2026-09-16" });
  });
  it("computes a baseline window from tracking start", () => {
    const { window: cw } = comparisonWindowFor("base", window, "2026-06-01");
    expect(cw.a).toBe("2026-06-01");
  });
  it("refuses a baseline window that predates tracking start", () => {
    const { window: cw, reason } = comparisonWindowFor("prev", window, "2026-10-01");
    expect(cw).toBeNull();
    expect(reason).toMatch(/tracking for this client began/);
  });
});

describe("rollingMean", () => {
  it("only emits a point once enough values exist in the trailing window", () => {
    const days = datesInRange("2026-10-01", "2026-10-10");
    const series = [{ date: "2026-10-01", value: 70 }, { date: "2026-10-02", value: 70 }, { date: "2026-10-03", value: 70 }];
    expect(rollingMean(series, days, 7, 4)).toEqual([]);
    const fuller = [...series, { date: "2026-10-04", value: 70 }];
    expect(rollingMean(fuller, days, 7, 4).length).toBeGreaterThan(0);
  });
});

describe("measurementContext", () => {
  const history = [
    { id: "1", date: "2026-06-01", waist: 80 },
    { id: "2", date: "2026-08-01", waist: 78 },
    { id: "3", date: "2026-10-10", waist: 76 },
  ];
  it("splits into base, prev, latest and in-range correctly", () => {
    const ctx = measurementContext(history, "2026-10-01", "2026-10-14");
    expect(ctx.base.date).toBe("2026-06-01");
    expect(ctx.prev.date).toBe("2026-08-01");
    expect(ctx.latest.date).toBe("2026-10-10");
    expect(ctx.inRange).toHaveLength(1);
  });
  it("handles no history without crashing", () => {
    const ctx = measurementContext([], "2026-10-01", "2026-10-14");
    expect(ctx.base).toBeNull();
    expect(ctx.prev).toBeNull();
    expect(ctx.latest).toBeNull();
  });
});

function fakeProgramAndLogs() {
  const program = newProgram("Test", "General", 2);
  const workout = newWorkout("Upper A");
  const block = newBlock("straight");
  const exercise = newExercise("Barbell Bench Press");
  exercise.sets = [{ id: "s1", targetReps: "5", targetLoad: "60", targetRpe: "" }];
  block.exercises = [exercise];
  workout.blocks = [block];
  workout.dayOfWeek = 1; // Monday
  program.weeks[0].workouts = [workout];
  program.weeks[1].workouts = [workout]; // same Monday slot in week 2, logged separately below
  program.startDate = "2026-09-28"; // a Monday
  let logs = emptyTrainingLogs();
  const session = startSession(program, program.weeks[0], workout);
  session.status = "completed";
  session.date = "2026-09-28";
  session.entries[0].sets[0] = { setId: "s1", reps: "5", load: "60", duration: "", rpe: "", done: true };
  logs = upsertSessionInLogs(logs, session);
  return { program, logs };
}

describe("sessionWindowFor", () => {
  it("counts planned, completed and missed sessions in a date range", () => {
    const { program, logs } = fakeProgramAndLogs();
    const win = sessionWindowFor(program, logs, "2026-09-28", "2026-10-11");
    expect(win.planned).toBe(2); // two Mondays across 2 program weeks
    expect(win.completedCount).toBe(1);
    expect(win.missed).toBe(1);
    expect(win.sessions).toHaveLength(1);
  });
});

describe("weeklyVolumeFor", () => {
  it("buckets session volume into 7-day weeks", () => {
    const { logs } = fakeProgramAndLogs();
    const sessions = [{ date: "2026-09-28", session: logs.sessions[0] }];
    const weeks = weeklyVolumeFor(sessions, "2026-09-28", "2026-10-04");
    expect(weeks).toHaveLength(1);
    expect(weeks[0].volume).toBe(300); // 60kg x 5 reps
  });
});

describe("strengthProgressionFor", () => {
  it("returns hasData:false with fewer than 2 logged instances", () => {
    const { logs } = fakeProgramAndLogs();
    const [row] = strengthProgressionFor(logs, ["Barbell Bench Press"], "2026-09-28", "2026-10-11");
    expect(row.hasData).toBe(false);
  });
  it("computes a change and an estimated 1RM at each end with 2+ instances", () => {
    const { logs } = fakeProgramAndLogs();
    const second = { ...logs.sessions[0], id: "s2", date: "2026-10-05", entries: [{ ...logs.sessions[0].entries[0], sets: [{ setId: "s1", reps: "5", load: "65", duration: "", rpe: "", done: true }] }] };
    logs.sessions.push(second);
    const [row] = strengthProgressionFor(logs, ["Barbell Bench Press"], "2026-09-28", "2026-10-11");
    expect(row.hasData).toBe(true);
    expect(row.change).toBe(5);
    expect(row.e1rmLast).toBeGreaterThan(row.e1rmFirst);
  });
});

describe("categoryVolumeFor", () => {
  it("buckets volume by movement-pattern category", () => {
    const { logs } = fakeProgramAndLogs();
    const totals = categoryVolumeFor([{ session: logs.sessions[0] }]);
    expect(totals.Push).toBe(300); // Barbell Bench Press -> Horizontal push -> Push
  });
});

describe("nutritionSummaryFor", () => {
  it("a client with no nutrition data at all doesn't crash and reports zero logged days", () => {
    const client = { nutritionV2Plans: [], nutritionV2Logs: {}, nutritionV2Marks: {}, nutrition: {} };
    const summary = nutritionSummaryFor(client, "2026-10-01", "2026-10-07", TODAY);
    expect(summary.loggedCount).toBe(0);
    expect(summary.adherence).toBeNull();
  });
});

describe("checkinsFor", () => {
  it("matches scale answers by question label keyword, ignoring choice answers", () => {
    const checkIns = [
      { date: "2026-10-05", answers: [{ question: "Energy this week", answer: "Steady" }, { question: "Rate your energy 1-10", answer: "7" }] },
      { date: "2026-10-12", answers: [{ question: "Stress level (1-10)", answer: "3" }] },
    ];
    const { hasCheck, checks } = checkinsFor(checkIns, "2026-10-01", "2026-10-14");
    expect(hasCheck).toBe(true);
    expect(checks[0].energy).toBe(7);
    expect(checks[1].stress).toBe(3);
  });
  it("gracefully reports hasCheck:false with no matching scale questions", () => {
    const checkIns = [{ date: "2026-10-05", answers: [{ question: "How was your sleep?", answer: "Good" }] }];
    expect(checkinsFor(checkIns, "2026-10-01", "2026-10-14").hasCheck).toBe(false);
  });
});

describe("pageAvailabilityFor / sectionsChecklistFor", () => {
  it("summary and review are always available/included; others gate on data", () => {
    const avail = pageAvailabilityFor({ hasWeight: false, hasMeasurements: false, hasPlannedSessions: false, hasNutritionLogs: false, hasHeart: false, hasRecovery: false });
    expect(avail.summary).toBe(true);
    expect(avail.review).toBe(true);
    expect(avail.body).toBe(false);
    const sections = sectionsChecklistFor(avail, {});
    const summary = sections.find((s) => s.key === "summary");
    expect(summary.included).toBe(true);
    const body = sections.find((s) => s.key === "body");
    expect(body.included).toBe(false);
  });
  it("a coach can turn off an available section", () => {
    const avail = pageAvailabilityFor({ hasWeight: true, hasMeasurements: false, hasPlannedSessions: false, hasNutritionLogs: false, hasHeart: false, hasRecovery: false });
    const sections = sectionsChecklistFor(avail, { body: true });
    expect(sections.find((s) => s.key === "body").included).toBe(false);
  });
});

describe("buildReportModel", () => {
  it("a client with no data at all doesn't crash and only includes always-on sections", () => {
    const client = { id: "c1", name: "Test Client", joinDate: "2026-06-01", checkIns: [], measurementsHistory: [], program: null, trainingLogs: emptyTrainingLogs(), nutrition: {}, nutritionV2Plans: [], nutritionV2Logs: {}, nutritionV2Marks: {} };
    const model = buildReportModel(client, "Coach", { period: "4w", todayISO: TODAY });
    expect(model.includedSections).toEqual(["summary", "review"]);
    expect(model.training.planned).toBe(0);
    expect(model.wins).toEqual([]);
    expect(typeof model.challenge).toBe("string");
  });
  it("a fully populated client includes the training/nutrition sections", () => {
    const { program, logs } = fakeProgramAndLogs();
    const client = {
      id: "c2", name: "Full Client", joinDate: "2026-06-01", checkIns: [], measurementsHistory: [], program, trainingLogs: logs,
      nutrition: {}, nutritionV2Plans: [], nutritionV2Logs: { "2026-09-28": [{ id: "e1", date: "2026-09-28", meal: "breakfast", macros: { kcal: 400, protein: 30, carbs: 10, fat: 20 }, source: "quick" }] }, nutritionV2Marks: {},
    };
    const model = buildReportModel(client, "Coach", { period: "custom", customA: "2026-09-28", customB: "2026-10-11", todayISO: TODAY });
    expect(model.includedSections).toContain("training");
    expect(model.includedSections).toContain("nutrition");
  });
});

describe("suggestWins / suggestChallenge", () => {
  it("suggests a logging-consistency win when few other signals exist", () => {
    const model = {
      training: { planned: 0, completedCount: 0, completionRate: 0, progression: [] },
      nutrition: { totalDays: 10, loggedCount: 9 },
      body: { measurements: { latest: null, prev: null } },
    };
    expect(suggestWins(model)[0].source).toBe("Logging consistency");
  });
  it("flags unreliable nutrition averages as the challenge when logging is sparse", () => {
    const model = { nutrition: { totalDays: 10, loggedCount: 2 } };
    expect(suggestChallenge(model)).toMatch(/too few/);
  });
});
