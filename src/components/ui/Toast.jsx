import { useEffect, useState } from "react";
import { BRAND } from "../../theme/tokens.js";

// Minimal event-bus toast system: call showToast() from anywhere (no hooks,
// no context/provider wiring through the tree) and mount <ToastHost /> once
// near the app root to render whatever's currently showing.
let listeners = [];
export function showToast(message, type = "info") {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  listeners.forEach((fn) => fn({ id, message, type }));
  return id;
}

const TYPE_COLOR = { success: BRAND.green, error: BRAND.red, warn: BRAND.orange, info: BRAND.gold };
const TYPE_ICON = { success: "✓", error: "✕", warn: "!", info: "ℹ" };

export function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    function onToast(t) {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4200);
    }
    listeners.push(onToast);
    return () => { listeners = listeners.filter((f) => f !== onToast); };
  }, []);
  function dismiss(id) { setToasts((prev) => prev.filter((t) => t.id !== id)); }
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: "fixed", top: "max(14px, env(safe-area-inset-top))", left: 0, right: 0, zIndex: 2000, display: "grid", justifyItems: "center", gap: 8, padding: "0 14px", pointerEvents: "none" }}>
      {toasts.map((t) => {
        const color = TYPE_COLOR[t.type] || TYPE_COLOR.info;
        return (
          <div key={t.id} onClick={() => dismiss(t.id)} style={{ pointerEvents: "auto", cursor: "pointer", width: "100%", maxWidth: 420, background: BRAND.card, border: `1px solid ${BRAND.line}`, borderLeft: `3px solid ${color}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 12px 32px rgba(0,0,0,.55)", animation: "forge-toast-in .18s ease-out" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${color}22`, color, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 1000, flexShrink: 0 }}>{TYPE_ICON[t.type] || TYPE_ICON.info}</div>
            <div style={{ color: BRAND.text, fontSize: 13, fontWeight: 700, lineHeight: 1.35, minWidth: 0 }}>{t.message}</div>
          </div>
        );
      })}
      <style>{"@keyframes forge-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }"}</style>
    </div>
  );
}
