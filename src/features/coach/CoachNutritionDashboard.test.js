import { describe, it, expect } from "vitest";

describe("CoachNutritionDashboard module", () => {
  it("imports and transforms cleanly", async () => {
    const mod = await import("./CoachNutritionDashboard.jsx");
    expect(typeof mod.CoachNutritionDashboard).toBe("function");
  });
});
