import { describe, it, expect } from "vitest";
import { buildCheckinEntry, upsertCheckin, thisWeeksCheckin, emptyCheckinForm, formFromEntry, checkinFlags, sessionsThisWeek, previousWeight, trendSeries } from "./checkinV2.js";
import { weightHistoryFromCheckins } from "./clientMetrics.js";

const thu = new Date("2026-11-19T10:00:00");
const form = { ...emptyCheckinForm(), weight: "78.6", energy: 4, sleep: 2, stress: 2, hunger: 2, trainingFeel: "Just right", adherence: "75–90%", pain: "No", win: "Squat PB", overall: 8 };

describe("checkinV2", () => {
  it("builds an entry readable by the old weight trend", () => {
    const e = buildCheckinEntry(form, { id: "a", sessions: { done: 3, planned: 4 }, today: thu });
    expect(e.week).toBe("2026-11-16");
    expect(e.values.weight).toBe(78.6);
    expect(e.answers.find((a) => a.question === "Sessions logged this week").answer).toBe("3 of 4");
    expect(weightHistoryFromCheckins([e])).toEqual([{ date: "2026-11-19", value: 78.6 }]);
  });
  it("replaces the same week's check-in instead of adding one", () => {
    const a = buildCheckinEntry(form, { id: "a", today: thu });
    const b = buildCheckinEntry({ ...form, weight: "78.2" }, { id: "a", today: new Date("2026-11-22T09:00:00") });
    const list = upsertCheckin(upsertCheckin([{ id: "old", date: "2026-11-08", answers: [] }], a), b);
    expect(list).toHaveLength(2);
    expect(list[1].values.weight).toBe(78.2);
    expect(thisWeeksCheckin(list, thu).id).toBe("a");
    expect(thisWeeksCheckin(list, new Date("2026-11-24T09:00:00"))).toBeNull();
  });
  it("round-trips a form for editing", () => {
    const e = buildCheckinEntry(form, { id: "a", today: thu });
    expect(formFromEntry(e)).toMatchObject({ weight: "78.6", energy: 4, adherence: "75–90%", win: "Squat PB" });
  });
  it("flags what the coach should see", () => {
    const f = checkinFlags({ ...form, energy: 1, stress: 5, pain: "Yes", painNote: "left knee", overall: 3 });
    expect(f.map((x) => x.q)).toEqual(["Energy", "Sleep quality", "Stress", "Pain or injury", "Overall week"]);
  });
  it("counts this week's completed sessions", () => {
    const client = {
      program: { weeks: [{ id: "w1", workouts: [{}, {}, {}, {}] }] },
      trainingLogs: { sessions: [
        { status: "completed", date: "2026-11-16", weekId: "w1" },
        { status: "completed", date: "2026-11-18", weekId: "w1" },
        { status: "in_progress", date: "2026-11-19", weekId: "w1" },
        { status: "completed", date: "2026-11-12", weekId: "w1" },
      ] },
    };
    expect(sessionsThisWeek(client, thu)).toEqual({ done: 2, planned: 4 });
  });
  it("finds last week's weight, ignoring this week", () => {
    const client = { checkIns: [
      { date: "2026-11-08", answers: [{ question: "What's your current weight? (kg)", answer: "79.6" }] },
      buildCheckinEntry(form, { id: "a", today: thu }),
    ] };
    expect(previousWeight(client, thu)).toBe(79.6);
  });
  it("builds trend bars from new check-ins only", () => {
    const e = buildCheckinEntry(form, { id: "a", today: thu });
    expect(trendSeries([{ date: "2026-11-01", answers: [] }, e], "energy")).toEqual([0.8]);
    expect(trendSeries([e], "adherence")).toEqual([0.82]);
  });
});
