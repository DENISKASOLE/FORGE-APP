// Bell in the top-left of the client Home screen. See lib/clientNotifications.js.
import { useMemo, useState } from "react";
import { clientNotifications, readSeen, markSeen } from "../../lib/clientNotifications.js";

const ICON = { payment: "💳", checkin: "📝", missed: "🏋️" };
const TINT = { payment: "var(--gold)", checkin: "var(--accent)", missed: "var(--red)" };

function BellIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function NotificationBell({ client, goTo }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(client.id));
  const items = useMemo(() => clientNotifications(client), [client]);
  const unseen = items.filter((n) => !seen.has(n.id)).length;

  function toggle() {
    if (!open && items.length) { markSeen(client.id, items.map((n) => n.id)); setSeen(readSeen(client.id)); }
    setOpen((o) => !o);
  }
  function go(n) { setOpen(false); goTo(n.target); }

  return (
    <>
      <button type="button" onClick={toggle} aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"}
        style={{ position: "relative", width: 42, height: 42, borderRadius: "50%", border: "1px solid var(--line-strong)", background: "var(--card)", color: "var(--ink)", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
        <BellIcon />
        {unseen > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, background: "var(--red)", color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", border: "2px solid var(--page)" }}>{unseen > 9 ? "9+" : unseen}</span>
        )}
      </button>
      {open && (
        <div onClick={() => setOpen(false)} className="fx-scrim" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.35)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 64px)", left: 12, right: 12, maxWidth: 420, margin: "0 auto", background: "var(--card)", border: "1px solid var(--line-strong)", borderRadius: 22, boxShadow: "0 18px 50px rgba(0,0,0,.25)", overflow: "hidden", fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", color: "var(--ink)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px 10px" }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em" }}>Notifications</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "var(--ink-3)", fontSize: 18, cursor: "pointer", padding: 4 }}>✕</button>
            </div>
            {items.length === 0 && (
              <div style={{ padding: "18px 18px 26px", textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>You're all caught up</div>
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>Missed sessions, check-ins and payments show here.</div>
              </div>
            )}
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {items.map((n) => (
                <button key={n.id} type="button" onClick={() => go(n)} style={{ width: "100%", display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", padding: "12px 18px", background: "none", border: "none", borderTop: "1px solid var(--line)", cursor: "pointer", fontFamily: "inherit", color: "var(--ink)" }}>
                  <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, display: "grid", placeItems: "center", fontSize: 18, background: `color-mix(in srgb, ${TINT[n.kind]} 14%, var(--card))` }}>{ICON[n.kind]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: n.urgent ? TINT[n.kind] === "var(--gold)" ? "var(--red)" : TINT[n.kind] : "var(--ink)" }}>{n.title}</span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.4, marginTop: 2 }}>{n.body}</span>
                  </span>
                  <span style={{ color: "var(--ink-3)", fontSize: 18, alignSelf: "center" }}>›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
