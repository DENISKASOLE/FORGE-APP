import { describe, it, expect } from "vitest";

// Not wired into live routing yet (deliberately - see
// mellow-wandering-grove.md's plan), so it never enters the `vite build`
// or `vite dev` module graph and a clean production build proves nothing
// about it. This forces Vitest to actually transform and execute the
// module (imports, top-level code) the same way the lesson from
// DECISIONS.md's build-exit-code incident calls for - catches a broken
// import or reference error a plain lint pass can miss.
describe("CoachPlanBuilderV2 module", () => {
  it("imports and transforms cleanly", async () => {
    const mod = await import("./CoachPlanBuilderV2.jsx");
    expect(typeof mod.CoachPlanBuilderV2).toBe("function");
  });
});
