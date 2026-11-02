import { describe, it, expect } from "vitest";
import { weightHistoryFromCheckins, weightTrend } from "./clientMetrics.js";

function checkin(date, weight) {
  return { date, answers: [{ question: "What's your current weight?", answer: `${weight} kg` }] };
}

describe("weightHistoryFromCheckins", () => {
  it("extracts the weight answer from each check-in and sorts ascending by date", () => {
    const points = weightHistoryFromCheckins([checkin("2026-10-14", 70), checkin("2026-10-01", 71)]);
    expect(points).toEqual([{ date: "2026-10-01", value: 71 }, { date: "2026-10-14", value: 70 }]);
  });
  it("skips check-ins with no weight question or a non-numeric answer", () => {
    const points = weightHistoryFromCheckins([{ date: "2026-10-01", answers: [{ question: "Sleep quality", answer: "Good" }] }, checkin("2026-10-08", 70)]);
    expect(points).toEqual([{ date: "2026-10-08", value: 70 }]);
  });
  it("an empty or missing check-in list produces no points", () => {
    expect(weightHistoryFromCheckins(null)).toEqual([]);
    expect(weightHistoryFromCheckins([])).toEqual([]);
  });
});

describe("weightTrend - the Fuel tab 'My week' weight card", () => {
  it("returns null (hide the card) with fewer than 2 weigh-ins", () => {
    expect(weightTrend([])).toBeNull();
    expect(weightTrend([checkin("2026-10-14", 70)])).toBeNull();
  });
  it("current is the latest weigh-in, change is latest minus the one before it", () => {
    const trend = weightTrend([checkin("2026-10-01", 69.5), checkin("2026-10-08", 69.2), checkin("2026-10-14", 68.4)]);
    expect(trend.current).toBe(68.4);
    expect(trend.change).toBeCloseTo(68.4 - 69.2);
    expect(trend.points).toHaveLength(3);
  });
  it("caps the sparkline at maxPoints, keeping the most recent", () => {
    const checkins = Array.from({ length: 10 }, (_, i) => checkin(`2026-10-${String(i + 1).padStart(2, "0")}`, 70 - i * 0.1));
    const trend = weightTrend(checkins, 4);
    expect(trend.points).toHaveLength(4);
    expect(trend.points[0].date).toBe("2026-10-07");
    expect(trend.points[3].date).toBe("2026-10-10");
  });
});
