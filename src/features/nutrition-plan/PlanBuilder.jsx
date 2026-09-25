import { useEffect, useMemo, useRef, useState } from "react";
import { NP, npCard, npInput, npButton, npLabel, NPToggle } from "./theme.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { uid } from "../../lib/uid.js";
import { loadPlanTemplates, savePlanTemplates, loadFoodLibrary, saveFoodLibrary } from "../../lib/nutritionPlan.js";
import {
  newPlanDay, newMealBlock, newMealItem, foodRefFromRow, DAY_TYPES,
} from "./planModel.js";
import { mealTotals, dayTotals, targetStatus, barPct, fmtKcal, roundMacros } from "./planMath.js";

const HISTORY_LIMIT = 50;
const AUTOSAVE_MS = 1500;

function sheetStyle() {
  return { position: "fixed", inset: 0, zIndex: 1200, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.6)" };
}
function Sheet({ onClose, children, maxHeight = "80vh" }) {
  return (
    <div style={sheetStyle()} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight, overflow: "auto", boxSizing: "border-box", padding: "12px 16px 24px", background: NP.card, borderTop: `1px solid ${NP.lineDashed}`, borderRadius: "24px 24px 0 0", fontFamily: NP.font }}>
        <div style={{ width: 40, height: 4, borderRadius: 999, background: NP.lineDashed, margin: "4px auto 14px" }} />
        {children}
      </div>
    </div>
  );
}

// ---------- day total card ----------
function DayTotalCard({ totals, targets }) {
  const status = targetStatus(totals, targets);
  const statusColor = status.level === "good" ? NP.good : status.level === "warn" ? NP.warn : "#FF5C5C";
  return (
    <div style={npCard({ padding: "18px 20px", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" })}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 140, flexShrink: 0 }}>
        <div style={npLabel()}>DAY TOTAL</div>
        <div style={{ fontSize: 28, color: NP.text, letterSpacing: "0.02em" }}>{fmtKcal(totals.kcal)}</div>
        <div style={{ fontSize: 11, color: NP.muted, letterSpacing: "0.1em" }}>OF {fmtKcal(targets.kcal || 0)} KCAL</div>
      </div>
      <div style={{ flex: 1, minWidth: 220, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16 }}>
        {[["PROTEIN", totals.protein, targets.protein, NP.protein], ["CARBS", totals.carbs, targets.carbs, NP.carbs], ["FAT", totals.fat, targets.fat, NP.fat]].map(([label, total, target, color]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: "0.1em" }}>
              <span style={{ color: NP.muted }}>{label}</span><span style={{ color: NP.text }}>{Math.round(total)} / {target || 0} G</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: NP.card2 }}><div style={{ height: 8, borderRadius: 999, width: `${barPct(total, target)}%`, background: color }} /></div>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 10, letterSpacing: "0.12em", color: statusColor, border: `1px solid ${statusColor}`, borderRadius: 999, padding: "6px 10px", flexShrink: 0 }}>{status.label}</span>
    </div>
  );
}

