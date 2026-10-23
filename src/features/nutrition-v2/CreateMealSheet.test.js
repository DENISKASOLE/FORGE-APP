import { describe, it, expect } from "vitest";

describe("CreateMealSheet module", () => {
  it("imports and transforms cleanly", async () => {
    const mod = await import("./CreateMealSheet.jsx");
    expect(typeof mod.CreateMealSheet).toBe("function");
  });
});
