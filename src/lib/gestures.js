import { useEffect, useRef } from "react";

// iPhone-style "swipe from the left edge to go back" for pushed screens.
// A home-screen web app has no system back gesture, so screens that have
// a Back button also get this. The page follows the finger and either
// finishes the swipe (calls onBack) or springs back.
export function useEdgeSwipeBack(onBack, enabled = true) {
  const ref = useRef(null);
  const cb = useRef(onBack);
  useEffect(() => { cb.current = onBack; });
  useEffect(() => {
    if (!enabled) return undefined;
    let startX = 0, startY = 0, dx = 0, tracking = false, decided = false;
    const el = () => ref.current;
    function start(e) {
      const t = e.touches[0];
      if (t.clientX > 28) return;
      tracking = true; decided = false; startX = t.clientX; startY = t.clientY; dx = 0;
    }
    function move(e) {
      if (!tracking) return;
      const t = e.touches[0];
      dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!decided) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }
        if (dx > 8) decided = true; else return;
      }
      const node = el();
      if (node) { node.style.transition = "none"; node.style.transform = `translateX(${Math.max(0, dx)}px)`; }
    }
    function end() {
      if (!tracking) return;
      tracking = false;
      const node = el();
      const go = dx > Math.min(120, window.innerWidth * 0.3);
      if (node) {
        node.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1)";
        node.style.transform = go ? `translateX(${window.innerWidth}px)` : "translateX(0)";
      }
      if (go) setTimeout(() => { if (node) { node.style.transition = ""; node.style.transform = ""; } cb.current?.(); }, 180);
      else setTimeout(() => { if (node) { node.style.transition = ""; node.style.transform = ""; } }, 240);
    }
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, [enabled]);
  return ref;
}

// Each bottom-tab keeps its own scroll position (like native tab bars);
// screens that aren't tabs open at the top.
export function useTabScrollMemory(tab, tabKeys) {
  const positions = useRef({});
  const current = useRef(tab);
  const last = useRef(0);
  useEffect(() => {
    const onScroll = () => { last.current = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (current.current === tab) return;
    if (tabKeys.includes(current.current)) positions.current[current.current] = last.current;
    current.current = tab;
    const y = tabKeys.includes(tab) ? positions.current[tab] || 0 : 0;
    window.scrollTo(0, y);
    last.current = y;
  }, [tab, tabKeys]);
}
