import { describe, it, expect, beforeEach } from "vitest";
import { getStoredTheme } from "./theme.js";
const store = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
});
describe("theme default", () => {
  it("new users get light", () => { expect(getStoredTheme()).toBe("light"); });
  it("existing dark users are moved to light once", () => { store.forge_theme = "dark"; expect(getStoredTheme()).toBe("light"); });
  it("dark chosen after the switch is kept", () => { getStoredTheme(); store.forge_theme = "dark"; expect(getStoredTheme()).toBe("dark"); });
});
