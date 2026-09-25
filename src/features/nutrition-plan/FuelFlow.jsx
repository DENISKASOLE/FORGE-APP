import { useMemo, useRef, useState } from "react";
import { NP, npCard, npButton, npLabel } from "./theme.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { uid } from "../../lib/uid.js";
import { isoDate } from "../../lib/dateUtils.js";
import { savePlanLogs, planDayLogFor } from "../../lib/nutritionPlan.js";
import { allMealItems, loggedDayTotals, entryFromEatenItem, entryFromSwap, skippedEntry, extraTotals, resolveSignedPlan, resolveDayForDate } from "./planMath.js";
import { estimateFoodExtra } from "../../lib/ai.js";
import { buildNutritionPlanPDF, sharePdfBlob, safeFilename } from "../../lib/pdf.js";

const EDIT_WINDOW_DAYS = 2;
const PORTION_CHIPS = [0.5, 0.75, 1, 1.25, 1.5];

function fmtHeaderDate(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }).toUpperCase().replace(",", "");
}
function nowHHMMFor(dateISO, today) {
  if (dateISO < today) return "24:00";
  if (dateISO > today) return "00:00";
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function addDaysISO(dateISO, n) {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
// First meal (time order) with no entries at all is "next"; everything
// after it with no entries is "upcoming" - matches FuelToday.dc.html.
function computeMealStates(day, dayLog) {
  const meals = [...(day.blocks || []).filter((b) => b.type === "meal")].sort((a, b) => a.time.localeCompare(b.time));
  let nextAssigned = false;
  return meals.map((meal) => {
    const entries = meal.items.map((it) => dayLog.entries[it.id]);
    const anyEntry = entries.some(Boolean);
    const allEntries = entries.length > 0 && entries.every(Boolean);
    let state;
    if (allEntries) {
      if (entries.every((e) => e.status === "skipped")) state = "skipped";
      else if (entries.some((e) => e.status === "swapped")) state = "swapped";
      else if (entries.some((e) => e.status === "eaten" && e.portion !== 1)) state = "partial_portion";
      else state = "logged";
    } else if (anyEntry) {
      state = "partial";
    } else if (!nextAssigned) {
      state = "next";
      nextAssigned = true;
    } else {
      state = "upcoming";
    }
    return { meal, state, entries, ticked: entries.filter(Boolean).length };
  });
}

function Ring({ value, target, color, unitLabel }) {
  const pct = target ? Math.min(1, value / target) : 0;
  const C = 2 * Math.PI * 26;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke={NP.card2} strokeWidth="6" />
          <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 32 32)" />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: NP.text }}>{Math.round(value).toLocaleString()}</span>
      </div>
      <span style={{ fontSize: 9, letterSpacing: "0.14em", color: NP.muted }}>/ {Math.round(target || 0).toLocaleString()} {unitLabel}</span>
    </div>
  );
}

function CheckIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>;
}
function SwapIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></svg>;
}

function itemLine(it) {
  return `${it.food.name}${it.food.state ? `, ${it.food.state}` : ""} ${it.amount}${it.food.unit === "piece" ? "" : it.food.unit}`;
}

