import { describe, it, expect } from "vitest";
import { clientNotifications } from "./clientNotifications.js";

const sat = new Date("2026-11-21T09:00:00");
describe("clientNotifications", () => {
  it("shows payment, check-in and missed sessions", () => {
    const program = { startDate: "2026-11-16", weeks: [{ id: "w1", weekNum: 1, workouts: [{ id: "a", name: "Upper A", dayOfWeek: 1 }, { id: "b", name: "Lower A", dayOfWeek: 3 }] }] };
    const trainingLogs = { sessions: [{ weekId: "w1", workoutId: "a", status: "completed", date: "2026-11-16" }] };
    const n = clientNotifications({ id: "c", paymentDueDate: "2026-11-23", paymentPaid: false, checkIns: [], program, trainingLogs }, sat);
    expect(n.map((x) => x.kind)).toEqual(["payment", "checkin", "missed"]);
    expect(n[0].title).toBe("Payment due in 2 days");
    expect(n[2].title).toBe("Missed: Lower A");
  });
  it("is quiet when everything is done", () => {
    const n = clientNotifications({ id: "c", paymentDueDate: "2026-12-20", paymentPaid: false, checkIns: [{ date: "2026-11-21", week: "2026-11-16" }] }, sat);
    expect(n).toEqual([]);
  });
  it("flags overdue payments and skips paid ones", () => {
    expect(clientNotifications({ paymentDueDate: "2026-11-18" }, new Date("2026-11-19T09:00:00"))[0].title).toBe("Payment overdue");
    expect(clientNotifications({ paymentDueDate: "2026-11-18", paymentPaid: true }, new Date("2026-11-19T09:00:00"))).toEqual([]);
  });
});
