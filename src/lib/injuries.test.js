import { it, expect } from "vitest";
import { injuriesText } from "./injuries.js";
it("handles text, lists and junk", () => {
  expect(injuriesText(" knee ")).toBe("knee");
  expect(injuriesText(["knee", "", { name: "shoulder" }])).toBe("knee, shoulder");
  expect(injuriesText(null)).toBe("");
  expect(injuriesText(3)).toBe("3");
});
