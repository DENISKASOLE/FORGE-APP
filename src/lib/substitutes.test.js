import { describe, it, expect } from "vitest";
import { substitutesFor, swapOptions } from "./substitutes.js";

const lib = [
  { name: "BACK SQUAT", substitutes: ["LEG PRESS", "V-SQUAT MACHINE", "BACK SQUAT"] },
  { name: "LEG PRESS" }, { name: "V-SQUAT MACHINE" }, { name: "LAT PULLDOWN" },
];
describe("substitutes", () => {
  it("client sees only library swaps, never the exercise itself", () => {
    expect(swapOptions({ originalName: "back squat", library: lib, isCoach: false }).options).toEqual(["LEG PRESS", "V-SQUAT MACHINE"]);
  });
  it("program list overrides the library for that client", () => {
    expect(substitutesFor("BACK SQUAT", lib, ["LAT PULLDOWN"])).toEqual(["LAT PULLDOWN"]);
    expect(substitutesFor("BACK SQUAT", lib, [])).toEqual(["LEG PRESS", "V-SQUAT MACHINE"]);
  });
  it("client gets nothing when no swaps are set", () => {
    expect(swapOptions({ originalName: "LAT PULLDOWN", library: lib, isCoach: false }).total).toBe(0);
  });
  it("coach can search everything and type anything", () => {
    const r = swapOptions({ originalName: "BACK SQUAT", library: lib, isCoach: true, query: "pull" });
    expect(r.options).toEqual(["LAT PULLDOWN"]);
    expect(swapOptions({ originalName: "BACK SQUAT", library: lib, isCoach: true, query: "hack squat" }).allowTyped).toBe(true);
  });
});