function MealCard({ row, editable, onOpen, onAtePlanned }) {
  const { meal, state, ticked } = row;
  const kcal = Math.round(meal.items.reduce((s, it) => s + (it.food.per100.kcal * (it.food.unit === "piece" ? it.amount * (it.food.pieceGrams || 0) : it.amount)) / 100, 0));

  if (state === "logged" || state === "swapped" || state === "partial_portion" || state === "skipped") {
    const skipped = state === "skipped";
    const swapped = state === "swapped";
    const loggedAt = row.entries.find(Boolean)?.loggedAt;
    const time = loggedAt ? new Date(loggedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
    const firstSwap = swapped ? row.entries.find((e) => e?.status === "swapped") : null;
    const extraSwaps = swapped ? row.entries.filter((e) => e?.status === "swapped").length - 1 : 0;
    return (
      <button onClick={() => onOpen(meal)} style={{ ...npCard({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer", opacity: skipped ? 0.5 : 1 }}>
        <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 999, background: skipped ? NP.card2 : swapped ? NP.text : NP.good, color: skipped ? NP.dim : "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {skipped ? "–" : swapped ? <SwapIcon /> : <CheckIcon />}
        </span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 14, letterSpacing: "0.1em", color: NP.text }}>{meal.name}</span>
          <span style={{ fontSize: 10, letterSpacing: "0.12em", color: skipped ? NP.dim : swapped ? NP.muted : NP.good }}>
            {skipped ? "SKIPPED" : swapped ? `SWAPPED · ${firstSwap.name.toUpperCase()}${extraSwaps > 0 ? ` +${extraSwaps}` : ""}` : state === "partial_portion" ? "ATE A DIFFERENT PORTION" : `AS PLANNED${time ? ` · ${time}` : ""}`}
          </span>
        </div>
        {!skipped && <span style={{ fontSize: 12, color: NP.muted, flexShrink: 0 }}>{kcal} KCAL</span>}
      </button>
    );
  }

  if (state === "partial") {
    return (
      <button onClick={() => onOpen(meal)} style={{ ...npCard({ padding: "14px 16px" }), display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer" }}>
        <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="11" fill="none" stroke={NP.card2} strokeWidth="4" />
            <circle cx="14" cy="14" r="11" fill="none" stroke={NP.text} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(ticked / meal.items.length) * 69} 69`} transform="rotate(-90 14 14)" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 14, letterSpacing: "0.1em", color: NP.text }}>{meal.name}</span>
          <span style={{ fontSize: 10, letterSpacing: "0.12em", color: NP.muted }}>{ticked} OF {meal.items.length} TICKED</span>
        </div>
        <span style={{ fontSize: 12, color: NP.muted, flexShrink: 0 }}>{kcal} KCAL</span>
      </button>
    );
  }

  // next / upcoming
  const isNext = state === "next";
  return (
    <div style={npCard({ padding: 16, display: "flex", flexDirection: "column", gap: 12, borderColor: isNext ? NP.text : NP.line })}>
      <button onClick={() => onOpen(meal)} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.14em", color: isNext ? NP.muted : NP.dim }}>{isNext ? `NEXT · ${meal.time}` : meal.time}</span>
          <span style={{ fontSize: 15, letterSpacing: "0.1em", color: NP.text }}>{meal.name}</span>
        </div>
        <span style={{ fontSize: 12, color: NP.muted }}>{kcal} KCAL</span>
      </button>
      <div style={{ fontSize: 12, color: NP.muted, letterSpacing: "0.04em" }}>{meal.items.map(itemLine).join(" · ") || "No foods yet"}</div>
      {editable && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onAtePlanned(meal)} style={npButton(isNext ? "fill" : "outline", { flex: 1, fontSize: 12 })}><CheckIcon size={16} />ATE AS PLANNED</button>
          <button onClick={() => onOpen(meal)} style={npButton("outline", { padding: "0 16px", fontSize: 12 })}>CHANGES</button>
        </div>
      )}
    </div>
  );
}

function PortionSheet({ meal, onClose, onApply }) {
  const [pct, setPct] = useState(1);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, boxSizing: "border-box", padding: "12px 16px 24px", background: NP.card, borderTop: `1px solid ${NP.lineDashed}`, borderRadius: "24px 24px 0 0", fontFamily: NP.font, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: NP.lineDashed, margin: "4px auto 0" }} />
        <div style={npLabel()}>HOW MUCH OF {meal.name} DID YOU EAT?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PORTION_CHIPS.map((p) => (
            <button key={p} onClick={() => setPct(p)} style={{ height: 44, padding: "0 16px", borderRadius: 999, background: pct === p ? NP.text : "transparent", color: pct === p ? "#000000" : NP.text, border: `1px solid ${NP.line}`, fontFamily: NP.font, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{p === 0.5 ? "½" : p === 0.75 ? "¾" : p === 1.25 ? "1¼" : p === 1.5 ? "1½" : "1"}</button>
          ))}
        </div>
        <button onClick={() => onApply(pct)} style={npButton("fill", { height: 52 })}>APPLY TO TICKED ITEMS</button>
      </div>
    </div>
  );
}

function SwapSheet({ item, onClose, onApply }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1400, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, boxSizing: "border-box", padding: "12px 16px 24px", background: NP.card, borderTop: `1px solid ${NP.lineDashed}`, borderRadius: "24px 24px 0 0", fontFamily: NP.font, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: NP.lineDashed, margin: "4px auto 0" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={npLabel()}>SWAP · YOUR COACH'S OPTIONS</span>
          <span style={{ fontSize: 17, letterSpacing: "0.08em", color: NP.text }}>{item.food.name.toUpperCase()} {item.amount}{item.food.unit === "piece" ? "" : item.food.unit.toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {item.swaps.length === 0 && <div style={{ color: NP.dim, fontSize: 12 }}>Your coach hasn't set up swaps for this food.</div>}
          {item.swaps.map((s) => (
            <button key={s.id} role="radio" aria-checked={false} onClick={() => onApply(s)} style={{ height: 54, padding: "0 14px", background: NP.bg, border: `1px solid ${NP.line}`, borderRadius: 12, color: NP.text, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, cursor: "pointer" }}>
              <span>{s.food.name}</span><span style={{ color: NP.muted, fontSize: 12 }}>{s.amount}{s.food.unit === "piece" ? "" : s.food.unit}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MealDetailSheet({ meal, dayLog, editable, onClose, onTick, onUntick, onSkip, onPortion, onSwap }) {
  const [swapItem, setSwapItem] = useState(null);
  const [portionOpen, setPortionOpen] = useState(false);
  const totalKcal = Math.round(meal.items.reduce((s, it) => {
    const e = dayLog.entries[it.id];
    return s + (e && e.status !== "skipped" ? e.kcal : 0);
  }, 0));
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, background: NP.bg, overflow: "auto", fontFamily: NP.font, color: NP.text }}>
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} aria-label="Back" style={{ width: 44, height: 44, borderRadius: 12, background: NP.card, border: `1px solid ${NP.line}`, color: NP.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>‹</button>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={npLabel()}>{meal.time} · TICK WHAT YOU ATE</span>
            <span style={{ fontSize: 20, letterSpacing: "0.1em" }}>{meal.name}</span>
          </div>
        </div>

        <div style={npCard({ overflow: "hidden" })}>
          {meal.items.map((it, i) => {
            const entry = dayLog.entries[it.id];
            const checked = !!entry && entry.status !== "skipped";
            const hasSwaps = meal.allowSwaps && it.swaps.length > 0;
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 14px", height: 64, borderTop: i ? `1px solid ${NP.card2}` : "none", background: i % 2 ? NP.card2 : "transparent" }}>
                <button role="checkbox" aria-checked={checked} aria-label={it.food.name} disabled={!editable} onClick={() => (checked ? onUntick(it) : onTick(it))} style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, border: checked ? 0 : `2px solid ${NP.dim}`, background: checked ? NP.good : "transparent", color: "#000000", display: "flex", alignItems: "center", justifyContent: "center", cursor: editable ? "pointer" : "default" }}>
                  {checked && <CheckIcon size={14} />}
                </button>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 400 }}>{it.food.name}{it.food.state ? `, ${it.food.state}` : ""}</span>
                  <span style={{ fontSize: 11, color: NP.muted, fontWeight: 400 }}>{entry && entry.status === "swapped" ? `${entry.name} · ${entry.amount}${entry.unit === "piece" ? "" : entry.unit}` : `${it.amount}${it.food.unit === "piece" ? "" : it.food.unit}`} · {Math.round(entry ? entry.kcal : (it.food.per100.kcal * (it.food.unit === "piece" ? it.amount * (it.food.pieceGrams || 0) : it.amount)) / 100)} kcal</span>
                </div>
                {hasSwaps && editable && (
                  <button onClick={() => setSwapItem(it)} aria-label={`Swap ${it.food.name}`} style={{ width: 40, height: 40, borderRadius: 10, background: entry?.status === "swapped" ? NP.text : "transparent", border: `1px solid ${NP.line}`, color: entry?.status === "swapped" ? "#000000" : NP.muted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><SwapIcon /></button>
                )}
              </div>
            );
          })}
        </div>

        {editable && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPortionOpen(true)} style={npButton("outline", { flex: 1, fontSize: 11 })}>ATE LESS / MORE</button>
            <button onClick={onSkip} style={npButton("outline", { flex: 1, fontSize: 11 })}>SKIPPED MEAL</button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: "0.1em", color: NP.muted, paddingTop: 8, borderTop: `1px solid ${NP.line}` }}>
          <span>TOTAL LOGGED</span><span style={{ color: NP.text }}>{totalKcal} KCAL</span>
        </div>
      </div>

      {swapItem && <SwapSheet item={swapItem} onClose={() => setSwapItem(null)} onApply={(swap) => { onSwap(swapItem, swap); setSwapItem(null); }} />}
      {portionOpen && <PortionSheet meal={meal} onClose={() => setPortionOpen(false)} onApply={(pct) => { onPortion(pct); setPortionOpen(false); }} />}
    </div>
  );
}

function ExtrasSheet({ recent, onClose, onAdd, seed }) {
  const [text, setText] = useState(seed || "");
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runEstimate(t) {
    const value = (t ?? text).trim();
    if (!value) return;
    setLoading(true);
    setError("");
    try {
      const result = await estimateFoodExtra(value);
      if (result.not_food || !result.items?.length) { setError("That doesn't look like food — try describing what you ate."); setEstimate(null); }
      else setEstimate({ rawText: value, items: result.items, warning: result.warning });
    } catch (e) {
      setError(e.message || "Couldn't estimate that.");
    } finally {
      setLoading(false);
    }
  }
  function updateItemAmount(i, factor) {
    setEstimate((e) => ({ ...e, items: e.items.map((it, ii) => (ii === i ? { ...it, amount: Math.round(it.amount * factor * 100) / 100, grams: it.grams * factor, kcal: it.kcal * factor, protein: it.protein * factor, carbs: it.carbs * factor, fat: it.fat * factor } : it)) }));
  }
  function removeItem(i) {
    setEstimate((e) => ({ ...e, items: e.items.filter((_, ii) => ii !== i) }));
  }
  const total = estimate ? estimate.items.reduce((t, i) => ({ kcal: t.kcal + i.kcal, protein: t.protein + i.protein, carbs: t.carbs + i.carbs, fat: t.fat + i.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }) : null;

  function addToToday() {
    if (!estimate || estimate.items.length === 0) return;
    const entries = estimate.items.map((it) => ({ id: uid(), rawText: estimate.rawText, estimate: { items: [it] }, isEstimate: true, pendingEstimate: false, loggedAt: new Date().toISOString() }));
    onAdd(entries);
  }
  function saveWithoutEstimate() {
    const value = text.trim();
    if (!value) return;
    onAdd([{ id: uid(), rawText: value, estimate: null, isEstimate: false, pendingEstimate: true, loggedAt: new Date().toISOString() }]);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflow: "auto", boxSizing: "border-box", padding: "12px 16px 24px", background: NP.card, borderTop: `1px solid ${NP.lineDashed}`, borderRadius: "24px 24px 0 0", fontFamily: NP.font, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: NP.lineDashed, margin: "4px auto 0" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={npLabel()}>EXTRAS · NOT ON YOUR PLAN</span>
          <span style={{ fontSize: 17, letterSpacing: "0.08em", color: NP.text }}>WHAT DID YOU HAVE?</span>
        </div>
        <label style={{ display: "flex", alignItems: "center", height: 52, boxSizing: "border-box", padding: "0 14px", background: NP.bg, border: `1px solid ${NP.text}`, borderRadius: 14 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runEstimate()} aria-label="What did you have?" style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, color: NP.text, fontSize: 14, outline: "none" }} />
        </label>
        {recent.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.12em", color: NP.dim }}>RECENT</span>
            {recent.map((r) => (
              <button key={r.rawText} onClick={() => { setText(r.rawText); setEstimate({ rawText: r.rawText, items: r.items.map((it) => ({ ...it })) }); }} style={{ height: 34, padding: "0 12px", borderRadius: 999, background: NP.card2, border: 0, color: NP.text, fontSize: 12, cursor: "pointer" }}>{r.rawText}</button>
            ))}
          </div>
        )}

        {!estimate && (
          <button onClick={() => runEstimate()} disabled={loading || !text.trim()} style={npButton("fill", { height: 48 })}>{loading ? "ESTIMATING…" : "ESTIMATE"}</button>
        )}
        {error && <div style={{ color: "#FF6B61", fontSize: 12 }}>{error}</div>}

        {estimate && (
          <div style={{ background: NP.bg, border: `1px solid ${NP.line}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, letterSpacing: "0.14em", color: NP.muted }}>ESTIMATE</div>
            {estimate.items.map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0 }}>{it.name} × {it.amount}{it.unit === "piece" ? "" : it.unit}</span>
                <button onClick={() => updateItemAmount(i, 0.5)} style={{ background: "none", border: "none", color: NP.dim, cursor: "pointer", fontSize: 12 }}>½×</button>
                <button onClick={() => updateItemAmount(i, 2)} style={{ background: "none", border: "none", color: NP.dim, cursor: "pointer", fontSize: 12 }}>2×</button>
                <span style={{ color: NP.muted, minWidth: 56, textAlign: "right" }}>{Math.round(it.kcal)} kcal</span>
                <button onClick={() => removeItem(i)} aria-label={`Remove ${it.name}`} style={{ background: "none", border: "none", color: NP.dim, cursor: "pointer" }}>×</button>
              </div>
            ))}
            {estimate.items.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${NP.line}`, fontSize: 11, letterSpacing: "0.08em" }}>
                <span>{Math.round(total.kcal)} KCAL</span>
                <span><span style={{ color: NP.protein }}>{Math.round(total.protein)}P</span> · <span style={{ color: NP.carbs }}>{Math.round(total.carbs)}C</span> · <span style={{ color: NP.fat }}>{Math.round(total.fat)}F</span></span>
              </div>
            )}
            {estimate.warning === "large" && <div style={{ color: NP.warn, fontSize: 11 }}>That's a lot of food for one entry — is this right?</div>}
          </div>
        )}

        <span style={{ fontSize: 11, color: NP.dim, lineHeight: 1.5 }}>Tap ½× or 2× to fix the amount. Your coach sees everything you add here.</span>
        {estimate && estimate.items.length > 0 ? (
          <button onClick={addToToday} style={npButton("fill", { height: 52 })}>ADD TO TODAY</button>
        ) : (
          <button onClick={saveWithoutEstimate} disabled={!text.trim()} style={npButton("outline", { height: 52 })}>SAVE WITHOUT ESTIMATE</button>
        )}
      </div>
    </div>
  );
}

// Full plan, read-only (spec §6.7). Deliberately compact - a proper
// DOWNLOAD PDF button arrives with the PDF export phase; this is the
// in-app fallback so "View my full plan" is never a dead link.
function MyPlanSheet({ client, signedPlan, onClose }) {
  const [dayIdx, setDayIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const doc = signedPlan.doc;
  const day = doc.days[Math.min(dayIdx, doc.days.length - 1)];

  async function downloadPdf() {
    setDownloading(true);
    try {
      const blob = await buildNutritionPlanPDF(client, signedPlan);
      await sharePdfBlob(blob, `Forge-Nutrition-Plan-${safeFilename(client.name)}-v${signedPlan.version}.pdf`, doc.name);
    } catch (e) {
      showToast(e.message || "Couldn't build the PDF.", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, background: NP.bg, overflow: "auto", fontFamily: NP.font, color: NP.text }}>
      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} aria-label="Back" style={{ width: 44, height: 44, borderRadius: 12, background: NP.card, border: `1px solid ${NP.line}`, color: NP.text, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>‹</button>
          <span style={{ fontSize: 20, letterSpacing: "0.08em", flex: 1 }}>{doc.name}</span>
          <button onClick={downloadPdf} disabled={downloading} style={npButton("outline", { fontSize: 10, height: 40 })}>{downloading ? "BUILDING…" : "DOWNLOAD PDF"}</button>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {doc.days.map((d, i) => (
            <button key={d.id} onClick={() => setDayIdx(i)} style={{ flexShrink: 0, height: 36, padding: "0 14px", borderRadius: 8, border: 0, background: i === dayIdx ? NP.text : NP.card2, color: i === dayIdx ? "#000000" : NP.muted, fontSize: 11, letterSpacing: "0.1em", fontWeight: 700, cursor: "pointer" }}>{d.name}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: NP.muted, letterSpacing: "0.08em" }}>{day.targets.kcal || 0} KCAL · {day.targets.protein || 0}P / {day.targets.carbs || 0}C / {day.targets.fat || 0}F</div>
        {(day.blocks || []).filter((b) => b.type === "meal").map((meal) => (
          <div key={meal.id} style={npCard({ padding: 14 })}>
            <div style={{ fontSize: 13, letterSpacing: "0.08em", color: NP.text, marginBottom: 6 }}>{meal.time} · {meal.name}</div>
            <div style={{ fontSize: 12, color: NP.muted }}>{meal.items.map(itemLine).join(" · ") || "No foods yet"}</div>
          </div>
        ))}
        {doc.settings.showGuidelines && doc.guidelines?.length > 0 && (
          <div style={npCard({ padding: 14 })}>
            <div style={npLabel({ marginBottom: 8 })}>GUIDELINES</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: NP.muted, fontSize: 12, lineHeight: 1.7 }}>{doc.guidelines.map((g, i) => <li key={i}>{g}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Client-facing tracking_mode === "prescribed_plan" tab (spec §6). Every
// write goes through persistDayLog below - one upsertSection call per
// change, riding the app's existing offline-queue layer (upsertSection ->
// enqueueSync/flushSyncQueue in lib/cache.js) rather than a new IndexedDB
// mechanism, per the recon decision.
export function FuelFlow({ client, updateClient }) {
  const today = isoDate();
  const [dateISO, setDateISO] = useState(today);
  const [openMealId, setOpenMealId] = useState(null);
  const [showExtras, setShowExtras] = useState(false);
  const [extrasSeed, setExtrasSeed] = useState("");
  const [showPlan, setShowPlan] = useState(false);
  const [undoBanner, setUndoBanner] = useState(null);
  const undoTimerRef = useRef(null);

  const nutritionPlan = client.nutritionPlan;
  const logs = useMemo(() => client.nutritionPlanLogs || {}, [client.nutritionPlanLogs]);
  const dayLog = planDayLogFor(logs, dateISO);
  const signedPlan = resolveSignedPlan(nutritionPlan, dayLog);
  const day = resolveDayForDate(signedPlan, dayLog, dateISO);

  const daysBack = (new Date(`${today}T00:00:00`) - new Date(`${dateISO}T00:00:00`)) / 86400000;
  const editable = signedPlan && dateISO <= today && daysBack <= EDIT_WINDOW_DAYS;
  const beforeStart = signedPlan && dateISO < signedPlan.startDate;

  const openMeal = openMealId && day ? (day.blocks || []).find((b) => b.id === openMealId && b.type === "meal") : null;

  async function persistDayLog(nextDayLog) {
    const nextLogs = { ...logs, [dateISO]: nextDayLog };
    updateClient({ ...client, nutritionPlanLogs: nextLogs });
    await savePlanLogs(client.id, nextLogs);
  }
  function baseLogPatch() {
    return { dayId: dayLog.dayId || day.id, planVersion: dayLog.planVersion || signedPlan.version, plannedItemCount: dayLog.plannedItemCount || allMealItems(day).length };
  }

  async function tick(item) {
    await persistDayLog({ ...dayLog, ...baseLogPatch(), entries: { ...dayLog.entries, [item.id]: entryFromEatenItem(item) } });
  }
  async function untick(item) {
    const entries = { ...dayLog.entries };
    delete entries[item.id];
    await persistDayLog({ ...dayLog, entries });
  }
  async function swap(item, swapOption) {
    await persistDayLog({ ...dayLog, ...baseLogPatch(), entries: { ...dayLog.entries, [item.id]: entryFromSwap(swapOption) } });
  }
  async function portion(meal, pct) {
    const entries = { ...dayLog.entries };
    meal.items.forEach((it) => { if (entries[it.id] && entries[it.id].status !== "skipped") entries[it.id] = entryFromEatenItem(it, pct); });
    await persistDayLog({ ...dayLog, ...baseLogPatch(), entries });
  }
  async function skipMeal(meal) {
    if (!await confirmDialog(`Mark ${meal.name} as skipped?`, { confirmLabel: "Skip meal" })) return;
    const entries = { ...dayLog.entries };
    meal.items.forEach((it) => { entries[it.id] = skippedEntry(); });
    await persistDayLog({ ...dayLog, ...baseLogPatch(), entries });
    setOpenMealId(null);
  }
  async function ateAsPlanned(meal) {
    const prevEntries = { ...dayLog.entries };
    const entries = { ...dayLog.entries };
    meal.items.forEach((it) => { entries[it.id] = entryFromEatenItem(it); });
    await persistDayLog({ ...dayLog, ...baseLogPatch(), entries });
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    showToast(`${meal.name} LOGGED`, "success");
    clearTimeout(undoTimerRef.current);
    setUndoBanner({ mealName: meal.name, prevEntries });
    undoTimerRef.current = setTimeout(() => setUndoBanner(null), 5000);
  }
  async function undoLast() {
    if (!undoBanner) return;
    clearTimeout(undoTimerRef.current);
    await persistDayLog({ ...dayLog, entries: undoBanner.prevEntries });
    setUndoBanner(null);
  }
  async function addExtras(entries) {
    await persistDayLog({ ...dayLog, ...baseLogPatch(), extras: [...(dayLog.extras || []), ...entries] });
    setShowExtras(false);
    setExtrasSeed("");
    showToast("Added to today.", "success");
  }

  const recentExtras = useMemo(() => {
    const seen = new Map();
    Object.values(logs).forEach((l) => (l.extras || []).forEach((e) => {
      if (!e.estimate?.items?.length) return;
      const key = e.rawText.toLowerCase();
      if (!seen.has(key) || new Date(e.loggedAt) > new Date(seen.get(key).loggedAt)) seen.set(key, e);
    }));
    return [...seen.values()].sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt)).slice(0, 6).map((e) => ({ rawText: e.rawText, items: e.estimate.items }));
  }, [logs]);

  if (!signedPlan) {
    return (
      <div style={{ ...npCard({ padding: 20 }), color: NP.muted, fontSize: 13, fontFamily: NP.font }}>Your coach hasn't assigned a nutrition plan yet.</div>
    );
  }
  if (beforeStart) {
    return (
      <div style={{ ...npCard({ padding: 20 }), color: NP.muted, fontSize: 13, fontFamily: NP.font }}>Your plan starts {new Date(`${signedPlan.startDate}T00:00:00`).toLocaleDateString()}.</div>
    );
  }
  if (!day) {
    return (
      <div style={{ ...npCard({ padding: 20 }), color: NP.muted, fontSize: 13, fontFamily: NP.font }}>No day is scheduled for this date.</div>
    );
  }

  const mealStates = computeMealStates(day, dayLog);
  const nowHHMM = nowHHMMFor(dateISO, today);
  const applicable = mealStates.filter(({ meal, entries }) => meal.time <= nowHHMM || entries.some(Boolean));
  const chipNum = applicable.filter(({ state }) => state === "logged" || state === "swapped" || state === "partial_portion").length;
  const chipDen = applicable.length;
  const totals = loggedDayTotals(day, dayLog);

  return (
    <div style={{ fontFamily: NP.font, color: NP.text, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setDateISO(addDaysISO(dateISO, -1))} aria-label="Previous day" style={{ background: "none", border: "none", color: NP.dim, fontSize: 14, cursor: "pointer", padding: "2px 4px" }}>‹</button>
            <span style={{ fontSize: 10, letterSpacing: "0.16em", color: NP.dim }}>{fmtHeaderDate(dateISO)} · {day.type.toUpperCase()} DAY</span>
            <button onClick={() => setDateISO(addDaysISO(dateISO, 1))} aria-label="Next day" style={{ background: "none", border: "none", color: NP.dim, fontSize: 14, cursor: "pointer", padding: "2px 4px" }}>›</button>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "0.08em" }}>FUEL</h1>
        </div>
        {chipDen > 0 && <span style={{ fontSize: 10, letterSpacing: "0.12em", color: chipNum === chipDen ? NP.good : NP.muted, border: `1px solid ${chipNum === chipDen ? "#1f4d36" : NP.line}`, borderRadius: 999, padding: "6px 10px" }}>{chipNum} / {chipDen} ON PLAN</span>}
      </header>

      <section aria-label="Today's totals" style={npCard({ padding: "16px 10px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 4 })}>
        <Ring value={totals.kcal} target={day.targets.kcal} color={NP.kcal} unitLabel="KCAL" />
        <Ring value={totals.protein} target={day.targets.protein} color={NP.protein} unitLabel="G P" />
        <Ring value={totals.carbs} target={day.targets.carbs} color={NP.carbs} unitLabel="G C" />
        <Ring value={totals.fat} target={day.targets.fat} color={NP.fat} unitLabel="G F" />
      </section>

      {mealStates.map((row) => (
        <MealCard key={row.meal.id} row={row} editable={editable} onOpen={(meal) => setOpenMealId(meal.id)} onAtePlanned={ateAsPlanned} />
      ))}

      {undoBanner && (
        <div style={{ ...npCard({ padding: "10px 14px" }), display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: NP.muted }}>{undoBanner.mealName} logged.</span>
          <button onClick={undoLast} style={npButton("ghost", { fontSize: 11, height: 32, padding: "0 10px" })}>UNDO</button>
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 12, letterSpacing: "0.16em" }}>EXTRAS</h2>
          <span style={{ fontSize: 10, letterSpacing: "0.12em", color: NP.dim }}>ANYTHING NOT ON YOUR PLAN</span>
        </div>
        {(dayLog.extras || []).map((e) => (
          <div key={e.id} style={{ ...npCard({ padding: "12px 14px" }), display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13 }}>{e.estimate?.items?.[0]?.name || e.rawText}</span>
              <span style={{ fontSize: 10, letterSpacing: "0.12em", color: NP.dim }}>{new Date(e.loggedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })} · {e.pendingEstimate ? "WAITING FOR ESTIMATE" : "ESTIMATED"}</span>
            </div>
            <span style={{ fontSize: 12, color: NP.muted }}>{Math.round(extraTotals(e).kcal)} KCAL</span>
          </div>
        ))}
        {editable && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, height: 52, boxSizing: "border-box", padding: "0 6px 0 14px", background: NP.card, border: `1px dashed ${NP.lineDashed}`, borderRadius: 14 }}>
            <input value={extrasSeed} onChange={(e) => setExtrasSeed(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setShowExtras(true)} placeholder="Type what you had, e.g. 2 dates" aria-label="Add something not on your plan" style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, color: NP.text, fontSize: 13, outline: "none" }} />
            <button onClick={() => setShowExtras(true)} aria-label="Add extra" style={{ width: 40, height: 40, borderRadius: 10, background: NP.card2, border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: NP.text, cursor: "pointer" }}>+</button>
          </label>
        )}
      </section>

      <button onClick={() => setShowPlan(true)} style={{ background: "none", border: "none", color: NP.muted, fontSize: 11, letterSpacing: "0.1em", textAlign: "center", padding: "4px 0", cursor: "pointer" }}>VIEW MY FULL PLAN</button>

      {openMeal && (
        <MealDetailSheet meal={openMeal} dayLog={dayLog} editable={editable}
          onClose={() => setOpenMealId(null)}
          onTick={tick} onUntick={untick}
          onSkip={() => skipMeal(openMeal)}
          onPortion={(pct) => portion(openMeal, pct)}
          onSwap={swap}
        />
      )}
      {showExtras && <ExtrasSheet recent={recentExtras} seed={extrasSeed} onClose={() => setShowExtras(false)} onAdd={addExtras} />}
      {showPlan && <MyPlanSheet client={client} signedPlan={signedPlan} onClose={() => setShowPlan(false)} />}
    </div>
  );
}
