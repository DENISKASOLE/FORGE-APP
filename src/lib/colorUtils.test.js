import { describe, it, expect } from "vitest";
import { inkOn } from "./colorUtils.js";
import { CLIENT_COLORS } from "./constants.js";

describe("inkOn", () => {
  it("white on deep teal, dark ink on gold", () => {
    expect(inkOn("#0E5E5A")).toBe("#FFFFFF");
    expect(inkOn("#F6C76B")).toBe("#152321");
  });
  it("falls back to the accent ink for CSS variables", () => {
    expect(inkOn("var(--accent)")).toBe("var(--btn-ink)");
  });
  it("every client colour gets at least 3:1 contrast with its ink", () => {
    const lum = (hex) => { const h = hex.slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0); };
    CLIENT_COLORS.forEach((c) => {
      const a = lum(c), b = lum(inkOn(c));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  });
  it("no purple in the client palette", () => {
    CLIENT_COLORS.forEach((c) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      expect(b > r && b > g && r > g).toBe(false);
    });
  });
});
