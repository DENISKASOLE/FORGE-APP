import { describe, it, expect } from "vitest";

// Not wired into live routing yet - see CoachPlanBuilderV2.test.js's
// comment for why this needs its own module-load check rather than
// relying on `vite build` to have touched it.
describe("NutritionV2Flow module", () => {
  it("imports and transforms cleanly", async () => {
    const mod = await import("./NutritionV2Flow.jsx");
    expect(typeof mod.NutritionV2Flow).toBe("function");
  });
});
