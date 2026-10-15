import { useMemo, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { uid } from "../../lib/uid.js";
import { normalizeFoodRow, unitGramsFor, fatSecretFoodRow } from "./nutritionV2Model.js";
import { loggedDayTotals } from "./nutritionV2Math.js";
import { useFatSecretResults } from "../../lib/fatsecret.js";
import { FatSecretResultRow, FatSecretGroupLabel, FatSecretServingSheet } from "./FatSecretSearch.jsx";

const LOG_MEALS = ["breakfast", "lunch", "dinner", "snack", "other"];
const MEAL_GROUP_NAMES = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", other: "Other" };

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function macroLine(m) { return `P ${Math.round(m.protein)} · C ${Math.round(m.carbs)} · F ${Math.round(m.fat)}`; }

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
      <Card style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Chip selected={mode === "search"} onClick={() => setMode("search")}>Search</Chip>
          <Chip selected={mode === "quick"} onClick={() => setMode("quick")}>Quick add</Chip>
        </div>
        <SectionLabel color={T.muted} style={{ marginBottom: 8 }}>Meal</SectionLabel>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {LOG_MEALS.map((k) => <Chip key={k} selected={meal === k} onClick={() => setMeal(k)}>{MEAL_GROUP_NAMES[k]}</Chip>)}
        </div>

        {mode === "search" ? (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods..." style={inputStyle({ marginBottom: 8 })} autoFocus />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflow: "auto" }}>
              {matches.map((f) => (
                <button key={f.id} onClick={() => pickFood(f)} style={{ display: "flex", justifyContent: "space-between", textAlign: "left", background: T.card2, border: "none", borderRadius: 10, padding: "10px 12px", color: T.text, fontFamily: T.sans, fontSize: 13, cursor: "pointer" }}>
                  <span>{f.name}{f.brand ? ` · ${f.brand}` : ""}</span><span style={{ color: T.dim, fontSize: 11 }}>{f.kcal} kcal/100{f.unit === "ml" ? "ml" : "g"}</span>
                </button>
              ))}
              {q && matches.length === 0 && fsResults.length === 0 && !fsLoading && <div style={{ color: T.muted, fontSize: 12, padding: "6px 2px" }}>No foods match "{query.trim()}" yet.</div>}
              {fsResults.length > 0 && (
                <>
                  {matches.length > 0 && <FatSecretGroupLabel />}
                  {fsResults.map((f) => <FatSecretResultRow key={f.id} food={f} onClick={() => setFsPick(f)} />)}
                </>
              )}
              {fsLoading && <div style={{ color: T.dim, fontSize: 11, padding: "6px 2px" }}>Searching FatSecret...</div>}
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
      </Card>
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
      <Card style={{ width: "100%", maxWidth: 400 }}>
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
      </Card>
    </div>
  );
}

// Grouped-by-meal log of every entry for the viewed date, regardless of
// source (confirmed/substituted/search/quick) - add via search or a
// manual quick-add, edit or delete any entry. Photo-scan is a deferred
// fast-follow (see mellow-wandering-grove.md), not part of this tab yet.
export function ClientFoodLogTab({ dateEntries, foods, editable, onWrite }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const totals = loggedDayTotals(dateEntries);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ color: T.muted, fontSize: 12 }}>Logged today</div>
          <div style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 600, color: T.text }}>{Math.round(totals.kcal)} <span style={{ fontSize: 13, color: T.muted, fontWeight: 400 }}>kcal</span></div>
        </div>
        <div style={{ fontSize: 13, color: T.muted }}>{macroLine(totals)}</div>
      </Card>

      {groups.length === 0 && <Card style={{ padding: 16, color: T.muted, fontSize: 13 }}>Nothing logged yet.</Card>}

      {groups.map((g) => (
        <Card key={g.key} style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionLabel color={T.muted}>{g.name}</SectionLabel>
            <span style={{ color: T.dim, fontSize: 11 }}>{Math.round(loggedDayTotals(g.entries).kcal)} kcal</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.entries.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8, borderTop: `${T.hairline} solid ${T.line}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.sans, fontSize: 13, color: T.text }}>{e.name}</div>
                  <div style={{ color: T.dim, fontSize: 11, marginTop: 2 }}>{e.qty ? `${e.qty}${e.unit === "piece" ? "" : e.unit} · ` : ""}{macroLine(e.macros)} · {e.time}</div>
                </div>
                <div style={{ fontFamily: T.sans, fontSize: 13, color: T.text, flexShrink: 0 }}>{Math.round(e.macros.kcal)}</div>
                {editable && (
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <button onClick={() => setEditing(e)} aria-label={`Edit ${e.name}`} style={{ width: 32, height: 32, background: "none", border: "none", color: T.dim, cursor: "pointer" }}>✎</button>
                    <button onClick={() => deleteEntry(e)} aria-label={`Delete ${e.name}`} style={{ width: 32, height: 32, background: "none", border: "none", color: T.dim, cursor: "pointer" }}>×</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {editable && <Button onClick={() => setAdding(true)} style={{ width: "100%" }}>+ Add food</Button>}
      {adding && <AddLogSheet foods={foods} defaultMeal="other" onClose={() => setAdding(false)} onAdd={addEntry} />}
      {editing && <EditEntrySheet entry={editing} foods={foods} onClose={() => setEditing(null)} onSave={saveEdit} />}
    </div>
  );
}
