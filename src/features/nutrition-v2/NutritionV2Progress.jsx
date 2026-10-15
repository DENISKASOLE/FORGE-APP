import { useMemo, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { textareaStyle } from "../../components/ui/Field.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { normalizeNotes, saveNotes } from "../../lib/nutritionV2.js";
import { addDaysISO, weeklyProgress, weeklyInsights } from "./nutritionV2Math.js";

const MAC_COLOR = { kcal: T.gold, protein: T.good, carbs: T.blue, fat: T.violet };
const MAC_LABEL = { kcal: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat" };
const OUTCOME_META = {
  eaten: ["As planned", T.good], partial: ["Partly eaten", T.warn], substituted: ["Substituted", T.violet],
  skipped: ["Skipped", T.dim], open: ["Not logged", T.line],
};

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
          <span style={{ fontSize: 10, color: T.muted }}>{d.has ? Math.round(d.totals.kcal) : "—"}</span>
          {d.has ? (
            <div style={{ width: "70%", height: `${(d.totals.kcal / maxV) * 100}%`, background: T.gold, borderRadius: "4px 4px 0 0", opacity: 0.9 }} />
          ) : (
            <div style={{ width: "70%", height: 16, border: `1px dashed ${T.line}`, borderBottom: 0, borderRadius: "4px 4px 0 0" }} />
          )}
          {d.target?.kcal ? <div style={{ position: "absolute", left: -2, right: -2, bottom: `${(d.target.kcal / maxV) * 100}%`, borderTop: `1px dashed ${T.muted}` }} /> : null}
          <span style={{ fontSize: 10, color: T.dim }}>{dayLabel(d.date)}</span>
        </div>
      ))}
    </div>
  );
}

function MacroAttainment({ avg, avgTarget }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {["kcal", "protein", "carbs", "fat"].map((k) => {
        const a = avg[k], t = avgTarget[k], scale = Math.max(a, t, 1) * 1.1;
        const ratio = t ? a / t : 0;
        const verdict = !t ? "No target" : ratio < 0.9 ? `Below target (${Math.round(ratio * 100)}%)` : ratio > 1.1 ? `Above target (${Math.round(ratio * 100)}%)` : "Close to target";
        return (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "90px minmax(0,1fr)", gap: 10, alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text }}><span style={{ width: 8, height: 8, borderRadius: 2, background: MAC_COLOR[k] }} />{MAC_LABEL[k]}</span>
            <div>
              <div style={{ position: "relative", height: 6, borderRadius: 3, background: T.card2 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(a / scale) * 100}%`, background: MAC_COLOR[k], borderRadius: 3 }} />
                <div style={{ position: "absolute", top: -2, bottom: -2, width: 2, left: `${(t / scale) * 100}%`, background: T.text }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4, gap: 4 }}>
                <span>{Math.round(a)} / {Math.round(t)}{k !== "kcal" ? "g" : ""} avg</span><span>{verdict}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdherenceCard({ result }) {
  const breakdown = ["eaten", "partial", "substituted", "skipped", "open"].map((k) => ({ key: k, n: result.counts[k] || 0, ...OUTCOME_META[k] }));
  return (
    <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel color={T.muted}>Logging and adherence</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        <div><div style={{ color: T.muted, fontSize: 12 }}>Days logged</div><div style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 600, color: T.text }}>{result.loggedCount}/7</div></div>
        <div><div style={{ color: T.muted, fontSize: 12 }}>Meal adherence</div><div style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 600, color: T.text }}>{result.adherencePct != null ? `${Math.round(result.adherencePct * 100)}%` : "—"}</div></div>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
        {breakdown.map((b) => <div key={b.key} style={{ flex: `${b.n} 0 0`, display: b.n ? "block" : "none", background: b.key === "open" ? "transparent" : b[1], border: b.key === "open" ? `1px dashed ${T.line}` : "none" }} />)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        {breakdown.map((b) => <div key={b.key} style={{ display: "flex", justifyContent: "space-between", color: T.muted }}><span>{b[0]}</span><span>{b.n}</span></div>)}
      </div>
      <span style={{ fontSize: 11, color: T.dim, lineHeight: 1.5 }}>Adherence rule: meals logged exactly as planned ÷ prescribed meals with a logged outcome. Not-logged meals are excluded — never counted as missed.{result.unplannedCount ? ` ${result.unplannedCount} unplanned entr${result.unplannedCount === 1 ? "y" : "ies"} logged this period.` : ""}</span>
    </Card>
  );
}

// Shared by the client Progress tab and the coach Weekly review tab -
// same chart/adherence/insight data either way, per the design read from
// Forge Nutrition.dc.html. Coach-only: rule-based insights + the
// commentary editor. Client-only: the coach's last-shared commentary,
// read-only.
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SectionLabel color={T.muted}>{result.days[0].date} – {result.days[6].date} · {result.loggedCount} of 7 days logged</SectionLabel>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip selected={rangeOffset === 0} onClick={() => setRangeOffset(0)}>Last 7 days</Chip>
          <Chip selected={rangeOffset === 1} onClick={() => setRangeOffset(1)}>Previous 7 days</Chip>
        </div>
      </div>

      <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
          <SectionLabel color={T.muted}>Daily calories vs target</SectionLabel>
          <span style={{ fontSize: 12, color: T.muted }}>Avg {Math.round(result.avg.kcal)} / {Math.round(result.avgTarget.kcal)} kcal on logged days</span>
        </div>
        <KcalChart days={result.days} />
      </Card>

      <Card style={{ padding: 14 }}>
        <SectionLabel color={T.muted} style={{ marginBottom: 12 }}>Macro target attainment</SectionLabel>
        <MacroAttainment avg={result.avg} avgTarget={result.avgTarget} />
      </Card>

      <AdherenceCard result={result} />

      {isCoach ? (
        <>
          {insights.length > 0 && (
            <Card style={{ padding: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 6, marginBottom: 10 }}>
                <SectionLabel color={T.muted}>Review prompts</SectionLabel>
                <span style={{ fontSize: 11, color: T.dim }}>Rule-based · not medical advice</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.map((text, i) => <div key={i} style={{ fontSize: 13, color: T.text, paddingTop: i ? 8 : 0, borderTop: i ? `${T.hairline} solid ${T.line}` : "none" }}>{text}</div>)}
              </div>
            </Card>
          )}
          <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionLabel color={T.muted}>Coach commentary</SectionLabel>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={textareaStyle({ minHeight: 90 })} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: T.dim }}>{dirty ? "Unsent changes" : notes.sharedDate ? `Shared ${notes.sharedDate}` : "Not shared yet"}</span>
              <Button onClick={share} disabled={saving || !draft.trim()}>{saving ? "Sharing…" : `Share with ${client.name}`}</Button>
            </div>
          </Card>
        </>
      ) : (
        notes.shared && (
          <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, color: T.muted }}>From your coach · {notes.sharedDate}</span>
            <p style={{ margin: 0, fontSize: 14, color: T.text, lineHeight: 1.5 }}>{notes.shared}</p>
          </Card>
        )
      )}
    </div>
  );
}
