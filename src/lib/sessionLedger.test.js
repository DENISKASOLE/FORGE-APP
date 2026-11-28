import { describe, it, expect } from "vitest";
import { spendSession, undoUse, cancelSession, decideLateCancel, sessionsLeft, upcomingSessions, pendingLateCancels, monthMarks, scheduledOn, activePackage } from "./sessionLedger.js";

const base = () => ({
  id: "c",
  schedule: [{ day: "Mon", time: "6:00 PM" }, { day: "Thu", time: "6:00 PM" }],
  packages: [{ id: "p2", name: "New", total: 10, used: 0 }, { id: "p1", name: "Old", total: 10, used: 10 }],
});

describe("session ledger", () => {
  it("starts from the existing used count and only deducts when the coach uses one", () => {
    const c = { ...base(), packages: [{ id: "p", total: 12, used: 4 }] };
    expect(sessionsLeft(c)).toBe(8);
    const { client } = spendSession(c, { date: "2026-11-30", time: "6:00 PM" });
    expect(sessionsLeft(client)).toBe(7);
    expect(client.sessionLedger.events[0]).toMatchObject({ type: "used", reason: "session", packageId: "p" });
    expect(sessionsLeft(undoUse(client, client.sessionLedger.events[0].id))).toBe(8);
  });
  it("active package is the newest with sessions left", () => {
    expect(activePackage(base()).id).toBe("p2");
  });
  it("client cancel: free outside the window, waits for coach inside it", () => {
    const c = base();
    const early = cancelSession(c, { date: "2026-11-30", time: "6:00 PM", by: "client", now: new Date(2026, 10, 29, 12) });
    expect(early.sessionLedger.events[0]).toMatchObject({ late: false, decision: "free" });
    expect(sessionsLeft(early)).toBe(10);
    const late = cancelSession(c, { date: "2026-11-30", time: "6:00 PM", by: "client", now: new Date(2026, 10, 30, 9) });
    expect(pendingLateCancels(late)).toHaveLength(1);
    expect(sessionsLeft(late)).toBe(10); // nothing deducted automatically
    const used = decideLateCancel(late, late.sessionLedger.events[0].id, "used");
    expect(sessionsLeft(used)).toBe(9);
    expect(pendingLateCancels(used)).toHaveLength(0);
    const waived = decideLateCancel(late, late.sessionLedger.events[0].id, "waived");
    expect(sessionsLeft(waived)).toBe(10);
    // undoing the late-cancel use puts it back to "waiting"
    const usedEv = used.sessionLedger.events.find((e) => e.type === "used");
    expect(pendingLateCancels(undoUse(used, usedEv.id))).toHaveLength(1);
  });
  it("upcoming skips cancelled and past sessions; marks for the calendar", () => {
    const now = new Date(2026, 10, 28, 20); // Sat 28 Nov
    let c = base();
    expect(scheduledOn(c, "2026-11-30")).toEqual([{ date: "2026-11-30", time: "6:00 PM" }]);
    c = cancelSession(c, { date: "2026-11-30", time: "6:00 PM", by: "coach", now });
    const up = upcomingSessions(c, now, 7);
    expect(up.map((s) => s.date)).toEqual(["2026-12-03"]);
    c = spendSession(c, { date: "2026-11-26", time: "6:00 PM", now }).client;
    const m = monthMarks(c, "2026-11", now);
    expect(m["2026-11-26"]).toBe("used");
    expect(m["2026-11-30"]).toBe("cancelled");
  });
});
