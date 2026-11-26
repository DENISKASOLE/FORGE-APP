import { it, expect, vi } from "vitest";
import { visibleClients, makeSecretTap, setPrivateUnlocked, isPrivateUnlocked } from "./privateMode.js";
it("hides online clients unless unlocked", () => {
  const cs = [{ id: 1, clientType: "1:1" }, { id: 2, clientType: "Online" }, { id: 3 }];
  expect(visibleClients(cs, false).map((c) => c.id)).toEqual([1, 3]);
  expect(visibleClients(cs, true)).toHaveLength(3);
});
it("5 quick taps toggle, slow taps don't", () => {
  vi.useFakeTimers();
  const fn = vi.fn(); const tap = makeSecretTap(fn);
  for (let i = 0; i < 4; i++) tap();
  expect(fn).not.toHaveBeenCalled();
  tap(); expect(fn).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 5; i++) { tap(); vi.advanceTimersByTime(1000); }
  expect(fn).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
  setPrivateUnlocked(true); expect(isPrivateUnlocked()).toBe(true); setPrivateUnlocked(false);
});
