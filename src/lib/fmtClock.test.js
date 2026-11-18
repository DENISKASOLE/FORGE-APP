import { describe, it, expect } from "vitest";
import { fmtClock } from "./trainingLogs.js";
describe("fmtClock", () => {
  it("minutes:seconds under an hour", () => { expect(fmtClock(0)).toBe("0:00"); expect(fmtClock(754)).toBe("12:34"); });
  it("hours:minutes:seconds from an hour", () => { expect(fmtClock(3600)).toBe("1:00:00"); expect(fmtClock(5025)).toBe("1:23:45"); });
});