// ---------- food search row (add food to a meal) ----------
function FoodSearch({ foods, onPick, onCreateNew }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    const scored = foods.filter((f) => !f.archived && (f.name.toLowerCase().includes(q) || (f.brand || "").toLowerCase().includes(q)));
    scored.sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1, bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return ap - bp || a.name.localeCompare(b.name);
    });
    return scored.slice(0, 8);
  }, [foods, q]);

  function pick(food) { onPick(food); setQuery(""); setActive(0); }
  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (active < matches.length) pick(matches[active]);
      else if (q) { onCreateNew(query.trim()); setQuery(""); }
    }
  }
  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px", background: "#000000", border: `1px solid ${NP.line}`, borderRadius: NP.radiusControl, color: NP.dim }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown} placeholder="ADD FOOD — SEARCH YOUR FOODS DATABASE" aria-label="Add food" style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, color: NP.text, fontSize: 12, letterSpacing: "0.08em", outline: "none", fontFamily: NP.font, fontWeight: 700 }} />
      </label>
      {q && (
        <div style={npCard({ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 10, padding: 6, background: NP.panel, maxHeight: 260, overflow: "auto" })}>
          {matches.map((f, i) => (
            <button key={f.id} onClick={() => pick(f)} onMouseEnter={() => setActive(i)} style={{ display: "flex", justifyContent: "space-between", width: "100%", textAlign: "left", background: i === active ? NP.card2 : "transparent", border: "none", color: NP.text, fontFamily: NP.font, fontSize: 13, padding: "9px 10px", borderRadius: 8, cursor: "pointer" }}>
              <span>{f.name}{f.state ? `, ${f.state}` : ""}</span><span style={{ color: NP.dim, fontSize: 11 }}>{f.kcal} kcal/100{f.unit === "ml" ? "ml" : "g"}</span>
            </button>
          ))}
          <button onClick={() => { onCreateNew(query.trim()); setQuery(""); }} style={{ display: "block", width: "100%", textAlign: "left", background: matches.length === 0 ? NP.card2 : "transparent", border: "none", color: NP.text, fontFamily: NP.font, fontSize: 13, padding: "9px 10px", borderRadius: 8, cursor: "pointer" }}>+ CREATE "{query.trim()}"</button>
        </div>
      )}
    </div>
  );
}

