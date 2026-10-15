import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { promptDialog } from "../../components/ui/ConfirmDialog.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { uid } from "../../lib/uid.js";
import { loadFoodLibrary, loadMealPresets, saveMealPresets } from "../../lib/nutritionPlan.js";
import { normalizePlans, savePlans } from "../../lib/nutritionV2.js";
import { MEAL_KEYS, MEAL_NAMES, foodRefFromRow, normalizeFoodRow, unitGramsFor, newPlanItem, newPlanVersion, validatePlanVersion, fatSecretFoodRow } from "./nutritionV2Model.js";
import { mealTotals, dayTotals, planForDate, publishPlan, nextDraftFrom } from "./nutritionV2Math.js";
import { useFatSecretResults } from "../../lib/fatsecret.js";
import { FatSecretResultRow, FatSecretGroupLabel, FatSecretServingSheet } from "./FatSecretSearch.jsx";

const MAC_COLOR = { kcal: T.gold, protein: T.good, carbs: T.blue, fat: T.violet };
const MAC_LABEL = { kcal: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat" };

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Food search + add, used inside a meal card. Local library matches are
// instant and listed first; FatSecret results stream in underneath after
// a short debounce (DECISIONS.md) - the coach's own library was never
// going to cover every food a client might eat, so "no foods match" used
// to be a dead end. Local matches add with a sensible default amount
// (100g/ml, or 1 of the food's primary unit); a FatSecret pick opens a
// sheet to choose the real serving + quantity, since search only returns
// one summary serving's macros.
//
// The dropdown uses an explicitly opaque background, not the app's usual
// translucent Card glass - it's position:absolute (out of document flow),
// so the meal-note textarea right after it in flow ends up directly
// underneath; a see-through dropdown let that textarea's placeholder
// bleed through and read as doubled/overlapping text.
function FoodSearchRow({ foods, onAdd }) {
  const [query, setQuery] = useState("");
  const [fsPick, setFsPick] = useState(null);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return foods.filter((f) => !f.archived && (f.name.toLowerCase().includes(q) || (f.brand || "").toLowerCase().includes(q))).slice(0, 8);
  }, [foods, q]);
  const { results: fsResults, loading: fsLoading } = useFatSecretResults(query);
  function pick(food) {
    onAdd(food, food.unit === "piece" ? 1 : 100, food.unit === "piece" ? "piece" : food.unit);
    setQuery("");
  }
  function addFatSecret(serving, multiplier) {
    onAdd(fatSecretFoodRow(fsPick, serving), multiplier, serving.desc || "serving");
    setFsPick(null);
    setQuery("");
  }
  return (
    <div style={{ position: "relative" }}>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add a food..." style={inputStyle()} />
      {q && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 10, padding: 6, maxHeight: 280, overflow: "auto", background: "var(--page)", border: `${T.hairline} solid ${T.line}`, borderRadius: 14, boxShadow: "var(--shadow-md, 0 8px 24px rgba(0,0,0,.3))" }}>
          {matches.length === 0 && fsResults.length === 0 && !fsLoading && <div style={{ color: T.muted, fontSize: 12, padding: "8px 6px" }}>No foods match "{query.trim()}" yet.</div>}
          {matches.map((f) => (
            <button key={f.id} onClick={() => pick(f)} style={{ display: "flex", justifyContent: "space-between", width: "100%", textAlign: "left", background: "transparent", border: "none", color: T.text, fontFamily: T.sans, fontSize: 13, padding: "8px 8px", borderRadius: 8, cursor: "pointer" }}>
              <span>{f.name}{f.brand ? ` · ${f.brand}` : ""}</span><span style={{ color: T.dim, fontSize: 11 }}>{f.kcal} kcal/100{f.unit === "ml" ? "ml" : "g"}</span>
            </button>
          ))}
          {fsResults.length > 0 && (
            <>
              {matches.length > 0 && <FatSecretGroupLabel />}
              {fsResults.map((f) => <FatSecretResultRow key={f.id} food={f} onClick={() => setFsPick(f)} />)}
            </>
          )}
          {fsLoading && <div style={{ color: T.dim, fontSize: 11, padding: "6px 8px" }}>Searching FatSecret...</div>}
        </div>
      )}
      {fsPick && <FatSecretServingSheet food={fsPick} onClose={() => setFsPick(null)} onAdd={addFatSecret} />}
    </div>
  );
}

