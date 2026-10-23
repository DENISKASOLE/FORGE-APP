import { useMemo, useState } from "react";
import { showToast } from "../../components/ui/Toast.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { normalizeNotes, saveNotes } from "../../lib/nutritionV2.js";
import { addDaysISO, weeklyProgress, weeklyInsights } from "./nutritionV2Math.js";
import { Ring } from "./NutritionRing.jsx";
import { NT, MACRO_COLORS } from "./nutritionV2Theme.js";

const MAC_LABEL = { kcal: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat" };
const OUTCOME_META = {
  eaten: ["As planned", NT.protein], partial: ["Partly eaten", NT.accent], substituted: ["Substituted", NT.fat],
  skipped: ["Skipped", NT.dim], open: ["Not logged", NT.faint],
};
function pillBtnStyle(selected) {
  return { border: `1px solid ${selected ? "transparent" : "rgba(255,255,255,.1)"}`, background: selected ? NT.accent : "transparent", color: selected ? NT.bg : NT.muted, fontFamily: NT.sans, fontSize: 11, fontWeight: 600, padding: "9px 14px", borderRadius: 999, cursor: "pointer" };
}
function dayLabel(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3);
}

function KcalChart({ days }) {
  const maxV = Math.max(1, ...days.map((d) => Math.max(d.has ? d.totals.kcal : 0, d.target?.kcal || 0))) * 1.12;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 8, height: 150, alignItems: "end" }}>
      {days.map((d) => (
        <div key={d.date} style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
          <span style={{ fontFamily: NT.sans, fontSize: 10, color: NT.muted }}>{d.has ? Math.round(d.totals.kcal) : "—"}</span>
          {d.has ? (
            <div style={{ width: "70%", height: `${(d.totals.kcal / maxV) * 100}%`, background: MACRO_COLORS.kcal, borderRadius: "4px 4px 0 0" }} />
          ) : (
            <div style={{ width: "70%", height: 16, border: `1px dashed ${NT.lineSoft}`, borderBottom: 0, borderRadius: "4px 4px 0 0" }} />
          )}
          {d.target?.kcal ? <div style={{ position: "absolute", left: -2, right: -2, bottom: `${(d.target.kcal / maxV) * 100}%`, borderTop: `1px dashed ${NT.lineDashed}` }} /> : null}
          <span style={{ fontFamily: NT.sans, fontSize: 10, color: NT.dim }}>{dayLabel(d.date)}</span>
        </div>
      ))}
    </div>
  );
}