// ---------- meal block ----------
function MealBlockCard({ block, index, total, selected, expanded, onSelect, onToggleExpand, foods, onChange, onMove, onDuplicate, onDelete, isFirst, isLast, onQuickCreateFood }) {
  const totals = mealTotals(block);
  const items = block.items;

  function addItem(foodRow) {
    onChange({ ...block, items: [...items, newMealItem(foodRefFromRow(foodRow))] });
  }
  function updateAmount(itemId, amount) {
    onChange({ ...block, items: items.map((it) => (it.id === itemId ? { ...it, amount: Number(amount) || 0 } : it)) });
  }
  function removeItem(itemId) {
    onChange({ ...block, items: items.filter((it) => it.id !== itemId) });
  }
  function refreshFromLibrary() {
    const byId = Object.fromEntries(foods.map((f) => [f.id, f]));
    onChange({ ...block, items: items.map((it) => (byId[it.food.foodId] ? { ...it, food: foodRefFromRow(byId[it.food.foodId]) } : it)) });
    showToast("Refreshed food values from your library.", "success");
  }
  async function handleDelete() {
    if (items.length > 0 && !await confirmDialog(`Delete "${block.name}"? It has ${items.length} food${items.length === 1 ? "" : "s"} in it.`, { danger: true, confirmLabel: "Delete" })) return;
    onDelete();
  }

  return (
    <div style={npCard({ padding: 0, overflow: "hidden", borderColor: selected ? NP.text : NP.line })}>
      <div onClick={onToggleExpand} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", borderBottom: expanded ? `1px solid ${NP.line}` : "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move up" style={{ background: "none", border: "none", color: isFirst ? NP.line : NP.dim, cursor: isFirst ? "default" : "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
          <button onClick={() => onMove(1)} disabled={isLast} aria-label="Move down" style={{ background: "none", border: "none", color: isLast ? NP.line : NP.dim, cursor: isLast ? "default" : "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
        </div>
        <input value={block.time} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange({ ...block, time: e.target.value })} style={{ width: 48, background: "transparent", border: "none", color: NP.dim, fontSize: 11, letterSpacing: "0.12em", fontFamily: NP.font, fontWeight: 700, outline: "none" }} />
        <input value={block.name} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange({ ...block, name: e.target.value.toUpperCase() })} style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", color: NP.text, fontSize: 16, letterSpacing: "0.08em", fontFamily: NP.font, fontWeight: 700, outline: "none" }} />
        {block.showTotals && (
          <div style={{ display: "flex", gap: 12, fontSize: 11, letterSpacing: "0.08em", color: NP.muted, flexShrink: 0 }}>
            <span><span style={{ color: NP.text }}>{Math.round(totals.kcal)}</span> KCAL</span>
            <span style={{ color: NP.protein }}>{Math.round(totals.protein)}P</span>
            <span style={{ color: NP.carbs }}>{Math.round(totals.carbs)}C</span>
            <span style={{ color: NP.fat }}>{Math.round(totals.fat)}F</span>
          </div>
        )}
        <button onClick={(e) => { e.stopPropagation(); onSelect(); }} aria-label="Block settings" style={{ background: "none", border: "none", color: NP.dim, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>⚙</button>
      </div>

      {!expanded && items.length > 0 && (
        <div style={{ padding: "0 16px 14px 72px", fontSize: 12, letterSpacing: "0.06em", color: NP.muted }}>
          {items.map((it) => `${it.food.name.toUpperCase()} ${it.amount}${it.food.unit === "piece" ? "" : it.food.unit.toUpperCase()}`).join(" · ")}
        </div>
      )}

      {expanded && (
        <>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 56px 40px 40px 40px 32px", gap: 8, padding: "10px 16px", fontSize: 9, letterSpacing: "0.14em", color: NP.dim }}>
                <span>FOOD</span><span>AMOUNT</span><span style={{ textAlign: "right" }}>KCAL</span><span style={{ textAlign: "right" }}>P</span><span style={{ textAlign: "right" }}>C</span><span style={{ textAlign: "right" }}>F</span><span />
              </div>
            )}
            {items.map((it) => {
              const factor = (it.food.unit === "piece" ? it.amount * (it.food.pieceGrams || 0) : it.amount) / 100;
              const m = { kcal: it.food.per100.kcal * factor, protein: it.food.per100.protein * factor, carbs: it.food.per100.carbs * factor, fat: it.food.per100.fat * factor };
              return (
                <div key={it.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 56px 40px 40px 40px 32px", gap: 8, alignItems: "center", padding: "0 16px", height: 46, borderTop: `1px solid ${NP.card2}`, fontSize: 13 }}>
                  <span style={{ color: NP.text, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.food.name.toUpperCase()}{it.food.state ? `, ${it.food.state.toUpperCase()}` : ""}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", height: 30, padding: "0 8px", background: NP.card2, borderRadius: 8, gap: 4 }}>
                    <input value={it.amount} onChange={(e) => updateAmount(it.id, e.target.value)} inputMode="decimal" style={{ width: 36, background: "transparent", border: 0, color: NP.text, fontFamily: NP.font, fontWeight: 700, fontSize: 12, outline: "none" }} />
                    <span style={{ color: NP.dim, fontSize: 10 }}>{it.food.unit === "piece" ? (it.amount === 1 ? "pc" : "pcs") : it.food.unit.toUpperCase()}</span>
                  </span>
                  <span style={{ textAlign: "right", color: NP.text }}>{Math.round(m.kcal)}</span>
                  <span style={{ textAlign: "right", color: NP.muted }}>{Math.round(m.protein)}</span>
                  <span style={{ textAlign: "right", color: NP.muted }}>{Math.round(m.carbs)}</span>
                  <span style={{ textAlign: "right", color: NP.muted }}>{Math.round(m.fat)}</span>
                  <button onClick={() => removeItem(it.id)} aria-label={`Remove ${it.food.name}`} style={{ width: 28, height: 28, background: "none", border: 0, color: NP.dim, cursor: "pointer" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "14px 16px", borderTop: `1px solid ${NP.line}` }}>
            <FoodSearch foods={foods} onPick={addItem} onCreateNew={onQuickCreateFood} />
          </div>
        </>
      )}

      {expanded && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 16px 14px" }}>
          <button onClick={refreshFromLibrary} style={npButton("ghost", { fontSize: 10, height: 32, padding: "0 10px" })}>REFRESH VALUES FROM LIBRARY</button>
          <button onClick={onDuplicate} style={npButton("ghost", { fontSize: 10, height: 32, padding: "0 10px" })}>DUPLICATE</button>
          <button onClick={handleDelete} style={npButton("ghost", { fontSize: 10, height: 32, padding: "0 10px", color: "#FF6B61" })}>DELETE</button>
        </div>
      )}
    </div>
  );
}

// ---------- add block palette (left column desktop / sheet mobile) ----------
const BLOCK_PALETTE = [
  ["meal", "MEAL", true],
  ["swaps", "SWAPS", false], ["note", "COACH NOTE", false], ["education", "EDUCATION", false],
  ["supplement", "SUPPLEMENT", false], ["hydration", "HYDRATION", false], ["photo", "PHOTO", false], ["divider", "DIVIDER", false],
];
function AddBlockPalette({ onAdd }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
      {BLOCK_PALETTE.map(([type, label, enabled]) => (
        <button key={type} disabled={!enabled} onClick={() => enabled && onAdd(type)} title={enabled ? "" : "Coming in a later phase"}
          style={{ height: 64, background: NP.card, border: `1px solid ${NP.line}`, borderRadius: 12, color: enabled ? NP.text : NP.line, fontFamily: NP.font, fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.5 }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function DailyTargetsPanel({ day, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[["kcal", "KCAL", NP.kcal], ["protein", "PROTEIN", NP.protein], ["carbs", "CARBS", NP.carbs], ["fat", "FAT", NP.fat]].map(([key, label, color]) => (
        <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: NP.card, border: `1px solid ${NP.line}`, borderRadius: 10, padding: "0 12px", height: 44, fontSize: 11, letterSpacing: "0.1em", color: NP.muted }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />{label}</span>
          <input value={day.targets[key] || ""} onChange={(e) => onChange({ ...day, targets: { ...day.targets, [key]: Number(e.target.value) || 0 } })} inputMode="numeric" style={{ width: 70, background: "transparent", border: 0, color: NP.text, fontSize: 15, textAlign: "right", fontFamily: NP.font, fontWeight: 700, outline: "none" }} />
        </label>
      ))}
      <div style={{ fontSize: 11, color: NP.dim, lineHeight: 1.5 }}>Each day has its own targets. Switch days to edit theirs.</div>
      <button onClick={() => { const p = day.targets.protein || 0, c = day.targets.carbs || 0, f = day.targets.fat || 0; onChange({ ...day, targets: { ...day.targets, kcal: 4 * p + 4 * c + 9 * f } }); }} style={npButton("ghost", { fontSize: 10, height: 32, padding: "0 10px", alignSelf: "start" })}>FILL KCAL FROM MACROS</button>
    </div>
  );
}

function BlockSettingsPanel({ block, onChange }) {
  if (!block) return <div style={{ color: NP.dim, fontSize: 12 }}>Select a block to edit its settings.</div>;
  if (block.type !== "meal") return <div style={{ color: NP.dim, fontSize: 12 }}>This block type's settings arrive in a later phase.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={npLabel()}>BLOCK SETTINGS · {block.name}</div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 10, letterSpacing: "0.14em", color: NP.muted }}>NAME
        <input value={block.name} onChange={(e) => onChange({ ...block, name: e.target.value.toUpperCase() })} style={npInput()} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 10, letterSpacing: "0.14em", color: NP.muted }}>TIME
        <input value={block.time} onChange={(e) => onChange({ ...block, time: e.target.value })} style={npInput()} />
      </label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 40, fontSize: 12, letterSpacing: "0.08em", color: NP.text }}>
        <span>SHOW MEAL TOTALS</span><NPToggle checked={block.showTotals} onChange={(v) => onChange({ ...block, showTotals: v })} label="Show meal totals" />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 40, fontSize: 12, letterSpacing: "0.08em", color: NP.text }}>
        <span>CLIENT CAN SWAP FOODS</span><NPToggle checked={block.allowSwaps} onChange={(v) => onChange({ ...block, allowSwaps: v })} label="Client can swap foods" />
      </div>
    </div>
  );
}

function PlanSettingsPanel({ doc, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={npLabel()}>ADDED TO THIS PLAN</div>
      <div style={npCard({ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 })}>
        <div><div style={{ fontSize: 12, letterSpacing: "0.08em", color: NP.text }}>STUDIO GUIDELINES</div><div style={{ fontSize: 11, color: NP.dim, marginTop: 4 }}>Your house rules, set once in Settings</div></div>
        <NPToggle checked={doc.settings.showGuidelines} onChange={(v) => onChange({ ...doc, settings: { ...doc.settings, showGuidelines: v } })} label="Studio guidelines" />
      </div>
      <div style={npCard({ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 })}>
        <div><div style={{ fontSize: 12, letterSpacing: "0.08em", color: NP.text }}>GROCERY LIST</div><div style={{ fontSize: 11, color: NP.dim, marginTop: 4 }}>Built automatically from every meal</div></div>
        <NPToggle checked={doc.settings.showGrocery} onChange={(v) => onChange({ ...doc, settings: { ...doc.settings, showGrocery: v } })} label="Grocery list" />
      </div>
    </div>
  );
}

// ==================== main builder ====================
export function PlanBuilder({ trainerId, templateId, onExit, onSelectTemplate }) {
  const isCompact = useIsMobile(1024);
  const [templates, setTemplates] = useState(null);
  const [foods, setFoods] = useState([]);
  const [entry, setEntry] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [expandedBlockId, setExpandedBlockId] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [mobileSheet, setMobileSheet] = useState(null); // 'add'|'targets'|'settings'|'templates'|null
  const [dayMenuOpen, setDayMenuOpen] = useState(false);

  const historyRef = useRef({ stack: [], index: -1 });
  const saveTimerRef = useRef(null);
  const pendingDocRef = useRef(null);
  const templatesRef = useRef([]);
  useEffect(() => { templatesRef.current = templates || []; }, [templates]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, library] = await Promise.all([loadPlanTemplates(trainerId), loadFoodLibrary(trainerId)]);
      if (cancelled) return;
      setTemplates(list);
      setFoods(library);
      const found = list.find((t) => t.id === templateId);
      if (found) {
        setEntry(found);
        historyRef.current = { stack: [found.doc], index: 0 };
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainerId, templateId]);

  // warn on leaving with unsaved changes
  useEffect(() => {
    function onBeforeUnload(e) { if (saveStatus === "draft" || saveStatus === "saving") { e.preventDefault(); e.returnValue = ""; } }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

  // flush on blur (tab/window loses focus), per spec §5.2
  useEffect(() => {
    function onBlur() { if (saveTimerRef.current) flushSave(); }
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flushSave() {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const docToSave = pendingDocRef.current;
    if (!docToSave || !entry) return;
    setSaveStatus("saving");
    const list = templatesRef.current;
    const next = list.map((t) => (t.id === entry.id ? { ...t, doc: docToSave, name: docToSave.name, updatedAt: new Date().toISOString() } : t));
    setTemplates(next);
    const result = await savePlanTemplates(trainerId, next);
    setSaveStatus(result?.queued ? "offline" : "saved");
  }
  function scheduleAutosave(nextDoc) {
    pendingDocRef.current = nextDoc;
    setSaveStatus("draft");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, AUTOSAVE_MS);
  }
  function applyDoc(nextDoc, { skipHistory = false } = {}) {
    setEntry((e) => ({ ...e, doc: nextDoc }));
    if (!skipHistory) {
      const h = historyRef.current;
      const trimmed = h.stack.slice(0, h.index + 1);
      const stack = [...trimmed, nextDoc].slice(-HISTORY_LIMIT);
      historyRef.current = { stack, index: stack.length - 1 };
    }
    scheduleAutosave(nextDoc);
  }
  function undo() {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    setEntry((e) => ({ ...e, doc: h.stack[h.index] }));
    scheduleAutosave(h.stack[h.index]);
  }
  function redo() {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    setEntry((e) => ({ ...e, doc: h.stack[h.index] }));
    scheduleAutosave(h.stack[h.index]);
  }
  useEffect(() => {
    function onKeyDown(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doc = entry?.doc;
  const day = doc?.days?.[Math.min(dayIdx, (doc?.days.length || 1) - 1)];
  const selectedBlock = day?.blocks.find((b) => b.id === selectedBlockId) || null;

  function patchDoc(patch) { applyDoc({ ...doc, ...patch }); }
  function patchDay(patch) { applyDoc({ ...doc, days: doc.days.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d)) }); }
  function patchBlock(blockId, next) { patchDay({ blocks: day.blocks.map((b) => (b.id === blockId ? next : b)) }); }

  function addDay(mode) {
    const newDay = mode === "duplicate" ? { ...day, id: uid(), name: `DAY ${doc.days.length + 1}` } : newPlanDay(`DAY ${doc.days.length + 1}`);
    applyDoc({ ...doc, days: [...doc.days, newDay] });
    setDayIdx(doc.days.length);
  }
  async function deleteDay(i) {
    if (doc.days.length <= 1) { showToast("A plan needs at least one day.", "warn"); return; }
    if (!await confirmDialog(`Delete "${doc.days[i].name}"?`, { danger: true, confirmLabel: "Delete" })) return;
    applyDoc({ ...doc, days: doc.days.filter((_, di) => di !== i) });
    setDayIdx(Math.max(0, i - 1));
    setDayMenuOpen(false);
  }
  function moveDay(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= doc.days.length) return;
    const next = [...doc.days];
    [next[i], next[j]] = [next[j], next[i]];
    applyDoc({ ...doc, days: next });
    setDayIdx(j);
  }

  function addBlock(type) {
    if (type !== "meal") return;
    const block = newMealBlock("MEAL", "12:00");
    patchDay({ blocks: [...day.blocks, block] });
    setExpandedBlockId(block.id);
    setSelectedBlockId(block.id);
    setMobileSheet(null);
  }
  function moveBlock(blockId, dir) {
    const i = day.blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (j < 0 || j >= day.blocks.length) return;
    const next = [...day.blocks];
    [next[i], next[j]] = [next[j], next[i]];
    patchDay({ blocks: next });
  }
  function duplicateBlock(blockId) {
    const block = day.blocks.find((b) => b.id === blockId);
    const copy = { ...block, id: uid(), items: block.items.map((it) => ({ ...it, id: uid() })) };
    const i = day.blocks.findIndex((b) => b.id === blockId);
    const next = [...day.blocks]; next.splice(i + 1, 0, copy);
    patchDay({ blocks: next });
  }
  function deleteBlock(blockId) {
    patchDay({ blocks: day.blocks.filter((b) => b.id !== blockId) });
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }

  function quickCreateFood(name) {
    // Minimal inline add: goes straight into the library with 0 macros,
    // then adds it to the meal - the coach fills in real numbers via the
    // Foods screen or by editing there next. Keeps the builder from
    // stalling on a full food form mid-meal-edit.
    const newFood = { id: uid(), name, brand: "", state: null, category: "other", unit: "g", pieceGrams: null, kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: null, groceryName: null, groceryFactor: 1, archived: false };
    const nextFoods = [newFood, ...foods];
    setFoods(nextFoods);
    saveFoodLibrary(trainerId, nextFoods);
    showToast(`Added "${name}" to your library with 0 macros - edit it in Foods when you have real numbers.`, "warn");
    return newFood;
  }

  if (!templates) return <div style={{ color: NP.muted, padding: 24, fontFamily: NP.font }}>Loading…</div>;
  if (!entry) return (
    <div style={{ padding: 24, fontFamily: NP.font, color: NP.muted }}>
      <button onClick={onExit} style={npButton("ghost", { marginBottom: 16 })}>‹ BACK</button>
      <div>That plan couldn't be found.</div>
    </div>
  );

  const totals = dayTotals(day);
  const statusPill = { draft: ["DRAFT", NP.muted], saving: ["SAVING…", NP.muted], saved: ["SAVED", NP.good], offline: ["OFFLINE – NOT SAVED", "#FF6B61"] }[saveStatus];

  const centerContent = (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={npLabel()}>TEMPLATE · {doc.days.length} DAY{doc.days.length === 1 ? "" : "S"}</div>
          <input value={doc.name} onChange={(e) => patchDoc({ name: e.target.value })} style={{ background: "transparent", border: "none", outline: "none", color: NP.text, fontSize: isCompact ? 22 : 28, letterSpacing: "0.02em", fontFamily: NP.font, fontWeight: 700, padding: 0, width: "100%" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", background: NP.card, border: `1px solid ${NP.line}`, borderRadius: 12, padding: 4 }}>
        {doc.days.map((d, i) => (
          <button key={d.id} onClick={() => { setDayIdx(i); setSelectedBlockId(null); }} style={{ flexShrink: 0, height: 36, padding: "0 14px", border: 0, borderRadius: 8, background: i === dayIdx ? NP.text : "transparent", color: i === dayIdx ? "#000000" : NP.muted, fontSize: 11, letterSpacing: "0.1em", fontFamily: NP.font, fontWeight: 700, cursor: "pointer" }}>
            {d.name} · {d.type.toUpperCase()}
          </button>
        ))}
        <button onClick={() => addDay("blank")} style={{ flexShrink: 0, height: 36, padding: "0 14px", border: 0, borderRadius: 8, background: "transparent", color: NP.dim, fontSize: 11, letterSpacing: "0.1em", fontFamily: NP.font, fontWeight: 700, cursor: "pointer" }}>+ ADD DAY</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={day.type} onChange={(e) => patchDay({ type: e.target.value })} style={{ ...npInput({ width: "auto", height: 36 }) }}>
          {DAY_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <button onClick={() => addDay("duplicate")} style={npButton("ghost", { fontSize: 10, height: 36 })}>DUPLICATE DAY</button>
        <button onClick={() => moveDay(dayIdx, -1)} disabled={dayIdx === 0} style={npButton("ghost", { fontSize: 10, height: 36, opacity: dayIdx === 0 ? 0.4 : 1 })}>◂ MOVE</button>
        <button onClick={() => moveDay(dayIdx, 1)} disabled={dayIdx === doc.days.length - 1} style={npButton("ghost", { fontSize: 10, height: 36, opacity: dayIdx === doc.days.length - 1 ? 0.4 : 1 })}>MOVE ▸</button>
        <button onClick={() => deleteDay(dayIdx)} style={npButton("ghost", { fontSize: 10, height: 36, color: "#FF6B61" })}>DELETE DAY</button>
      </div>

      {isCompact && (
        <button onClick={() => setMobileSheet("targets")} style={npCard({ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", border: `1px solid ${NP.line}` })}>
          <span style={{ fontSize: 11, letterSpacing: "0.1em", color: NP.muted }}>DAILY TARGETS</span>
          <span style={{ fontSize: 12, color: NP.text }}>{day.targets.kcal || 0} KCAL · {day.targets.protein || 0}P / {day.targets.carbs || 0}C / {day.targets.fat || 0}F ›</span>
        </button>
      )}

      <DayTotalCard totals={totals} targets={day.targets} />

      {day.blocks.map((block, i) => (
        <MealBlockCard
          key={block.id} block={block} index={i} total={day.blocks.length}
          selected={selectedBlockId === block.id}
          expanded={expandedBlockId === block.id}
          onSelect={() => { setSelectedBlockId(block.id); if (isCompact) setMobileSheet("settings"); }}
          onToggleExpand={() => setExpandedBlockId(expandedBlockId === block.id ? null : block.id)}
          foods={foods}
          onChange={(next) => patchBlock(block.id, next)}
          onMove={(dir) => moveBlock(block.id, dir)}
          onDuplicate={() => duplicateBlock(block.id)}
          onDelete={() => deleteBlock(block.id)}
          isFirst={i === 0} isLast={i === day.blocks.length - 1}
          onQuickCreateFood={(name) => { const f = quickCreateFood(name); patchBlock(block.id, { ...block, items: [...block.items, newMealItem(foodRefFromRow(f))] }); }}
        />
      ))}

      <button onClick={() => (isCompact ? setMobileSheet("add") : addBlock("meal"))} style={{ height: 56, background: "transparent", border: `1px dashed ${NP.lineDashed}`, borderRadius: 16, color: NP.dim, fontSize: 12, letterSpacing: "0.14em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: NP.font, fontWeight: 700 }}>+ ADD BLOCK</button>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: NP.bg, fontFamily: NP.font }}>
      <header style={{ height: 60, boxSizing: "border-box", padding: "0 16px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${NP.line}`, background: NP.panel, flexWrap: "wrap" }}>
        <button onClick={() => { flushSave(); onExit(); }} aria-label="Back" style={npButton("ghost", { padding: "8px 10px", height: 36 })}>‹</button>
        <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: "0.1em", color: NP.dim, minWidth: 0, overflow: "hidden" }}>
          <span>TOOLS</span><span>/</span><span>NUTRITION PLANS</span><span>/</span><span style={{ color: NP.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</span>
        </nav>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, letterSpacing: "0.1em", color: statusPill[1], border: `1px solid ${NP.line}`, borderRadius: 999, padding: "5px 10px" }}>{statusPill[0]}</span>
        {!isCompact && <button onClick={undo} style={npButton("ghost", { fontSize: 10, height: 36 })}>UNDO</button>}
        {!isCompact && <button onClick={redo} style={npButton("ghost", { fontSize: 10, height: 36 })}>REDO</button>}
      </header>

      {isCompact ? (
        <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>{centerContent}</div>
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <aside style={{ width: 272, flexShrink: 0, boxSizing: "border-box", padding: "24px 20px", background: NP.panel, borderRight: `1px solid ${NP.line}`, display: "flex", flexDirection: "column", gap: 28, overflowY: "auto" }}>
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={npLabel()}>ADD BLOCK</div>
              <AddBlockPalette onAdd={addBlock} />
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={npLabel()}>DAILY TARGETS · {day.type.toUpperCase()} DAY</div>
              <DailyTargetsPanel day={day} onChange={patchDay} />
            </section>
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={npLabel()}>MY TEMPLATES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                {templates.filter((t) => !t.archived).map((t) => (
                  <button key={t.id} onClick={() => { if (t.id !== entry.id) { flushSave(); onSelectTemplate(t.id); } }} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 8, background: t.id === entry.id ? NP.card2 : "transparent", color: t.id === entry.id ? NP.text : NP.muted, border: "none", fontFamily: NP.font, fontWeight: 700, letterSpacing: "0.06em", cursor: "pointer" }}>{t.name.toUpperCase()}</button>
                ))}
              </div>
            </section>
          </aside>

          <main style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "28px 36px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
            {centerContent}
          </main>

          <aside style={{ width: 330, flexShrink: 0, boxSizing: "border-box", padding: "24px 20px", background: NP.panel, borderLeft: `1px solid ${NP.line}`, display: "flex", flexDirection: "column", gap: 28, overflowY: "auto" }}>
            <section><BlockSettingsPanel block={selectedBlock} onChange={(next) => patchBlock(selectedBlock.id, next)} /></section>
            <section><PlanSettingsPanel doc={doc} onChange={applyDoc} /></section>
          </aside>
        </div>
      )}

      {isCompact && mobileSheet === "add" && (
        <Sheet onClose={() => setMobileSheet(null)}>
          <div style={{ ...npLabel(), marginBottom: 12 }}>ADD BLOCK</div>
          <AddBlockPalette onAdd={addBlock} />
        </Sheet>
      )}
      {isCompact && mobileSheet === "targets" && (
        <Sheet onClose={() => setMobileSheet(null)}>
          <div style={{ ...npLabel(), marginBottom: 12 }}>DAILY TARGETS · {day.type.toUpperCase()} DAY</div>
          <DailyTargetsPanel day={day} onChange={patchDay} />
        </Sheet>
      )}
      {isCompact && mobileSheet === "settings" && (
        <Sheet onClose={() => setMobileSheet(null)}>
          <BlockSettingsPanel block={selectedBlock} onChange={(next) => patchBlock(selectedBlock.id, next)} />
          <div style={{ height: 20 }} />
          <PlanSettingsPanel doc={doc} onChange={applyDoc} />
        </Sheet>
      )}
    </div>
  );
}
