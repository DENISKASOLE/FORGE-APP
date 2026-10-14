import { describe, it, expect } from "vitest";

// Not wired into live routing yet - see CoachPlanBuilderV2.test.js's
// comment for why this needs its own module-load check.
describe("ClientFoodLogTab module", () => {
  it("imports and transforms cleanly", async () => {
    const mod = await import("./ClientFoodLogTab.jsx");
    expect(typeof mod.ClientFoodLogTab).toBe("function");
  });
});
