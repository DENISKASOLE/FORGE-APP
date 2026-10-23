import { describe, it, expect } from "vitest";

describe("NutritionRing module", () => {
  it("imports and transforms cleanly", async () => {
    const mod = await import("./NutritionRing.jsx");
    expect(typeof mod.Ring).toBe("function");
    expect(typeof mod.MacroBarRow).toBe("function");
  });
});