function MacroAttainment({ avg, avgTarget }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {["kcal", "protein", "carbs", "fat"].map((k) => {
        const a = avg[k], t = avgTarget[k], scale = Math.max(a, t, 1) * 1.1;
        const ratio = t ? a / t : 0;
        const verdict = !t ? "No target" : ratio < 0.9 ? `Below target (${Math.round(ratio * 100)}%)` : ratio > 1.1 ? `Above target (${Math.round(ratio * 100)}%)` : "Close to target";
        return (
          <div key={k}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: NT.sans, fontSize: 12.5, color: NT.text }}><span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: MACRO_COLORS[k] }} />{MAC_LABEL[k]}</span>
              <span style={{ fontFamily: NT.sans, fontSize: 11.5, color: NT.dim }}>{Math.round(a)}/{Math.round(t)}{k !== "kcal" ? "g" : ""} avg</span>
            </div>
            <div style={{ position: "relative", height: 7, borderRadius: 999, background: NT.card2, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(a / scale) * 100}%`, background: MACRO_COLORS[k], borderRadius: 999 }} />
              <div style={{ position: "absolute", top: -2, bottom: -2, width: 2, left: `${(t / scale) * 100}%`, background: NT.text }} />
            </div>
            <div style={{ fontFamily: NT.sans, fontSize: 11, color: NT.dim, marginTop: 4 }}>{verdict}</div>
          </div>
        );
      })}
    </div>
  );
}

function AdherenceCard({ result }) {
  const breakdown = ["eaten", "partial", "substituted", "skipped", "open"].map((k) => ({ key: k, n: result.counts[k] || 0, ...OUTCOME_META[k] }));
  const pct = result.adherencePct != null ? Math.round(result.adherencePct * 100) : null;
  return (
    <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Ring value={pct || 0} max={100} size={78} stroke={9} color={pct == null ? NT.faint : pct >= 70 ? NT.protein : pct >= 40 ? NT.accent : NT.bad}>
          <span style={{ fontFamily: NT.display, fontSize: 17, fontWeight: 600, color: NT.text }}>{pct != null ? `${pct}%` : "—"}</span>
        </Ring>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: NT.sans, fontSize: 13, fontWeight: 600, color: NT.text, marginBottom: 2 }}>Meal adherence</div>
          <div style={{ fontFamily: NT.sans, fontSize: 11.5, color: NT.dim, lineHeight: 1.5 }}>{result.loggedCount} of 7 days logged</div>
        </div>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
        {breakdown.map((b) => <div key={b.key} style={{ flex: `${b.n} 0 0`, display: b.n ? "block" : "none", background: b.key === "open" ? "transparent" : b[1], border: b.key === "open" ? `1px dashed ${NT.lineSoft}` : "none" }} />)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: NT.sans, fontSize: 12 }}>
        {breakdown.map((b) => <div key={b.key} style={{ display: "flex", justifyContent: "space-between", color: NT.muted }}><span>{b[0]}</span><span>{b.n}</span></div>)}
      </div>
      <span style={{ fontFamily: NT.sans, fontSize: 11, color: NT.dim, lineHeight: 1.5 }}>Adherence rule: meals logged exactly as planned ÷ prescribed meals with a logged outcome. Not-logged meals are excluded — never counted as missed.{result.unplannedCount ? ` ${result.unplannedCount} unplanned entr${result.unplannedCount === 1 ? "y" : "ies"} logged this period.` : ""}</span>
    </div>
  );
}

// Shared by the client Progress tab and the coach Weekly review tab -
// same chart/adherence/insight data either way, warm redesign for both
// (DECISIONS.md). Coach-only: rule-based insights + the commentary
// editor. Client-only: the coach's last-shared commentary, read-only.
//
// `draft`'s initial value is only ever read once per mount (React's own
// pattern for "reset this state when some prop changes" is to key the
// component by that prop, not to sync it from an effect) - the caller
// passes `key={client.id}` so switching clients remounts this fresh.
export function NutritionV2Progress({ client, updateClient, isCoach, plans, logs, marks }) {
  const [rangeOffset, setRangeOffset] = useState(0);
  const notes = useMemo(() => normalizeNotes(client.nutritionV2Notes), [client.nutritionV2Notes]);
  const [draft, setDraft] = useState(() => notes.draft || notes.shared || "");
  const [saving, setSaving] = useState(false);

  const today = isoDate();
  const endDateISO = addDaysISO(today, -7 * rangeOffset);
  const result = weeklyProgress(plans, logs, marks, endDateISO, today);
  const insights = weeklyInsights(result);
  const dirty = draft !== (notes.shared || "");

  async function share() {
    setSaving(true);
    const nextNotes = { draft, shared: draft, sharedDate: isoDate() };
    updateClient({ ...client, nutritionV2Notes: nextNotes });
    await saveNotes(client.id, nextNotes);
    setSaving(false);
    showToast(`Commentary shared with ${client.name}.`, "success");
  }

  return (
    <div style={{ background: NT.bg, margin: "-14px", padding: 14, borderRadius: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.muted }}>{result.days[0].date} – {result.days[6].date} · {result.loggedCount} of 7 days logged</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setRangeOffset(0)} style={pillBtnStyle(rangeOffset === 0)}>Last 7 days</button>
          <button onClick={() => setRangeOffset(1)} style={pillBtnStyle(rangeOffset === 1)}>Previous 7 days</button>
        </div>
      </div>

      <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.muted }}>Daily calories vs target</span>
          <span style={{ fontFamily: NT.sans, fontSize: 12, color: NT.muted }}>Avg {Math.round(result.avg.kcal)} / {Math.round(result.avgTarget.kcal)} kcal on logged days</span>
        </div>
        <KcalChart days={result.days} />
      </div>

      <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18 }}>
        <div style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.muted, marginBottom: 14 }}>Macro target attainment</div>
        <MacroAttainment avg={result.avg} avgTarget={result.avgTarget} />
      </div>

      <AdherenceCard result={result} />

      {isCoach ? (
        <>
          {insights.length > 0 && (
            <div style={{ background: NT.badBg, border: `1px solid ${NT.badBorder}`, borderRadius: 20, padding: 18 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 6, marginBottom: 10 }}>
                <span style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.bad }}>Worth a look</span>
                <span style={{ fontFamily: NT.sans, fontSize: 10.5, color: NT.dim }}>Rule-based · not medical advice</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {insights.map((text, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontFamily: NT.sans, fontSize: 12.5, color: "#F0DAD8", lineHeight: 1.5 }}>
                    <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 5, width: 4, height: 4, borderRadius: "50%", background: NT.bad }} />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.muted }}>Coach commentary</span>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${NT.lineSoft}`, background: NT.card2, color: NT.text, fontFamily: NT.sans, fontSize: 13, padding: "12px 14px", borderRadius: 12, outline: "none", resize: "vertical", minHeight: 90 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: NT.sans, fontSize: 11, color: NT.dim }}>{dirty ? "Unsent changes" : notes.sharedDate ? `Shared ${notes.sharedDate}` : "Not shared yet"}</span>
              <button onClick={share} disabled={saving || !draft.trim()} style={{ background: NT.accent, color: NT.bg, border: "none", fontFamily: NT.sans, fontSize: 13, fontWeight: 700, padding: "11px 20px", borderRadius: 12, cursor: saving || !draft.trim() ? "not-allowed" : "pointer", opacity: saving || !draft.trim() ? 0.5 : 1 }}>{saving ? "Sharing…" : `Share with ${client.name}`}</button>
            </div>
          </div>
        </>
      ) : (
        notes.shared && (
          <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: NT.sans, fontSize: 12, color: NT.muted }}>From your coach · {notes.sharedDate}</span>
            <p style={{ margin: 0, fontFamily: NT.sans, fontSize: 14, color: NT.text, lineHeight: 1.5 }}>{notes.shared}</p>
          </div>
        )
      )}
    </div>
  );
}
