import { describe, it, expect } from "vitest";

describe("FatSecretSearch module", () => {
  it("imports and transforms cleanly", async () => {
    const mod = await import("./FatSecretSearch.jsx");
    expect(typeof mod.FatSecretResultRow).toBe("function");
    expect(typeof mod.FatSecretGroupLabel).toBe("function");
    expect(typeof mod.FatSecretServingSheet).toBe("function");
  });
});
