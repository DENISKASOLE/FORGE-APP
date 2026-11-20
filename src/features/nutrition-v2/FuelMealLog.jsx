import { useMemo, useRef, useState } from "react";
import { useEdgeSwipeBack } from "../../lib/gestures.js";
import { BRAND } from "../../theme/tokens.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { uid } from "../../lib/uid.js";
import { itemMacros, mealTotals } from "./nutritionV2Math.js";
import { emptyMacros } from "./nutritionV2Model.js";
import { FuelSwap } from "./FuelSwap.jsx";
import { mealOptionsFor } from "./fuelOptions.js";
import { FUEL, fuelLbl, MACRO_COLOR } from "./fuelTheme.js";
import { Chevron, PlusIcon } from "./fuelUi.jsx";
import { FoodSearchSheet, BarcodeSheet } from "../quicklog/FoodQuickLog.jsx";

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function qtyLabel(qty, unit) {
  if (qty == null) return "";
  return unit === "piece" ? `${qty} pc` : `${qty} ${unit || ""}`.trim();
}
function MacroLine({ t, style }) {
  return (
    <span style={{ fontSize: 12, color: FUEL.muted, ...style }}>
      {Math.round(t.kcal)} kcal · <span style={{ color: MACRO_COLOR.carbs }}>{Math.round(t.carbs)}C</span> · <span style={{ color: MACRO_COLOR.fat }}>{Math.round(t.fat)}F</span> · <span style={{ color: MACRO_COLOR.protein }}>{Math.round(t.protein)}P</span>
    </span>
  );
}
function ActionRow({ title, sub, icon, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 12px", borderRadius: 16, background: FUEL.card, border: "1px solid var(--line-strong)", color: FUEL.text, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
      <div style={{ width: 36, height: 36, borderRadius: 99, background: "color-mix(in srgb, var(--accent) 14%, var(--card))", color: FUEL.red, display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: FUEL.muted, marginTop: 1 }}>{sub}</div>
      </div>
      <Chevron dir="right" color={FUEL.dim} />
    </button>
  );
}
const ScaleIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14M5 7h8M5 17h11" /></svg>;
const OutIcon = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M16 3c-2 0-3 3-3 7h3v11" /></svg>;

// Client · Fuel › meal screen, opened from a meal row's + on Today (Nov
// 2026 redesign). Everything to log one meal lives here: the coach's
// options, "Log as planned", change amounts, eating out, or something
// else (the existing FuelSwap sheet, for free text + photo). Writes go
// through the same onWrite(entries, marks) path as before.
export function FuelMealLog(props) {
  return props.free ? <FreeMealLog {...props} /> : <PlanMealLog {...props} />;
}

