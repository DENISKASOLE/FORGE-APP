import { useMemo, useState } from "react";
import { useIsMobile } from "../../lib/browser.js";
import { isoDate } from "../../lib/dateUtils.js";
import { normalizePlans, normalizeLogs, normalizeMarks } from "../../lib/nutritionV2.js";
import { recentAlertSignals, attentionFlagFor, weeklyProgress } from "../nutrition-v2/nutritionV2Math.js";
import { Ring } from "../nutrition-v2/NutritionRing.jsx";
import { NT } from "../nutrition-v2/nutritionV2Theme.js";

const BADGE_COLORS = [[NT.accent, NT.accentBg], [NT.protein, NT.proteinBg], [NT.carbs, NT.carbsBg], [NT.fat, NT.fatBg]];
function badgeColorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % BADGE_COLORS.length;
  return BADGE_COLORS[h];
}
function initials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}
function pillBtnStyle(selected) {
  return { border: `1px solid ${selected ? "transparent" : NT.lineSoft}`, background: selected ? NT.accent : "transparent", color: selected ? NT.bg : NT.muted, fontFamily: NT.sans, fontSize: 11, fontWeight: 600, padding: "9px 14px", borderRadius: 999, cursor: "pointer" };
}

// One client's nutrition health, computed from data already on the
// mapped client object (plans/logs/marks) - no extra fetching. Reuses
// recentAlertSignals (already backing CoachDashboard's notification
// bell) for the "needs attention" reason, and weeklyProgress for the
// 7-day adherence ring shown on an "on track" row.
function nutritionHealthFor(client, today) {
  const plans = normalizePlans(client.nutritionV2Plans);
  const logs = normalizeLogs(client.nutritionV2Logs);
  const marks = normalizeMarks(client.nutritionV2Marks);
  const signals = recentAlertSignals(plans, logs, marks, today);
  const flag = attentionFlagFor(signals);
  const week = weeklyProgress(plans, logs, marks, today, today);
  return { client, flag, loggedCount: week.loggedCount, adherencePct: week.adherencePct };
}

function ClientRow({ health, onClick }) {
  const { client, flag, loggedCount, adherencePct } = health;
  const [color, bg] = badgeColorFor(client.name || "?");
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, background: NT.card, border: `1px solid ${flag ? NT.badBorder : NT.lineSoft}`, borderRadius: 16, padding: "13px 14px", textAlign: "left", cursor: "pointer" }}>
      <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: NT.display, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{initials(client.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: NT.sans, fontSize: 14, fontWeight: 600, color: NT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name}</div>
        <div style={{ fontFamily: NT.sans, fontSize: 11.5, color: flag ? NT.bad : NT.dim, marginTop: 2 }}>{flag || `${loggedCount} of 7 days logged`}</div>
      </div>
      {!flag && (
        <Ring value={adherencePct != null ? Math.round(adherencePct * 100) : 0} max={100} size={34} stroke={4} color={NT.protein}>
          <span style={{ fontFamily: NT.sans, fontSize: 9.5, fontWeight: 700, color: NT.text }}>{adherencePct != null ? `${Math.round(adherencePct * 100)}%` : "—"}</span>
        </Ring>
      )}
      {flag && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: NT.faint }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

// Coach-facing triage across every client's nutrition at once
// (DECISIONS.md "Nutrition redesign v2") - today a coach has to open
// each client individually to know who needs them; this surfaces who,
// and why, up front. Reached from the coach Tools grid
// (CoachDashboard.jsx's "nutrition_dashboard" tile/screen).
export function CoachNutritionDashboard({ clients, selectClient, onBack }) {
  const isDesktop = !useIsMobile(1180);
  const [filter, setFilter] = useState("all");
  const today = isoDate();

  const health = useMemo(() => clients.map((c) => nutritionHealthFor(c, today)), [clients, today]);
  const attention = health.filter((h) => h.flag);
  const onTrack = health.filter((h) => !h.flag);
  const filters = [["all", "All clients"], ["attention", "Needs attention"], ["track", "On track"]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: NT.muted, fontFamily: NT.sans, fontSize: 12.5, fontWeight: 500, cursor: "pointer", padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Tools
        </button>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontFamily: NT.display, fontSize: 24, fontWeight: 560, color: NT.text }}>Nutrition</div>
          <span style={{ fontFamily: NT.sans, fontSize: 11.5, color: NT.dim }}>{clients.length} client{clients.length === 1 ? "" : "s"}</span>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {filters.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} style={pillBtnStyle(filter === k)}>{l}</button>)}
        </div>
      </div>

      {(filter === "all" || filter === "attention") && (
        <div>
          <div style={{ padding: "0 2px 10px", fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.bad }}>Needs attention</div>
          {attention.length === 0 && <div style={{ fontFamily: NT.sans, fontSize: 12.5, color: NT.dim, padding: "4px 2px" }}>Nobody needs attention right now.</div>}
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fit,minmax(280px,1fr))" : "minmax(0,1fr)", gap: 8 }}>
            {attention.map((h) => <ClientRow key={h.client.id} health={h} onClick={() => selectClient(h.client)} />)}
          </div>
        </div>
      )}

      {(filter === "all" || filter === "track") && (
        <div>
          <div style={{ padding: "0 2px 10px", fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted }}>On track</div>
          {onTrack.length === 0 && <div style={{ fontFamily: NT.sans, fontSize: 12.5, color: NT.dim, padding: "4px 2px" }}>No clients here yet.</div>}
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fit,minmax(280px,1fr))" : "minmax(0,1fr)", gap: 8 }}>
            {onTrack.map((h) => <ClientRow key={h.client.id} health={h} onClick={() => selectClient(h.client)} />)}
          </div>
        </div>
      )}
    </div>
  );
}
