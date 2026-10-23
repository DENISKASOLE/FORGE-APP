import { useMemo, useState } from "react";
import { showToast } from "../../components/ui/Toast.jsx";
import { normalizeFoodRow, unitGramsFor, fatSecretFoodRow, MEAL_TYPES } from "./nutritionV2Model.js";
import { useFatSecretResults } from "../../lib/fatsecret.js";
import { FatSecretResultRow, FatSecretGroupLabel, FatSecretServingSheet } from "./FatSecretSearch.jsx";
import { NT, MACRO_COLORS } from "./nutritionV2Theme.js";
import { MacroBarRow } from "./NutritionRing.jsx";

const MEAL_TYPE_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", any: "Anytime" };
const STEP_UNITS = new Set(["g", "ml"]); // these step by 10; anything else (piece, a FatSecret serving label) steps by 1

function scale(perUnit, qty) {
  return { kcal: perUnit.kcal * qty, protein: perUnit.protein * qty, carbs: perUnit.carbs * qty, fat: perUnit.fat * qty };
}

// The client-facing meal builder: name it, tag when it's usually eaten,
// search and add ingredients one at a time with a live running total -
// same search (local library + FatSecret) as the regular food log, just
// composing a reusable meal instead of logging today's intake directly.
// Saving hands the finished {name, mealType, items} back to the caller,
// which persists it to nutrition_v2_meals (ClientFoodLogTab.jsx) -  this
// component never touches nutrition_v2_logs itself.
export function CreateMealSheet({ foods, onClose, onSave }) {
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState("any");
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [fsPick, setFsPick] = useState(null);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? foods.filter((f) => !f.archived && (f.name.toLowerCase().includes(q) || (f.brand || "").toLowerCase().includes(q))).slice(0, 8) : []), [foods, q]);
  const { results: fsResults, loading: fsLoading } = useFatSecretResults(query);

  const totals = items.reduce((t, it) => ({ kcal: t.kcal + it.macros.kcal, protein: t.protein + it.macros.protein, carbs: t.carbs + it.macros.carbs, fat: t.fat + it.macros.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const maxMacro = Math.max(totals.protein, totals.carbs, totals.fat, 1);

  function addItem(foodRow, qty, unit) {
    const food = normalizeFoodRow(foodRow);
    const unitGrams = unitGramsFor(food, unit);
    const basis = food.basisGrams || 100;
    const perUnit = { kcal: (food.kcal * unitGrams) / basis, protein: (food.protein * unitGrams) / basis, carbs: (food.carbs * unitGrams) / basis, fat: (food.fat * unitGrams) / basis };
    setItems((prev) => [...prev, { id: `${food.id}-${prev.length}-${Date.now()}`, foodId: food.id, name: food.name, qty, unit, perUnit, macros: scale(perUnit, qty) }]);
    setQuery("");
  }
  function pickLocal(f) { addItem(f, f.unit === "piece" ? 1 : 100, f.unit === "piece" ? "piece" : f.unit); }
  function pickFatSecret(serving, multiplier) { addItem(fatSecretFoodRow(fsPick, serving), multiplier, serving.desc || "serving"); setFsPick(null); }
  function bumpQty(id, delta) {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const qty = Math.max(0, +(it.qty + delta).toFixed(1));
      return { ...it, qty, macros: scale(it.perUnit, qty) };
    }));
  }
  function removeItem(id) { setItems((prev) => prev.filter((it) => it.id !== id)); }

  function save() {
    if (!name.trim()) { showToast("Give this meal a name.", "warn"); return; }
    if (items.length === 0) { showToast("Add at least one ingredient.", "warn"); return; }
    onSave(name.trim(), mealType, items.map((it) => ({ foodId: it.foodId, name: it.name, qty: it.qty, unit: it.unit, macros: it.macros })));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: NT.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ flexShrink: 0, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${NT.line}` }}>
        <button onClick={onClose} aria-label="Cancel" style={{ width: 32, height: 32, border: "none", background: "transparent", color: NT.muted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <span style={{ fontFamily: NT.display, fontSize: 16.5, fontWeight: 560, color: NT.text }}>Build a meal</span>
        <button onClick={save} style={{ background: "none", border: "none", color: NT.accent, fontFamily: NT.sans, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "6px 2px" }}>Save</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.dim, marginBottom: 8 }}>Meal name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Post-workout shake" aria-label="Meal name"
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${NT.lineSoft}`, background: NT.card, color: NT.text, fontFamily: NT.display, fontSize: 18, fontWeight: 560, padding: "13px 16px", borderRadius: 14, outline: "none" }} />
        </label>

        <div>
          <span style={{ display: "block", fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.dim, marginBottom: 8 }}>Usually eaten at</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MEAL_TYPES.map((mt) => (
              <button key={mt} onClick={() => setMealType(mt)} style={{ border: `1px solid ${mealType === mt ? "transparent" : "rgba(255,255,255,.1)"}`, background: mealType === mt ? NT.accent : "transparent", color: mealType === mt ? NT.bg : NT.muted, fontFamily: NT.sans, fontSize: 11.5, fontWeight: 600, padding: "8px 14px", borderRadius: 999, cursor: "pointer" }}>
                {MEAL_TYPE_LABELS[mt]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: "18px 20px" }}>
          <div style={{ marginBottom: 14, fontFamily: NT.display, fontSize: 26, fontWeight: 620, color: NT.text }}>
            {Math.round(totals.kcal)} <span style={{ fontFamily: NT.sans, fontSize: 12, fontWeight: 500, color: NT.dim }}>kcal total</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MacroBarRow label="Protein" color={MACRO_COLORS.protein} pct={(totals.protein / maxMacro) * 100} value={`${Math.round(totals.protein)}g`} />
            <MacroBarRow label="Carbs" color={MACRO_COLORS.carbs} pct={(totals.carbs / maxMacro) * 100} value={`${Math.round(totals.carbs)}g`} />
            <MacroBarRow label="Fat" color={MACRO_COLORS.fat} pct={(totals.fat / maxMacro) * 100} value={`${Math.round(totals.fat)}g`} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px 10px" }}>
            <h2 style={{ margin: 0, fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted }}>Ingredients</h2>
            <span style={{ fontFamily: NT.sans, fontSize: 11.5, color: NT.dim }}>{items.length} added</span>
          </div>

          <label style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10, background: NT.card, border: `1px solid ${NT.lineSoft}`, borderRadius: 14, padding: "11px 14px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: NT.dim }}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add an ingredient" aria-label="Add an ingredient" style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", color: NT.text, fontFamily: NT.sans, fontSize: 13.5, outline: "none" }} />
          </label>

          {q && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflow: "auto", marginBottom: 12, background: NT.card2, borderRadius: 14, padding: 6 }}>
              {matches.map((f) => (
                <button key={f.id} onClick={() => pickLocal(f)} style={{ display: "flex", justifyContent: "space-between", textAlign: "left", background: "transparent", border: "none", borderRadius: 10, padding: "9px 10px", color: NT.text, fontFamily: NT.sans, fontSize: 13, cursor: "pointer" }}>
                  <span>{f.name}{f.brand ? ` · ${f.brand}` : ""}</span><span style={{ color: NT.dim, fontSize: 11 }}>{f.kcal} kcal/100{f.unit === "ml" ? "ml" : "g"}</span>
                </button>
              ))}
              {matches.length === 0 && fsResults.length === 0 && !fsLoading && <div style={{ color: NT.muted, fontSize: 12, padding: "8px 6px" }}>No foods match "{query.trim()}" yet.</div>}
              {fsResults.length > 0 && (
                <>
                  {matches.length > 0 && <FatSecretGroupLabel />}
                  {fsResults.map((f) => <FatSecretResultRow key={f.id} food={f} onClick={() => setFsPick(f)} />)}
                </>
              )}
              {fsLoading && <div style={{ color: NT.dim, fontSize: 11, padding: "6px 10px" }}>Searching FatSecret...</div>}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((it) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 16, padding: "10px 12px 10px 14px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: NT.sans, fontSize: 13.5, fontWeight: 500, color: NT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                  <div style={{ fontFamily: NT.sans, fontSize: 11, color: NT.dim, marginTop: 2 }}>{Math.round(it.macros.kcal)} kcal · P {Math.round(it.macros.protein)} · C {Math.round(it.macros.carbs)} · F {Math.round(it.macros.fat)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, background: NT.card2, borderRadius: 10, padding: 3 }}>
                  <button aria-label={`Decrease ${it.name}`} onClick={() => bumpQty(it.id, STEP_UNITS.has(it.unit) ? -10 : -1)} style={{ width: 26, height: 26, border: "none", background: "transparent", color: NT.muted, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>&#8722;</button>
                  <span style={{ width: 48, textAlign: "center", fontFamily: NT.sans, fontSize: 12.5, color: NT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.qty}{it.unit === "piece" || STEP_UNITS.has(it.unit) ? "" : ` ${it.unit}`}</span>
                  <button aria-label={`Increase ${it.name}`} onClick={() => bumpQty(it.id, STEP_UNITS.has(it.unit) ? 10 : 1)} style={{ width: 26, height: 26, border: "none", background: "transparent", color: NT.muted, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>+</button>
                </div>
                <button aria-label={`Remove ${it.name}`} onClick={() => removeItem(it.id)} style={{ flexShrink: 0, width: 24, height: 24, border: "none", background: "transparent", color: NT.faint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
            {items.length === 0 && <div style={{ padding: "22px 4px", textAlign: "center", fontFamily: NT.sans, fontSize: 12.5, color: NT.dim }}>Search above to add your first ingredient.</div>}
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: "14px 20px 22px", borderTop: `1px solid ${NT.line}`, background: NT.bg }}>
        <button onClick={save} style={{ display: "block", width: "100%", textAlign: "center", background: NT.accent, color: NT.bg, fontFamily: NT.sans, fontSize: 14.5, fontWeight: 700, padding: 15, borderRadius: 14, border: "none", cursor: "pointer" }}>Save meal</button>
        <div style={{ textAlign: "center", fontFamily: NT.sans, fontSize: 11, color: NT.dim, marginTop: 10 }}>Saved meals show up under &ldquo;Your meals&rdquo; so you can log this again in one tap.</div>
      </div>

      {fsPick && <FatSecretServingSheet food={fsPick} onClose={() => setFsPick(null)} onAdd={pickFatSecret} />}
    </div>
  );
}