function MealCard({ meal, foods, templates, onChangeTime, onChangeNote, onAddItem, onUpdateQty, onUpdateUnit, onRemoveItem, onCopyTo, onSaveAsTemplate, onApplyTemplate, otherMeals }) {
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const totals = mealTotals(meal);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div onClick={() => setOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: open ? `${T.hairline} solid ${T.line}` : "none" }}>
        <input value={meal.time} onClick={(e) => e.stopPropagation()} onChange={(e) => onChangeTime(e.target.value)} style={{ width: 52, background: "transparent", border: "none", color: T.muted, fontFamily: T.sans, fontWeight: 600, fontSize: 12, outline: "none" }} />
        <div style={{ flex: 1, fontFamily: T.sans, fontWeight: 600, fontSize: 14, color: T.text }}>{meal.name}</div>
        <div style={{ fontFamily: T.sans, fontSize: 12, color: T.muted }}>{Math.round(totals.kcal)} kcal</div>
        <button onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} aria-label={`${meal.name} options`} style={{ background: "none", border: "none", color: T.dim, fontSize: 16, cursor: "pointer", padding: "0 4px", position: "relative" }}>
          ⋯
          {menuOpen && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "100%", right: 0, zIndex: 20, background: T.card2, border: `${T.hairline} solid ${T.line}`, borderRadius: 10, padding: 6, minWidth: 190, textAlign: "left" }}>
              {otherMeals.map((m) => <button key={m.key} onClick={() => { onCopyTo(m.key); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: T.text, fontFamily: T.sans, fontSize: 12, padding: "7px 8px", cursor: "pointer" }}>Copy into {m.name}</button>)}
              <button onClick={() => { onSaveAsTemplate(); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: T.text, fontFamily: T.sans, fontSize: 12, padding: "7px 8px", cursor: "pointer" }}>Save as template</button>
            </div>
          )}
        </button>
      </div>
      {open && (
        <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {meal.items.length === 0 && <div style={{ color: T.dim, fontSize: 12, padding: "4px 0" }}>No foods yet.</div>}
          {meal.items.map((it) => {
            const food = normalizeFoodRow(foods.find((f) => f.id === it.foodId) || { id: it.foodId, name: it.name, kcal: 0, protein: 0, carbs: 0, fat: 0, unit: "g" });
            return (
              <div key={it.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 64px 84px 32px", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: T.sans, fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                <input value={it.qty} onChange={(e) => onUpdateQty(it.id, e.target.value)} inputMode="decimal" style={{ ...inputStyle({ padding: "6px 8px", fontSize: 13 }) }} />
                <select value={it.unit} onChange={(e) => onUpdateUnit(it.id, e.target.value)} style={{ ...inputStyle({ padding: "6px 6px", fontSize: 12 }) }}>
                  {food.servings.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select>
                <button onClick={() => onRemoveItem(it.id)} aria-label={`Remove ${it.name}`} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            );
          })}
          <FoodSearchRow foods={foods} onAdd={onAddItem} />
          {templates.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {templates.map((t) => <button key={t.id} onClick={() => onApplyTemplate(t)} style={{ height: 30, padding: "0 10px", borderRadius: 999, background: T.card2, border: `${T.hairline} solid ${T.line}`, color: T.muted, fontFamily: T.sans, fontSize: 11, cursor: "pointer" }}>+ {t.name}</button>)}
            </div>
          )}
          <textarea value={meal.note || ""} onChange={(e) => onChangeNote(e.target.value)} placeholder="Note for this meal (optional)" rows={2} style={{ ...inputStyle({ minHeight: 50, resize: "vertical" }) }} />
        </div>
      )}
    </Card>
  );
}

function PublishSheet({ draft, warnings, onClose, onConfirm }) {
  const [from, setFrom] = useState(draft.from || isoDate());
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 600, color: T.text, marginBottom: 10 }}>Publish plan v{draft.version}</div>
        <label style={{ display: "block", marginBottom: 12 }}>
          <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Effective from</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle()} />
        </label>
        {warnings.length > 0 && (
          <div style={{ background: T.yellowBg, border: `${T.hairline} solid ${T.yellow}`, borderRadius: 10, padding: 10, marginBottom: 12, color: T.yellow, fontSize: 12, lineHeight: 1.5 }}>
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>Your client will see this from {fmtDate(from)}. Earlier dates keep whatever version was live then — past days are never rewritten.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={() => onConfirm(from)} style={{ flex: 1 }}>{warnings.length ? "Publish anyway" : `Publish v${draft.version}`}</Button>
        </div>
      </Card>
    </div>
  );
}

