import { useEffect, useRef, useState } from "react";
import { useSyncStatus, flush } from "../../lib/sync.js";

// Small status pill at the top of the screen - only visible when it matters:
//  offline            "Offline · saved on this phone"
//  slow to upload     "Syncing…"            (after 1.5 s, so normal saves never flash it)
//  server rejected    "Some changes didn't sync · Retry"
//  just caught up     "All synced"          (1.5 s, then hides)
export function SyncPill() {
  const s = useSyncStatus();
  const [show, setShow] = useState(null);
  const wasBehind = useRef(false);
  useEffect(() => {
    let t;
    if (s.offline) {
      wasBehind.current = wasBehind.current || s.pending > 0;
      t = setTimeout(() => setShow("offline"), 0);
    } else if (s.failed > 0) {
      t = setTimeout(() => setShow("failed"), 0);
    } else if (s.pending > 0) {
      t = setTimeout(() => { wasBehind.current = true; setShow("syncing"); }, 1500);
    } else if (wasBehind.current) {
      wasBehind.current = false;
      t = setTimeout(() => setShow("done"), 0);
    } else {
      t = setTimeout(() => setShow(null), 0);
    }
    return () => clearTimeout(t);
  }, [s.offline, s.failed, s.pending]);
  useEffect(() => {
    if (show !== "done") return undefined;
    const t = setTimeout(() => setShow(null), 1600);
    return () => clearTimeout(t);
  }, [show]);
  if (!show) return null;
  const cfg = {
    offline: { dot: "var(--yellow)", text: s.pending ? "Offline · saved on this phone" : "Offline" },
    syncing: { dot: "var(--blue)", text: "Syncing…" },
    failed: { dot: "var(--red)", text: "Some changes didn't sync · Retry" },
    done: { dot: "var(--green)", text: "All synced" },
  }[show];
  return (
    <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top) + 8px)", left: 0, right: 0, zIndex: 1500, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div role="status" aria-live="polite" onClick={show === "failed" ? () => flush() : undefined} className="fx-pop"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999,
          background: "var(--sheet)", border: "1px solid var(--line-strong)", boxShadow: "0 4px 14px rgba(0,0,0,.10)",
          color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
          pointerEvents: show === "failed" ? "auto" : "none", cursor: show === "failed" ? "pointer" : "default" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
        {cfg.text}
      </div>
    </div>
  );
}
