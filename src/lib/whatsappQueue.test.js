import { describe, it, expect } from "vitest";
import { buildQueue, slotMinutes, waNumber, fillTemplate, pruneDone } from "./whatsappQueue.js";

// Thu 26 Nov 2026
const at = (h, m = 0) => new Date(2026, 10, 26, h, m);
const sara = { id: "s", name: "Sara Ali", phone: "050 123 4567", schedule: [{ day: "Thu", time: "7:00 PM" }, { day: "Fri", time: "7:00 AM" }] };

describe("whatsapp queue", () => {
  it("parses slots and UAE numbers", () => {
    expect(slotMinutes("7:00 PM")).toBe(19 * 60);
    expect(slotMinutes("12:30 AM")).toBe(30);
    expect(waNumber("050 123 4567")).toBe("971501234567");
    expect(waNumber("+971 50 123 4567")).toBe("971501234567");
    expect(waNumber("")).toBe("");
    expect(fillTemplate("Hi {name} at {time}", { name: "Sara" })).toBe("Hi Sara at {time}");
  });
  it("morning: today's session reminder", () => {
    const q = buildQueue([sara], {}, {}, at(9));
    expect(q.map((i) => i.kind)).toEqual(["session_today"]);
    expect(q[0].text).toContain("Sara");
    expect(q[0].text).toContain("7:00 PM");
  });
  it("evening: tomorrow reminder and follow-up an hour after", () => {
    const q = buildQueue([sara], {}, {}, at(20, 30));
    expect(q.map((i) => i.kind)).toEqual(["session_tomorrow", "followup"]);
    expect(q[0].text).toContain("7:00 AM");
  });
  it("sent/skipped, disabled kinds and opted-out clients drop out", () => {
    const first = buildQueue([sara], {}, {}, at(9))[0];
    expect(buildQueue([sara], {}, { [first.key]: { at: at(9).toISOString(), how: "sent" } }, at(9))).toHaveLength(0);
    expect(buildQueue([sara], { enabled: { session_today: false } }, {}, at(9))).toHaveLength(0);
    expect(buildQueue([sara], { optOut: ["s"] }, {}, at(9))).toHaveLength(0);
  });
  it("payment due in 2 days", () => {
    const q = buildQueue([{ id: "p", name: "Ali", phone: "0501112222", paymentDueDate: "2026-11-28", paymentPaid: false }], {}, {}, at(10));
    expect(q[0].kind).toBe("payment");
  });
  it("food nudge after 2pm when on a plan with nothing logged", () => {
    const c = { id: "f", name: "Raj", phone: "0501112222", nutritionV2Plans: [{ status: "published", from: "2026-11-01" }], nutritionV2Logs: {} };
    expect(buildQueue([c], {}, {}, at(13)).map((i) => i.kind)).toEqual([]);
    expect(buildQueue([c], {}, {}, at(15)).map((i) => i.kind)).toEqual(["food"]);
  });
  it("prunes old done entries", () => {
    expect(Object.keys(pruneDone({ a: { at: "2026-10-01T00:00:00Z" }, b: { at: at(9).toISOString() } }, at(10)))).toEqual(["b"]);
  });
});