// Coach-facing plan builder for ONE client - the unified replacement for
// the old template-library + "assign to client" flow (DECISIONS.md
// "Nutrition redesign"): there's no separate template document anymore,
// the coach edits this client's own plan directly and publishes it for
// them, versioned by effective date (see nutritionV2Math.js's
// planForDate/publishPlan for the exact versioning rules this builds on).
export function CoachPlanBuilderV2({ client, updateClient }) {
  const [plans, setPlans] = useState(() => normalizePlans(client.nutritionV2Plans));
  const [foods, setFoods] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [publishOpen, setPublishOpen] = useState(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [library, presets] = await Promise.all([loadFoodLibrary(client.trainer_id), loadMealPresets(client.trainer_id)]);
      if (cancelled) return;
      setFoods(library.map(normalizeFoodRow));
      setTemplates(presets);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [client.trainer_id]);

  const today = isoDate();
  const livePlan = planForDate(plans, today);
  const persistedDraft = plans.find((p) => p.status === "draft") || null;
  const draft = persistedDraft || (livePlan ? nextDraftFrom(livePlan, "published") : newPlanVersion({ version: (plans.length ? Math.max(...plans.map((p) => p.version)) : 0) + 1, from: today }));

  async function flush(nextPlans) {
    setSaveStatus("saving");
    updateClient({ ...client, nutritionV2Plans: nextPlans });
    const result = await savePlans(client.id, nextPlans);
    setSaveStatus(result?.queued ? "offline" : "saved");
  }
  function commitDraft(nextDraft) {
    const nextPlans = persistedDraft ? plans.map((p) => (p.id === draft.id ? nextDraft : p)) : [...plans, nextDraft];
    setPlans(nextPlans);
    setSaveStatus("draft");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flush(nextPlans), 1200);
  }
  function patchTarget(key, value) { commitDraft({ ...draft, targets: { ...draft.targets, [key]: Math.max(0, Number(value) || 0) } }); }
  function patchMeal(key, patch) { commitDraft({ ...draft, meals: draft.meals.map((m) => (m.key === key ? { ...m, ...patch } : m)) }); }

  function addItem(mealKey, foodRow, qty, unit) {
    const food = foodRefFromRow(foodRow);
    const meal = draft.meals.find((m) => m.key === mealKey);
    patchMeal(mealKey, { items: [...meal.items, newPlanItem(food, qty, unit)] });
  }
  function updateQty(mealKey, itemId, qty) {
    const meal = draft.meals.find((m) => m.key === mealKey);
    patchMeal(mealKey, { items: meal.items.map((it) => (it.id === itemId ? { ...it, qty: qty === "" ? "" : Math.max(0, Number(qty) || 0) } : it)) });
  }
  function updateUnit(mealKey, itemId, unitLabel) {
    const meal = draft.meals.find((m) => m.key === mealKey);
    patchMeal(mealKey, {
      items: meal.items.map((it) => {
        if (it.id !== itemId) return it;
        const food = normalizeFoodRow(foods.find((f) => f.id === it.foodId) || {});
        const grams = (Number(it.qty) || 0) * (it.unitGrams || 1);
        const nextUnitGrams = unitGramsFor(food, unitLabel) || 1;
        return { ...it, unit: unitLabel, unitGrams: nextUnitGrams, qty: Math.round((grams / nextUnitGrams) * 10) / 10 };
      }),
    });
  }
  function removeItem(mealKey, itemId) {
    const meal = draft.meals.find((m) => m.key === mealKey);
    patchMeal(mealKey, { items: meal.items.filter((it) => it.id !== itemId) });
  }
  function copyInto(fromKey, toKey) {
    const from = draft.meals.find((m) => m.key === fromKey);
    const to = draft.meals.find((m) => m.key === toKey);
    commitDraft({ ...draft, meals: draft.meals.map((m) => (m.key === toKey ? { ...m, items: [...to.items, ...from.items.map((it) => ({ ...it, id: uid() }))] } : m)) });
    showToast(`Copied into ${MEAL_NAMES[toKey]}.`, "success");
  }
  async function saveAsTemplate(meal) {
    if (!meal.items.length) return;
    const name = await promptDialog("Name this template", meal.name, { title: "Save as template" });
    if (!name) return;
    const preset = { id: uid(), name, items: meal.items.map((it) => ({ ...it, id: uid() })) };
    const next = [preset, ...templates];
    setTemplates(next);
    await saveMealPresets(client.trainer_id, next);
    showToast(`Saved "${name}" as a template.`, "success");
  }
  function applyTemplate(mealKey, template) {
    const meal = draft.meals.find((m) => m.key === mealKey);
    const cloned = template.items.map((it) => ({ ...it, id: uid() }));
    patchMeal(mealKey, { items: [...meal.items, ...cloned] });
  }

  async function doPublish(fromDateISO) {
    const finalDraft = { ...draft, from: fromDateISO };
    const errors = validatePlanVersion(finalDraft);
    if (errors.length) { showToast(errors[0], "error"); return; }
    const published = plans.filter((p) => p.status !== "draft");
    const nextPlans = publishPlan(published, finalDraft, new Date().toLocaleString());
    setPlans(nextPlans);
    await flush(nextPlans);
    setPublishOpen(false);
    showToast(`Published v${finalDraft.version} · live from ${fmtDate(fromDateISO)}`, "success");
  }

  if (loading) return <Card><div style={{ color: T.muted }}>Loading the plan…</div></Card>;

  const totals = dayTotals(draft);
  const emptyMeals = draft.meals.filter((m) => !m.items.length).map((m) => m.name);
  const targetWarnings = ["kcal", "protein", "carbs", "fat"].filter((k) => draft.targets[k] && Math.abs(totals[k] - draft.targets[k]) / draft.targets[k] > 0.05)
    .map((k) => `${MAC_LABEL[k]}: planned foods are ${Math.round(totals[k])} vs a ${draft.targets[k]} target.`);
  const warnings = [...emptyMeals.map((n) => `${n} has no foods.`), ...targetWarnings];
  const statusPill = { draft: ["Unsaved changes", T.muted], saving: ["Saving…", T.muted], saved: ["Saved", T.good], offline: ["Offline — not saved", T.bad] }[saveStatus];
  const history = plans.filter((p) => p.status !== "draft").slice().sort((a, b) => b.version - a.version);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 600, color: T.text }}>Nutrition plan {persistedDraft ? `v${draft.version} (draft)` : livePlan ? `v${draft.version} draft` : "— new"}</div>
          <div style={{ color: statusPill[1], fontSize: 12, marginTop: 2 }}>{statusPill[0]}{livePlan && livePlan.version !== draft.version ? ` · live: v${livePlan.version}` : ""}</div>
        </div>
        <Button onClick={() => setPublishOpen(true)}>Publish</Button>
      </div>

      <Card style={{ padding: 14 }}>
        <SectionLabel color={T.muted} style={{ marginBottom: 10 }}>Daily targets</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          {["kcal", "protein", "carbs", "fat"].map((k) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: T.sans, fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: MAC_COLOR[k] }} />{MAC_LABEL[k]}{k !== "kcal" ? " (g)" : ""}
              </span>
              <input type="number" value={draft.targets[k] || ""} onChange={(e) => patchTarget(k, e.target.value)} onFocus={(e) => e.target.select()} style={inputStyle({ fontSize: 16, fontWeight: 600 })} />
              <span style={{ color: T.dim, fontSize: 11 }}>Planned: {Math.round(totals[k])}</span>
            </div>
          ))}
        </div>
      </Card>

      {MEAL_KEYS.map((key) => {
        const meal = draft.meals.find((m) => m.key === key);
        return (
          <MealCard
            key={key} meal={meal} foods={foods} templates={templates}
            onChangeTime={(v) => patchMeal(key, { time: v })}
            onChangeNote={(v) => patchMeal(key, { note: v })}
            onAddItem={(food, qty, unit) => addItem(key, food, qty, unit)}
            onUpdateQty={(itemId, qty) => updateQty(key, itemId, qty)}
            onUpdateUnit={(itemId, unit) => updateUnit(key, itemId, unit)}
            onRemoveItem={(itemId) => removeItem(key, itemId)}
            onCopyTo={(toKey) => copyInto(key, toKey)}
            onSaveAsTemplate={() => saveAsTemplate(meal)}
            onApplyTemplate={(t) => applyTemplate(key, t)}
            otherMeals={draft.meals.filter((m) => m.key !== key)}
          />
        );
      })}

      {history.length > 0 && (
        <Card style={{ padding: 14 }}>
          <SectionLabel color={T.muted} style={{ marginBottom: 10 }}>Plan history</SectionLabel>
          <div style={{ display: "grid", gap: 8 }}>
            {history.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: T.text, padding: "6px 0", borderTop: `${T.hairline} solid ${T.line}` }}>
                <span>v{p.version} · {fmtDate(p.from)} – {p.to ? fmtDate(p.to) : "ongoing"}</span>
                <span style={{ color: p.status === "archived" ? T.dim : T.good, fontSize: 11 }}>{p.status === "archived" ? "Superseded before it started" : p === history.find((x) => x.version === livePlan?.version) ? "Live" : "Past"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {publishOpen && (
        <PublishSheet draft={draft} warnings={warnings} onClose={() => setPublishOpen(false)} onConfirm={doPublish} />
      )}
    </div>
  );
}
