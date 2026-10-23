import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { T } from "../../theme/tokens.js";
import { uid } from "../../lib/uid.js";
import { isoDate } from "../../lib/dateUtils.js";
import { normalizeFoodRow, unitGramsFor, fatSecretFoodRow, newSavedMeal, newMealItem } from "./nutritionV2Model.js";
import { loggedDayTotals, suggestSavedMealsFromHistory } from "./nutritionV2Math.js";
import { normalizeMeals, saveMeals } from "../../lib/nutritionV2.js";
import { useFatSecretResults } from "../../lib/fatsecret.js";
import { FatSecretResultRow, FatSecretGroupLabel, FatSecretServingSheet } from "./FatSecretSearch.jsx";
import { CreateMealSheet } from "./CreateMealSheet.jsx";
import { NT, MACRO_COLORS } from "./nutritionV2Theme.js";

const LOG_MEALS = ["breakfast", "lunch", "dinner", "snack", "other"];
const MEAL_GROUP_NAMES = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", other: "Other" };
const BADGE_COLORS = [[MACRO_COLORS.kcal, "rgba(227,164,92,.14)"], [MACRO_COLORS.protein, "rgba(143,185,150,.14)"], [MACRO_COLORS.carbs, "rgba(127,166,201,.14)"], [MACRO_COLORS.fat, "rgba(180,155,208,.14)"]];

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function macroLine(m) { return `P ${Math.round(m.protein)} · C ${Math.round(m.carbs)} · F ${Math.round(m.fat)}`; }
function badgeColorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % BADGE_COLORS.length;
  return BADGE_COLORS[h];
}

