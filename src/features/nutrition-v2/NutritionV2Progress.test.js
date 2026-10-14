import { describe, it, expect } from "vitest";

// Not wired into live routing yet - see CoachPlanBuilderV2.test.js's
// comment for why this needs its own module-load check.
describe("NutritionV2Progress module", () => {
  it("imports and transforms cleanly", async () => {
    const mod = await import("./NutritionV2Progress.jsx");
    expect(typeof mod.NutritionV2Progress).toBe("function");
  });
});
