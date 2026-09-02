import { useEffect, useMemo, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Sheet } from "../../components/ui/Sheet.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog, promptDialog } from "../../components/ui/ConfirmDialog.jsx";
import { uid } from "../../lib/uid.js";
import { searchFoods, getFoodServings } from "../../lib/fatsecret.js";
import { MACRO_SLOTS, macroDayFor, saveNutritionState } from "../../lib/nutrition.js";

const SLOT_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snacks: "Snacks" };
const TABS = [["search", "Search"], ["saved", "Saved Meals"], ["recent", "Recent"], ["custom", "Custom"]];

function MacroPreview({ kcal, protein, carbs, fats }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 12 }}>
      <Mini label="kcal" value={Math.round(kcal)} />
      <Mini label="protein" value={`${Math.round(protein)}g`} />
      <Mini label="carbs" value={`${Math.round(carbs)}g`} />
      <Mini label="fats" value={`${Math.round(fats)}g`} />
    </div>
  );
}

function QuantitySheet({ food, slotLabel, onClose, onAdd }) {
  const [servings, setServings] = useState(null);
  const [servingIdx, setServingIdx] = useState(0);
  const [qty, setQty] = useState("1");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const fallback = [{ desc: food.serving || "1 serving", kcal: food.kcal || 0, protein: food.protein || 0, carbs: food.carbs || 0, fats: food.fats || 0 }];
    getFoodServings(food.id)
      .then((data) => { if (!cancelled) { setServings(data.servings?.length ? data.servings : fallback); setLoading(false); } })
      .catch(() => { if (!cancelled) { setServings(fallback); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when the food identity changes
  }, [food.id]);
  const serving = servings?.[servingIdx];
  const mult = Number(qty) || 0;
  const totals = serving ? { kcal: serving.kcal * mult, protein: serving.protein * mult, carbs: serving.carbs * mult, fats: serving.fats * mult } : null;
  return (
    <Sheet title={food.name} onClose={onClose}>
      {food.brand && <div style={{ color: T.muted, fontSize: 12, marginTop: -6, marginBottom: 10 }}>{food.brand}</div>}
      {loading ? (
        <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>Loading servings...</div>
      ) : (
        <>
          {servings.length > 1 && (
            <label>
              <div style={{ color: T.muted, fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.14em" }}>Serving</div>
              <select value={servingIdx} onChange={(e) => setServingIdx(Number(e.target.value))} style={{ ...inputStyle(), marginBottom: 10 }}>
                {servings.map((s, i) => <option key={i} value={i}>{s.desc}</option>)}
              </select>
            </label>
          )}
          <Field label="Number of servings" type="number" value={qty} onChange={setQty} />
          {totals && <MacroPreview {...totals} />}
          <Button
            disabled={!totals || mult <= 0}
            onClick={() => onAdd({ foodId: food.id, name: food.name, brand: food.brand || "", serving: serving.desc, amount: mult, kcal: Math.round(totals.kcal), protein: Math.round(totals.protein), carbs: Math.round(totals.carbs), fats: Math.round(totals.fats) })}
            style={{ width: "100%", marginTop: 16 }}
          >
            Add to {slotLabel}
          </Button>
        </>
      )}
    </Sheet>
  );
}

function CustomFoodForm({ slotLabel, onAdd }) {
  const [name, setName] = useState("");
  const [serving, setServing] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  function submit() {
    if (!name.trim()) { showToast("Give this food a name.", "warn"); return; }
    onAdd({ foodId: "", name: name.trim(), brand: "", serving: serving.trim() || "1 serving", amount: 1, kcal: Number(kcal) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fats: Number(fats) || 0, custom: true });
    setName(""); setServing(""); setKcal(""); setProtein(""); setCarbs(""); setFats("");
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Field label="Food name" value={name} onChange={setName} placeholder="e.g. Mum's lasagna" />
      <Field label="Serving (optional)" value={serving} onChange={setServing} placeholder="e.g. 1 plate" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Calories" type="number" value={kcal} onChange={setKcal} />
        <Field label="Protein (g)" type="number" value={protein} onChange={setProtein} />
        <Field label="Carbs (g)" type="number" value={carbs} onChange={setCarbs} />
        <Field label="Fats (g)" type="number" value={fats} onChange={setFats} />
      </div>
      <Button onClick={submit} style={{ width: "100%" }}>Add to {slotLabel}</Button>
    </div>
  );
}

function FoodResultRow({ food, onClick, right }) {
  return (
    <button onClick={onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: T.card, border: `${T.hairline} solid ${T.line}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 14, color: T.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{food.name}</div>
        <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, marginTop: 2 }}>{[food.brand, food.serving].filter(Boolean).join(" · ")}</div>
      </div>
      {right || <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 13, color: T.gold, flexShrink: 0, whiteSpace: "nowrap" }}>{food.kcal} kcal</div>}
    </button>
  );
}

export function FoodSearchScreen({ client, updateClient, date, slot, onClose }) {
  const nutrition = client.nutrition;
  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pickingFood, setPickingFood] = useState(null);
  const [building, setBuilding] = useState(false);
  const [builderItems, setBuilderItems] = useState([]);
  const slotLabel = SLOT_LABELS[slot] || slot;

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setSearching(true);
      searchFoods(trimmedQuery).then((foods) => { if (!cancelled) { setResults(foods); setSearching(false); } })
        .catch((err) => { if (!cancelled) { showToast(err.message || "Search failed.", "error"); setSearching(false); } });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [trimmedQuery]);

  const visibleResults = trimmedQuery ? results : [];

  const recentFoods = useMemo(() => {
    const seen = new Map();
    Object.values(nutrition.macro_log || {}).forEach((day) => {
      MACRO_SLOTS.forEach((s) => (day[s] || []).forEach((item) => {
        const key = item.foodId || item.name;
        if (key && (!seen.has(key) || (item.loggedAt || "") > (seen.get(key).loggedAt || ""))) seen.set(key, item);
      }));
    });
    return [...seen.values()].sort((a, b) => (b.loggedAt || "").localeCompare(a.loggedAt || "")).slice(0, 20);
  }, [nutrition.macro_log]);

  async function persistNutrition(next) {
    updateClient({ ...client, nutrition: next });
    await saveNutritionState(client.id, next);
  }

  async function logItems(items) {
    const day = macroDayFor(nutrition, date);
    const stamped = items.map((i) => ({ id: uid(), ...i, loggedAt: new Date().toISOString() }));
    const nextDay = { ...day, [slot]: [...day[slot], ...stamped] };
    await persistNutrition({ ...nutrition, macro_log: { ...nutrition.macro_log, [date]: nextDay } });
    showToast(`Added to ${slotLabel}.`, "success");
  }

  async function addOne(entry) {
    await logItems([entry]);
    setPickingFood(null);
  }

  function addToBuilder(entry) {
    setBuilderItems((prev) => [...prev, { ...entry, tempId: uid() }]);
    setPickingFood(null);
    showToast(`Added "${entry.name}" to your new meal.`, "success");
  }

  async function saveBuilderAsMeal(alsoLog) {
    if (builderItems.length === 0) return;
    const name = await promptDialog("Name this meal", "", { title: "Save meal" });
    if (!name) return;
    const items = builderItems.map((it) => { const item = { ...it }; delete item.tempId; return item; });
    const meal = { id: uid(), name: name.trim(), items, createdAt: new Date().toISOString() };
    const nextMeals = [meal, ...(nutrition.saved_meals || [])];
    await persistNutrition({ ...nutrition, saved_meals: nextMeals });
    showToast(`Saved "${meal.name}".`, "success");
    if (alsoLog) await logItems(items);
    setBuilderItems([]);
    setBuilding(false);
  }

  async function addSavedMeal(meal) {
    await logItems(meal.items);
  }

  async function deleteSavedMeal(meal) {
    if (!await confirmDialog(`Delete "${meal.name}"? This only removes the saved meal - anything you already logged with it stays.`, { danger: true, confirmLabel: "Delete" })) return;
    await persistNutrition({ ...nutrition, saved_meals: (nutrition.saved_meals || []).filter((m) => m.id !== meal.id) });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 1100, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 0", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: T.card2, border: `${T.hairline} solid ${T.line}`, borderRadius: 10, width: 36, height: 36, color: T.muted, fontSize: 16, cursor: "pointer" }}>&larr;</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 800, color: T.accent }}>Add to {slotLabel}</div>
        </div>
        {building && <div style={{ background: T.gold, color: "#fff", fontFamily: T.sans, fontWeight: 700, fontSize: 11, borderRadius: 999, padding: "5px 10px" }}>{builderItems.length} in meal</div>}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "14px 16px 0", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flexShrink: 0, fontFamily: T.sans, fontWeight: 600, fontSize: 12, padding: "8px 14px", borderRadius: 999, border: `${T.hairline} solid ${tab === k ? "transparent" : T.line}`, background: tab === k ? T.gold : T.card2, color: tab === k ? "#fff" : T.muted, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px", display: "grid", gap: 10, alignContent: "start" }}>
        {tab === "search" && (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a food, e.g. chicken breast" style={{ ...inputStyle(), flex: 1 }} />
            </div>
            <button onClick={() => { setBuilding((v) => !v); if (building) setBuilderItems([]); }} style={{ justifySelf: "start", background: "none", border: "none", padding: 0, color: building ? T.bad : T.blue, fontFamily: T.sans, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              {building ? "✕ Cancel building a meal" : "✚ Building a meal? Combine multiple foods and save them together"}
            </button>
            {searching && <div style={{ color: T.muted, fontSize: 13 }}>Searching...</div>}
            {!searching && trimmedQuery && visibleResults.length === 0 && <div style={{ color: T.muted, fontSize: 13 }}>No results for "{query}".</div>}
            {visibleResults.map((food) => <FoodResultRow key={food.id} food={food} onClick={() => setPickingFood(food)} />)}

            {building && builderItems.length > 0 && (
              <div style={{ position: "sticky", bottom: 0, background: T.panel, border: `${T.hairline} solid ${T.line}`, borderRadius: 16, padding: 14, marginTop: 8 }}>
                <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 12, color: T.accent, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>New meal · {builderItems.length} item{builderItems.length === 1 ? "" : "s"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {builderItems.map((it) => <span key={it.tempId} style={{ background: T.card2, borderRadius: 999, padding: "5px 10px", fontFamily: T.sans, fontSize: 11, color: T.muted }}>{it.name}</span>)}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => saveBuilderAsMeal(true)} style={{ flex: 1 }}>Save & add to {slotLabel}</Button>
                  <Button variant="dark" onClick={() => saveBuilderAsMeal(false)}>Save only</Button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "saved" && (
          (nutrition.saved_meals || []).length === 0 ? (
            <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6 }}>No saved meals yet. Go to Search, tap "Building a meal?", add a few foods, then save them together.</div>
          ) : (nutrition.saved_meals || []).map((meal) => {
            const items = meal.items || [];
            const kcal = items.reduce((n, i) => n + (Number(i.kcal) || 0), 0);
            return (
              <div key={meal.id} style={{ background: T.card, border: `${T.hairline} solid ${T.line}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 14, color: T.accent }}>{meal.name}</div>
                    <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, marginTop: 3 }}>{items.length} item{items.length === 1 ? "" : "s"} · {kcal} kcal · {items.map((i) => i.name).join(", ")}</div>
                  </div>
                  <button onClick={() => deleteSavedMeal(meal)} style={{ background: "none", border: "none", color: T.bad, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>&times;</button>
                </div>
                <Button onClick={() => addSavedMeal(meal)} style={{ width: "100%", marginTop: 10 }}>Add to {slotLabel}</Button>
              </div>
            );
          })
        )}

        {tab === "recent" && (
          recentFoods.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 13 }}>Nothing logged yet - foods you add will show up here for quick re-logging.</div>
          ) : recentFoods.map((item) => (
            <FoodResultRow
              key={item.id}
              food={{ id: item.foodId, name: item.name, brand: item.brand, serving: item.serving, kcal: item.kcal }}
              onClick={() => (item.custom ? addOne({ ...item, id: undefined }) : setPickingFood({ id: item.foodId, name: item.name, brand: item.brand, serving: item.serving, kcal: item.kcal, protein: item.protein, carbs: item.carbs, fats: item.fats }))}
              right={<span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 11, color: T.blue }}>+ Add</span>}
            />
          ))
        )}

        {tab === "custom" && <CustomFoodForm slotLabel={slotLabel} onAdd={(entry) => (building ? addToBuilder(entry) : addOne(entry))} />}
      </div>

      {pickingFood && (
        <QuantitySheet
          food={pickingFood}
          slotLabel={slotLabel}
          onClose={() => setPickingFood(null)}
          onAdd={building ? addToBuilder : addOne}
        />
      )}
    </div>
  );
}