function AddLogSheet({ foods, defaultMeal, onClose, onAdd }) {
  const [mode, setMode] = useState("search"); // 'search' | 'quick'
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState(defaultMeal);
  const [quick, setQuick] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  const [fsPick, setFsPick] = useState(null);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? foods.filter((f) => !f.archived && (f.name.toLowerCase().includes(q) || (f.brand || "").toLowerCase().includes(q))).slice(0, 8) : []), [foods, q]);
  const { results: fsResults, loading: fsLoading } = useFatSecretResults(query);

  function pickFood(foodRow) {
    const food = normalizeFoodRow(foodRow);
    const qty = food.unit === "piece" ? 1 : 100;
    const unit = food.unit === "piece" ? "piece" : food.unit;
    const factor = (qty * unitGramsFor(food, unit)) / (food.basisGrams || 100);
    onAdd({
      id: uid(), meal, name: food.name, foodId: food.id, qty, unit,
      macros: { kcal: food.kcal * factor, protein: food.protein * factor, carbs: food.carbs * factor, fat: food.fat * factor },
      source: "search", time: nowHHMM(), planItemId: null, estimate: false, replaces: null, reason: null,
    });
  }
  // Doesn't delegate to pickFood() - that assumes the default-amount
  // convention for a local-library pick (100g, or 1 of a "piece" food).
  // A FatSecret add already carries its own real serving + quantity.
  function pickFatSecret(serving, multiplier) {
    const food = normalizeFoodRow(fatSecretFoodRow(fsPick, serving));
    const factor = (multiplier * unitGramsFor(food, food.unit)) / (food.basisGrams || 100);
    onAdd({
      id: uid(), meal, name: food.name, foodId: food.id, qty: multiplier, unit: food.unit,
      macros: { kcal: food.kcal * factor, protein: food.protein * factor, carbs: food.carbs * factor, fat: food.fat * factor },
      source: "search", time: nowHHMM(), planItemId: null, estimate: false, replaces: null, reason: null,
    });
    setFsPick(null);
  }
  function saveQuick() {
    if (!quick.name.trim() || quick.kcal === "") { showToast("Add a description and calories to save.", "warn"); return; }
    onAdd({
      id: uid(), meal, name: quick.name.trim(), foodId: null, qty: null, unit: null,
      macros: { kcal: Number(quick.kcal) || 0, protein: Number(quick.protein) || 0, carbs: Number(quick.carbs) || 0, fat: Number(quick.fat) || 0 },
      source: "quick", time: nowHHMM(), planItemId: null, estimate: false, replaces: null, reason: null,
    });
  }

  return (
    <div style={modalBackdrop()}>
      <div style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflow: "auto", background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["search", "Search"], ["quick", "Quick add"]].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{ border: `1px solid ${mode === k ? "transparent" : "rgba(255,255,255,.1)"}`, background: mode === k ? NT.accent : "transparent", color: mode === k ? NT.bg : NT.muted, fontFamily: NT.sans, fontSize: 11, fontWeight: 600, padding: "9px 14px", borderRadius: 999, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <div style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.dim, marginBottom: 8 }}>Meal</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {LOG_MEALS.map((k) => (
            <button key={k} onClick={() => setMeal(k)} style={{ border: `1px solid ${meal === k ? "transparent" : "rgba(255,255,255,.1)"}`, background: meal === k ? NT.accent : "transparent", color: meal === k ? NT.bg : NT.muted, fontFamily: NT.sans, fontSize: 11, fontWeight: 600, padding: "8px 13px", borderRadius: 999, cursor: "pointer" }}>{MEAL_GROUP_NAMES[k]}</button>
          ))}
        </div>

        {mode === "search" ? (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods..." autoFocus
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${NT.lineSoft}`, background: NT.card2, color: NT.text, fontFamily: NT.sans, fontSize: 13.5, padding: "11px 14px", borderRadius: 14, outline: "none", marginBottom: 8 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflow: "auto" }}>
              {matches.map((f) => (
                <button key={f.id} onClick={() => pickFood(f)} style={{ display: "flex", justifyContent: "space-between", textAlign: "left", background: NT.card2, border: "none", borderRadius: 10, padding: "10px 12px", color: NT.text, fontFamily: NT.sans, fontSize: 13, cursor: "pointer" }}>
                  <span>{f.name}{f.brand ? ` · ${f.brand}` : ""}</span><span style={{ color: NT.dim, fontSize: 11 }}>{f.kcal} kcal/100{f.unit === "ml" ? "ml" : "g"}</span>
                </button>
              ))}
              {q && matches.length === 0 && fsResults.length === 0 && !fsLoading && <div style={{ color: NT.muted, fontSize: 12, padding: "6px 2px" }}>No foods match "{query.trim()}" yet.</div>}
              {fsResults.length > 0 && (
                <>
                  {matches.length > 0 && <FatSecretGroupLabel />}
                  {fsResults.map((f) => <FatSecretResultRow key={f.id} food={f} onClick={() => setFsPick(f)} />)}
                </>
              )}
              {fsLoading && <div style={{ color: NT.dim, fontSize: 11, padding: "6px 2px" }}>Searching FatSecret...</div>}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Description" value={quick.name} onChange={(v) => setQuick((q2) => ({ ...q2, name: v }))} placeholder="e.g. Latte, oat milk" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              <Field label="Kcal" type="number" value={quick.kcal} onChange={(v) => setQuick((q2) => ({ ...q2, kcal: v }))} />
              <Field label="Protein" type="number" value={quick.protein} onChange={(v) => setQuick((q2) => ({ ...q2, protein: v }))} />
              <Field label="Carbs" type="number" value={quick.carbs} onChange={(v) => setQuick((q2) => ({ ...q2, carbs: v }))} />
              <Field label="Fat" type="number" value={quick.fat} onChange={(v) => setQuick((q2) => ({ ...q2, fat: v }))} />
            </div>
            <Button onClick={saveQuick}>Save to log</Button>
          </div>
        )}
        <Button variant="ghost" onClick={onClose} style={{ marginTop: 14, width: "100%" }}>Cancel</Button>
      </div>
      {fsPick && <FatSecretServingSheet food={fsPick} onClose={() => setFsPick(null)} onAdd={pickFatSecret} />}
    </div>
  );
}

function EditEntrySheet({ entry, foods, onClose, onSave }) {
  const food = entry.foodId ? normalizeFoodRow(foods.find((f) => f.id === entry.foodId) || {}) : null;
  const [qty, setQty] = useState(entry.qty ?? "");
  const [quick, setQuick] = useState({ kcal: Math.round(entry.macros.kcal), protein: Math.round(entry.macros.protein), carbs: Math.round(entry.macros.carbs), fat: Math.round(entry.macros.fat) });

  function save() {
    if (food) {
      const factor = (Number(qty) * unitGramsFor(food, entry.unit)) / (food.basisGrams || 100);
      onSave({ ...entry, qty: Number(qty) || 0, macros: { kcal: food.kcal * factor, protein: food.protein * factor, carbs: food.carbs * factor, fat: food.fat * factor } });
    } else {
      onSave({ ...entry, macros: { kcal: Number(quick.kcal) || 0, protein: Number(quick.protein) || 0, carbs: Number(quick.carbs) || 0, fat: Number(quick.fat) || 0 } });
    }
  }
  return (
    <div style={modalBackdrop()}>
      <div style={{ width: "100%", maxWidth: 400, background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18 }}>
        <SectionLabel color={T.muted} style={{ marginBottom: 10 }}>{entry.name}</SectionLabel>
        {food ? (
          <Field label={`Amount (${entry.unit})`} type="number" value={qty} onChange={setQty} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            <Field label="Kcal" type="number" value={quick.kcal} onChange={(v) => setQuick((q2) => ({ ...q2, kcal: v }))} />
            <Field label="Protein" type="number" value={quick.protein} onChange={(v) => setQuick((q2) => ({ ...q2, protein: v }))} />
            <Field label="Carbs" type="number" value={quick.carbs} onChange={(v) => setQuick((q2) => ({ ...q2, carbs: v }))} />
            <Field label="Fat" type="number" value={quick.fat} onChange={(v) => setQuick((q2) => ({ ...q2, fat: v }))} />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={save} style={{ flex: 1 }}>Save</Button>
        </div>
      </div>
    </div>
  );
}

function MealBadge({ name }) {
  const [color, bg] = badgeColorFor(name);
  return <div aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 11, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: NT.display, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>{name[0]?.toUpperCase()}</div>;
}

// "Your meals": real saved meals (nutrition_v2_meals) first, then meals
// suggested from the client's own repeated quick-add history
// (suggestSavedMealsFromHistory) that haven't been saved yet - how a
// client's meals from before the builder existed carry forward. Tapping
// either logs it to today; tapping a suggestion also saves it for real,
// in one action, so it only has to be "discovered" once.
function YourMealsRow({ savedMeals, suggestions, onUseSaved, onUseSuggested, onBuild }) {
  if (savedMeals.length === 0 && suggestions.length === 0) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px 10px" }}>
          <h2 style={{ margin: 0, fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted }}>Your meals</h2>
        </div>
        <button onClick={onBuild} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: `1px dashed rgba(255,255,255,.16)`, borderRadius: 16, padding: "16px 14px", background: "transparent", color: NT.muted, cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <span style={{ fontFamily: NT.sans, fontSize: 12.5, fontWeight: 500 }}>Build your first meal</span>
        </button>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px 10px" }}>
        <h2 style={{ margin: 0, fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted }}>Your meals</h2>
        <button onClick={onBuild} style={{ background: "none", border: "none", color: NT.accent, fontFamily: NT.sans, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Build a meal</button>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "1px 1px 4px", margin: "-1px" }}>
        {savedMeals.map((m) => (
          <button key={m.id} onClick={() => onUseSaved(m)} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, width: 136, background: NT.card, border: `1px solid ${NT.lineSoft}`, borderRadius: 16, padding: "12px 14px", cursor: "pointer", textAlign: "left" }}>
            <MealBadge name={m.name} />
            <span style={{ fontFamily: NT.sans, fontSize: 12.5, fontWeight: 500, color: NT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{m.name}</span>
            <span style={{ fontFamily: NT.sans, fontSize: 11, color: NT.dim }}>{Math.round(m.macros.kcal)} kcal</span>
          </button>
        ))}
        {suggestions.map((s) => (
          <button key={s.name} onClick={() => onUseSuggested(s)} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, width: 136, background: NT.card, border: `1px dashed ${NT.lineSoft}`, borderRadius: 16, padding: "12px 14px", cursor: "pointer", textAlign: "left" }}>
            <MealBadge name={s.name} />
            <span style={{ fontFamily: NT.sans, fontSize: 12.5, fontWeight: 500, color: NT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{s.name}</span>
            <span style={{ fontFamily: NT.sans, fontSize: 10.5, color: NT.accent }}>You've made this {s.occurrences}x</span>
          </button>
        ))}
        <button onClick={onBuild} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, width: 92, border: "1px dashed rgba(255,255,255,.16)", borderRadius: 16, padding: "12px 10px", background: "transparent", color: NT.muted, cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <span style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 500, textAlign: "center" }}>New meal</span>
        </button>
      </div>
    </div>
  );
}

// Grouped-by-meal log of every entry for the viewed date, regardless of
// source (confirmed/substituted/search/quick) - add via search, a manual
// quick-add, or one tap from "Your meals". Edit or delete any entry.
// Photo-scan is a deferred fast-follow, not part of this tab yet.
export function ClientFoodLogTab({ client, updateClient, logs, dateEntries, foods, editable, onWrite }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [building, setBuilding] = useState(false);
  const totals = loggedDayTotals(dateEntries);

  const savedMeals = useMemo(() => normalizeMeals(client.nutritionV2Meals), [client.nutritionV2Meals]);
  const suggestions = useMemo(
    () => suggestSavedMealsFromHistory(logs, savedMeals.map((m) => m.name)),
    [logs, savedMeals]
  );

  async function persistMeals(next) {
    await saveMeals(client.id, next);
    updateClient({ ...client, nutritionV2Meals: next });
  }
  async function logMealItems(meal) {
    const slot = meal.mealType && meal.mealType !== "any" ? meal.mealType : "other";
    const added = meal.items.map((it) => ({
      id: uid(), meal: slot, name: it.name, foodId: it.foodId, qty: it.qty, unit: it.unit, macros: it.macros,
      source: "search", time: nowHHMM(), planItemId: null, estimate: false, replaces: null, reason: null,
    }));
    await onWrite([...dateEntries, ...added]);
  }
  async function useSavedMeal(meal) {
    await logMealItems(meal);
    await persistMeals(savedMeals.map((m) => (m.id === meal.id ? { ...m, useCount: (m.useCount || 0) + 1, lastUsedAt: isoDate() } : m)));
    showToast(`${meal.name} logged.`, "success");
  }
  async function useSuggestedMeal(sugg) {
    const meal = newSavedMeal({ name: sugg.name, mealType: sugg.mealType, items: sugg.items.map((it) => newMealItem(it)) });
    await logMealItems(meal);
    await persistMeals([...savedMeals, { ...meal, useCount: 1, lastUsedAt: isoDate() }]);
    showToast(`${sugg.name} logged, and saved to Your meals.`, "success");
  }
  async function saveNewMeal(name, mealType, items) {
    const meal = newSavedMeal({ name, mealType, items });
    await persistMeals([...savedMeals, meal]);
    setBuilding(false);
    showToast(`${name} saved to Your meals.`, "success");
  }

  async function addEntry(entry) {
    await onWrite([...dateEntries, entry]);
    setAdding(false);
    showToast(`${entry.name} added.`, "success");
  }
  async function saveEdit(nextEntry) {
    await onWrite(dateEntries.map((e) => (e.id === nextEntry.id ? nextEntry : e)));
    setEditing(null);
    showToast("Entry updated.", "success");
  }
  async function deleteEntry(entry) {
    if (!await confirmDialog(`Delete "${entry.name}"?`, { danger: true, confirmLabel: "Delete" })) return;
    await onWrite(dateEntries.filter((e) => e.id !== entry.id));
    showToast(`Deleted ${entry.name}.`, "success");
  }

  const groups = LOG_MEALS.map((key) => ({ key, name: MEAL_GROUP_NAMES[key], entries: dateEntries.filter((e) => e.meal === key) })).filter((g) => g.entries.length);

  return (
    <div style={{ background: NT.bg, margin: "-14px", padding: 14, borderRadius: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 18, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: NT.sans, fontSize: 11, color: NT.dim }}>Logged so far</div>
          <div style={{ marginTop: 3, fontFamily: NT.display, fontSize: 21, fontWeight: 600, color: NT.text }}>{Math.round(totals.kcal)} <span style={{ fontFamily: NT.sans, fontSize: 12, fontWeight: 500, color: NT.dim }}>kcal</span></div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {[["Protein", totals.protein, MACRO_COLORS.protein], ["Carbs", totals.carbs, MACRO_COLORS.carbs], ["Fat", totals.fat, MACRO_COLORS.fat]].map(([label, value, color]) => (
            <div key={label} style={{ textAlign: "right" }}>
              <div style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, color }}>{Math.round(value)}g</div>
              <div style={{ fontFamily: NT.sans, fontSize: 9.5, color: NT.dim, marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {editable && <YourMealsRow savedMeals={savedMeals} suggestions={suggestions} onUseSaved={useSavedMeal} onUseSuggested={useSuggestedMeal} onBuild={() => setBuilding(true)} />}

      {groups.length === 0 && <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 18, padding: 16, color: NT.muted, fontFamily: NT.sans, fontSize: 13 }}>Nothing logged yet.</div>}

      {groups.map((g) => (
        <div key={g.key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px 10px" }}>
            <h2 style={{ margin: 0, fontFamily: NT.sans, fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: NT.muted }}>{g.name}</h2>
            <span style={{ fontFamily: NT.sans, fontSize: 11.5, color: NT.dim }}>{Math.round(loggedDayTotals(g.entries).kcal)} kcal</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.entries.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 16, padding: "12px 14px" }}>
                <MealBadge name={e.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: NT.sans, fontSize: 13.5, fontWeight: 500, color: NT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                  <div style={{ fontFamily: NT.sans, fontSize: 11, color: NT.dim, marginTop: 2 }}>{e.qty ? `${e.qty}${e.unit === "piece" ? "" : ` ${e.unit}`} · ` : ""}{macroLine(e.macros)} · {e.time}</div>
                </div>
                <div style={{ fontFamily: NT.sans, fontSize: 13, fontWeight: 600, color: NT.text, flexShrink: 0 }}>{Math.round(e.macros.kcal)}</div>
                {editable && (
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <button onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`} style={{ width: 28, height: 28, background: "none", border: "none", color: NT.faint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button onClick={() => deleteEntry(e)} aria-label={`Delete ${e.name}`} style={{ width: 28, height: 28, background: "none", border: "none", color: NT.faint, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {editable && (
        <button onClick={() => setAdding(true)} style={{ width: "100%", background: NT.accent, color: NT.bg, fontFamily: NT.sans, fontSize: 14, fontWeight: 700, padding: 14, borderRadius: 14, border: "none", cursor: "pointer" }}>+ Add food</button>
      )}
      {adding && <AddLogSheet foods={foods} defaultMeal="other" onClose={() => setAdding(false)} onAdd={addEntry} />}
      {editing && <EditEntrySheet entry={editing} foods={foods} onClose={() => setEditing(null)} onSave={saveEdit} />}
      {building && <CreateMealSheet foods={foods} onClose={() => setBuilding(false)} onSave={saveNewMeal} />}
    </div>
  );
}