// No-plan logging (Nov 2026): same look, but the meal is just what the
// client adds - food search, barcode, or a photo/description.
function FreeMealLog({ client, updateClient, meal, dateISO, entries, dateMarks, editable, onWrite, onBack }) {
  const [sheet, setSheet] = useState(null);
  const swipeRef = useEdgeSwipeBack(onBack);
  const mine = entries.filter((e) => e.meal === meal.key);
  const t = mine.reduce((a, e) => ({ kcal: a.kcal + (e.macros?.kcal || 0), protein: a.protein + (e.macros?.protein || 0), carbs: a.carbs + (e.macros?.carbs || 0), fat: a.fat + (e.macros?.fat || 0) }), emptyMacros());
  const dateLabel = new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const SearchIco = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FUEL.red} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></svg>;
  const BarIco = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FUEL.red} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7V5h3M17 5h3v2M4 17v2h3M17 19h3v-2M8 9v6M11 9v6M14 9v6M17 9v6" /></svg>;
  return (
    <div ref={swipeRef} className="fx-push" style={{ width: "100%", minWidth: 0, maxWidth: "100%", color: FUEL.text, fontFamily: BRAND.sans, display: "flex", flexDirection: "column", padding: "2px 0 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 40px", alignItems: "center" }}>
        <button onClick={onBack} aria-label="Back" style={{ width: 40, height: 40, borderRadius: 99, background: FUEL.card2, border: `1px solid ${FUEL.line}`, display: "grid", placeItems: "center", cursor: "pointer", color: FUEL.text }}><Chevron dir="left" /></button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{cap(meal.name)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: FUEL.red }}>{dateLabel}</div>
        </div>
        <div />
      </div>

      <div style={{ minWidth: 0, marginTop: 14, padding: "12px 14px", borderRadius: 18, background: FUEL.card, border: "1px solid var(--line-strong)", borderTop: `4px solid ${FUEL.red}` }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{mine.length ? "Logged" : "Nothing logged yet"}</div>
        {mine.length > 0 && <MacroLine t={t} style={{ display: "block", marginTop: 2 }} />}
        <div style={{ marginTop: 6 }}>
          {mine.map((x) => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${FUEL.line}`, fontSize: 14 }}>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}{x.qty != null && x.unit ? <span style={{ color: FUEL.dim, fontSize: 12, fontWeight: 500 }}> · {qtyLabel(x.qty, x.unit)}</span> : null}</span>
              <span style={{ fontWeight: 600, flexShrink: 0 }}>{x.estimate && !x.macros?.kcal ? "—" : Math.round(x.macros?.kcal || 0)}</span>
              {editable && <button onClick={() => onWrite(entries.filter((e) => e.id !== x.id), dateMarks)} aria-label={`Remove ${x.name}`} style={{ width: 28, height: 28, borderRadius: 99, border: `1px solid ${FUEL.line}`, background: FUEL.card2, color: FUEL.muted, cursor: "pointer", fontSize: 13, padding: 0 }}>✕</button>}
            </div>
          ))}
        </div>
      </div>

      {editable ? (
        <>
          <div style={{ ...fuelLbl, color: FUEL.text, fontWeight: 600, margin: "18px 2px 8px" }}>Add to {meal.name.toLowerCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ActionRow title="Search food" sub="Find it and pick the amount" icon={SearchIco} onClick={() => setSheet("search")} />
            <ActionRow title="Scan barcode" sub="Packaged food" icon={BarIco} onClick={() => setSheet("barcode")} />
            <ActionRow title="Describe it or snap a photo" sub="Eating out, home cooking, no counting" icon={<PlusIcon color={FUEL.red} />} onClick={() => setSheet("else")} />
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12, fontSize: 13, color: FUEL.muted, textAlign: "center" }}>You can log this meal on the day.</div>
      )}

      {sheet === "search" && <FoodSearchSheet client={client} updateClient={updateClient} mealKey={meal.key} dateISO={dateISO} onClose={() => setSheet(null)} />}
      {sheet === "barcode" && <BarcodeSheet client={client} updateClient={updateClient} mealKey={meal.key} dateISO={dateISO} onClose={() => setSheet(null)} onSearchInstead={() => setSheet("search")} />}
      {sheet === "else" && (
        <FuelSwap only="else" client={client} plan={null} meal={meal} todayISO={dateISO} entries={entries} todayMarks={dateMarks}
          onWrite={async (e, m) => { await onWrite(e, m); }} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

function PlanMealLog({ client, plan, meal, dateISO, entries, dateMarks, editable, onWrite, onBack }) {
  const options = useMemo(() => mealOptionsFor(plan, meal, dateISO), [plan, meal, dateISO]);
  const [optId, setOptId] = useState("today");
  const [editing, setEditing] = useState(false);
  const [qtys, setQtys] = useState({});
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const sheetSaved = useRef(false);
  const swipeRef = useEdgeSwipeBack(onBack);
  const [outOpen, setOutOpen] = useState(false);
  const [outText, setOutText] = useState("");
  const selected = options.find((o) => o.id === optId) || options[0];
  const logged = entries.filter((e) => e.meal === meal.key && !e.extra);
  const extras = entries.filter((e) => e.meal === meal.key && e.extra);
  const dateLabel = new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  async function write(added, msg) {
    setSaving(true);
    const kept = entries.filter((e) => e.meal !== meal.key || e.extra);
    await onWrite([...kept, ...added], dateMarks);
    setSaving(false);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    showToast(msg, "success");
    onBack();
  }
  function logSelected() {
    const time = nowHHMM();
    const items = selected.meal.items.map((it) => (editing && qtys[it.id] != null ? { ...it, qty: qtys[it.id] } : it));
    const added = items.map((it) => ({
      id: uid(), date: dateISO, meal: meal.key, name: it.name, foodId: it.foodId, qty: it.qty, unit: it.unit,
      macros: itemMacros(it), source: selected.isToday ? "confirm" : "sub", time,
      planItemId: selected.isToday ? it.id : null, estimate: false, replaces: selected.isToday ? null : meal.key, reason: editing ? "Adjusted amounts" : null, photo: null,
    }));
    write(added, selected.isToday ? `${meal.name} logged${editing ? " with your amounts" : " as planned"}.` : `${meal.name} logged as swapped.`);
  }
  function logEatingOut() {
    const desc = outText.trim();
    if (!desc) { showToast("Describe what you ate first.", "warn"); return; }
    const estimate = meal.eatingOutEstimate && Object.keys(meal.eatingOutEstimate).length ? meal.eatingOutEstimate : mealTotals(meal);
    write([{
      id: uid(), date: dateISO, meal: meal.key, name: `Eating out: ${desc}`, foodId: null, qty: null, unit: null,
      macros: { ...emptyMacros(), ...estimate }, source: "quick", time: nowHHMM(), planItemId: null, estimate: true, replaces: null, reason: "Eating out", note: desc, photo: null,
    }], `${meal.name} logged as eating out.`);
  }
  async function clearLog() {
    const kept = entries.filter((e) => e.meal !== meal.key || e.extra);
    const nextMarks = { ...dateMarks };
    delete nextMarks[meal.key];
    await onWrite(kept, nextMarks);
    showToast(`${meal.name} log cleared.`, "info");
  }
  function step(it, dir) {
    const cur = qtys[it.id] ?? it.qty;
    const inc = it.unit === "g" || it.unit === "ml" ? 10 : 0.5;
    setQtys({ ...qtys, [it.id]: Math.max(0, Math.round((cur + dir * inc) * 10) / 10) });
  }
  const shownItems = selected.meal.items.map((it) => (editing && qtys[it.id] != null ? { ...it, qty: qtys[it.id] } : it));
  const shownTotals = shownItems.reduce((t, it) => { const m = itemMacros(it); return { kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }; }, emptyMacros());

  return (
    <div ref={swipeRef} className="fx-push" style={{ width: "100%", minWidth: 0, maxWidth: "100%", color: FUEL.text, fontFamily: BRAND.sans, display: "flex", flexDirection: "column", padding: "2px 0 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 40px", alignItems: "center" }}>
        <button onClick={onBack} aria-label="Back" style={{ width: 40, height: 40, borderRadius: 99, background: FUEL.card2, border: `1px solid ${FUEL.line}`, display: "grid", placeItems: "center", cursor: "pointer", color: FUEL.text }}><Chevron dir="left" color={FUEL.text} /></button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{cap(meal.name)}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: FUEL.red }}>{dateLabel} · {meal.time}</div>
        </div>
        <div />
      </div>

      {logged.length > 0 && (
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 16, background: FUEL.proteinTrack, border: `1px solid ${FUEL.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: FUEL.protein }}>✓ Logged at {logged[0].time || "—"}</span>
            {editable && <button onClick={clearLog} style={{ background: "none", border: "none", color: FUEL.muted, fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: 4 }}>Clear</button>}
          </div>
          <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 2 }}>Logging again replaces what's here.</div>
        </div>
      )}

      {extras.length > 0 && (
        <div style={{ minWidth: 0, marginTop: 10, padding: "8px 12px", borderRadius: 16, background: FUEL.card, border: `1px solid ${FUEL.line}` }}>
          <div style={{ ...fuelLbl, marginBottom: 4 }}>Also added</div>
          {extras.map((x) => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span>
              <span style={{ color: FUEL.muted }}>{Math.round(x.macros?.kcal || 0)}</span>
              {editable && <button onClick={() => onWrite(entries.filter((e) => e.id !== x.id), dateMarks)} aria-label={`Remove ${x.name}`} style={{ width: 28, height: 28, borderRadius: 99, border: `1px solid ${FUEL.line}`, background: FUEL.card2, color: FUEL.muted, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>}
            </div>
          ))}
        </div>
      )}

      {options.length > 1 && (
        <>
          <div style={{ ...fuelLbl, color: FUEL.text, fontWeight: 600, margin: "16px 2px 8px" }}>Coach's options</div>
          <div style={{ minWidth: 0, display: "flex", gap: 6, overflowX: "auto" }}>
            {options.map((o) => {
              const on = o.id === selected.id;
              return (
                <button key={o.id} onClick={() => { setOptId(o.id); setEditing(false); setQtys({}); }} style={{ flex: "1 0 30%", minWidth: 0, padding: "9px 10px", borderRadius: 12, border: `1.5px solid ${on ? FUEL.red : "var(--line-strong)"}`, background: on ? "color-mix(in srgb, var(--accent) 10%, var(--card))" : FUEL.card, color: FUEL.text, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: on ? FUEL.red : FUEL.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</div>
                  <div style={{ fontSize: 11, color: FUEL.dim, marginTop: 2 }}>{Math.round(o.totals.kcal)} kcal · {Math.round(o.totals.protein)}P</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div style={{ minWidth: 0, marginTop: 10, padding: "12px 14px", borderRadius: 18, background: FUEL.card, border: "1px solid var(--line-strong)", borderTop: `4px solid ${FUEL.red}` }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{selected.title}</div>
        <MacroLine t={shownTotals} style={{ display: "block", marginTop: 2 }} />
        <div style={{ marginTop: 6 }}>
          {shownItems.map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${FUEL.line}`, fontSize: 14 }}>
              <span style={{ minWidth: 0, fontWeight: 600 }}>{it.name} {!editing && <span style={{ color: FUEL.dim, fontSize: 12 }}>· {qtyLabel(it.qty, it.unit)}</span>}</span>
              {editing ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => step(it, -1)} aria-label="Less" style={stepBtn}>−</button>
                  <span style={{ minWidth: 54, textAlign: "center", fontSize: 13 }}>{qtyLabel(it.qty, it.unit)}</span>
                  <button onClick={() => step(it, 1)} aria-label="More" style={stepBtn}>+</button>
                </span>
              ) : (
                <span style={{ color: FUEL.text, fontWeight: 600, flexShrink: 0 }}>{Math.round(itemMacros(it).kcal)}</span>
              )}
            </div>
          ))}
        </div>
        {selected.meal.note && <div style={{ fontSize: 12, color: FUEL.amber, marginTop: 4 }}>{selected.meal.note}</div>}
      </div>

      {editable ? (
        <>
          <button onClick={logSelected} disabled={saving || !selected.meal.items.length} style={{ marginTop: 12, height: 52, borderRadius: 14, border: "none", background: "linear-gradient(140deg, var(--accent) 0%, var(--accent-deep) 100%)", boxShadow: "0 4px 14px color-mix(in srgb, var(--accent) 25%, transparent)", color: FUEL.onText, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {editing ? "Log with these amounts" : selected.isToday ? "Log as planned" : `Log ${selected.title}`}
          </button>
          <div style={{ ...fuelLbl, color: FUEL.text, fontWeight: 600, margin: "18px 2px 8px" }}>Something different?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!editing && <ActionRow title="Change amounts" sub="Ate more or less of this meal" icon={ScaleIcon} onClick={() => setEditing(true)} />}
            {editing && <ActionRow title="Back to planned amounts" sub="Undo your amount changes" icon={ScaleIcon} onClick={() => { setEditing(false); setQtys({}); }} />}
            <ActionRow title="Eating out" sub="Describe what you ate at the restaurant" icon={OutIcon} onClick={() => setOutOpen(!outOpen)} />
            {outOpen && (
              <div style={{ padding: 12, borderRadius: 16, background: FUEL.card, border: `1px solid ${FUEL.lineSoft}`, display: "flex", flexDirection: "column", gap: 8 }}>
                <label htmlFor="eat-out" style={{ fontSize: 14, fontWeight: 600 }}>What did you eat?</label>
                <textarea id="eat-out" value={outText} onChange={(e) => setOutText(e.target.value)} autoFocus rows={3} placeholder="e.g. Grilled chicken shawarma plate, half the fries, Diet Coke"
                  style={{ width: "100%", boxSizing: "border-box", resize: "none", borderRadius: 12, border: `1px solid ${FUEL.line}`, background: "var(--sheet)", color: FUEL.text, padding: "10px 12px", fontSize: 15, fontFamily: "inherit" }} />
                <div style={{ fontSize: 12, color: FUEL.dim }}>Grilled protein first, one starch, skip fried food and sweet drinks. Coach Denis sees this.</div>
                <button onClick={logEatingOut} disabled={saving || !outText.trim()} style={{ height: 46, borderRadius: 12, border: "none", background: FUEL.red, color: FUEL.onText, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Log eating out</button>
              </div>
            )}
            <ActionRow title="Log something else" sub="Describe it or snap a photo" icon={<PlusIcon color={FUEL.red} />} onClick={() => setSheet(true)} />
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12, fontSize: 13, color: FUEL.muted, textAlign: "center" }}>You can log this meal on the day.</div>
      )}

      {sheet && (
        <FuelSwap only="else" client={client} plan={plan} meal={meal} todayISO={dateISO} entries={entries} todayMarks={dateMarks}
          onWrite={async (e, m) => { await onWrite(e, m); sheetSaved.current = true; }}
          onClose={() => { setSheet(false); if (sheetSaved.current) onBack(); }} />
      )}
    </div>
  );
}
const stepBtn = { width: 30, height: 30, borderRadius: 99, border: `1px solid ${FUEL.line}`, background: FUEL.card2, color: FUEL.text, fontSize: 16, cursor: "pointer", display: "grid", placeItems: "center", padding: 0 };
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
