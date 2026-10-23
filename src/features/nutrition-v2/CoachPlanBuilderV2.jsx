import { useEffect, useMemo, useRef, useState } from "react";
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
import { NT, MACRO_COLORS } from "./nutritionV2Theme.js";

const MAC_LABEL = { kcal: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat" };

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fieldInput(extra = {}) {
  return { width: "100%", boxSizing: "border-box", border: `1px solid ${NT.lineSoft}`, background: NT.card2, color: NT.text, fontFamily: NT.sans, fontSize: 13, padding: "11px 12px", borderRadius: 12, outline: "none", ...extra };
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
// The dropdown uses an explicitly opaque background, not a translucent
// one - it's position:absolute (out of document flow), so the meal-note
// textarea right after it in flow ends up directly underneath; a see-
// through dropdown let that textarea's placeholder bleed through and
// read as doubled/overlapping text.
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
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Add a food..." style={fieldInput()} />
      {q && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 10, padding: 6, maxHeight: 280, overflow: "auto", background: NT.bg, border: `1px solid ${NT.line}`, borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
          {matches.length === 0 && fsResults.length === 0 && !fsLoading && <div style={{ color: NT.muted, fontFamily: NT.sans, fontSize: 12, padding: "8px 6px" }}>No foods match "{query.trim()}" yet.</div>}
          {matches.map((f) => (
            <button key={f.id} onClick={() => pick(f)} style={{ display: "flex", justifyContent: "space-between", width: "100%", textAlign: "left", background: "transparent", border: "none", color: NT.text, fontFamily: NT.sans, fontSize: 13, padding: "8px 8px", borderRadius: 8, cursor: "pointer" }}>
              <span>{f.name}{f.brand ? ` · ${f.brand}` : ""}</span><span style={{ color: NT.dim, fontSize: 11 }}>{f.kcal} kcal/100{f.unit === "ml" ? "ml" : "g"}</span>
            </button>
          ))}
          {fsResults.length > 0 && (
            <>
              {matches.length > 0 && <FatSecretGroupLabel />}
              {fsResults.map((f) => <FatSecretResultRow key={f.id} food={f} onClick={() => setFsPick(f)} />)}
            </>
          )}
          {fsLoading && <div style={{ color: NT.dim, fontFamily: NT.sans, fontSize: 11, padding: "6px 8px" }}>Searching FatSecret...</div>}
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
    <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, overflow: "hidden" }}>
      <div onClick={() => setOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer", borderBottom: open ? `1px solid ${NT.line}` : "none" }}>
        <input value={meal.time} onClick={(e) => e.stopPropagation()} onChange={(e) => onChangeTime(e.target.value)} style={{ width: 48, background: "transparent", border: "none", color: NT.dim, fontFamily: NT.sans, fontWeight: 600, fontSize: 11.5, outline: "none" }} />
        <div style={{ flex: 1, fontFamily: NT.sans, fontWeight: 600, fontSize: 14, color: NT.text }}>{meal.name}</div>
        <div style={{ fontFamily: NT.sans, fontSize: 12, color: NT.muted }}>{Math.round(totals.kcal)} kcal</div>
        <button onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} aria-label={`${meal.name} options`} style={{ background: "none", border: "none", color: NT.dim, fontSize: 16, cursor: "pointer", padding: "0 4px", position: "relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg>
          {menuOpen && (
            <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "100%", right: 0, zIndex: 20, background: NT.bg, border: `1px solid ${NT.line}`, borderRadius: 12, padding: 6, minWidth: 190, textAlign: "left" }}>
              {otherMeals.map((m) => <button key={m.key} onClick={() => { onCopyTo(m.key); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: NT.text, fontFamily: NT.sans, fontSize: 12, padding: "8px", cursor: "pointer" }}>Copy into {m.name}</button>)}
              <button onClick={() => { onSaveAsTemplate(); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: NT.text, fontFamily: NT.sans, fontSize: 12, padding: "8px", cursor: "pointer" }}>Save as template</button>
            </div>
          )}
        </button>
      </div>
      {open && (
        <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {meal.items.length === 0 && <div style={{ color: NT.dim, fontFamily: NT.sans, fontSize: 12, padding: "4px 0" }}>No foods yet.</div>}
          {meal.items.map((it) => {
            const food = normalizeFoodRow(foods.find((f) => f.id === it.foodId) || { id: it.foodId, name: it.name, kcal: 0, protein: 0, carbs: 0, fat: 0, unit: "g" });
            return (
              <div key={it.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 60px 80px 28px", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: NT.sans, fontSize: 13, color: NT.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                <input value={it.qty} onChange={(e) => onUpdateQty(it.id, e.target.value)} inputMode="decimal" style={fieldInput({ padding: "6px 8px", fontSize: 13 })} />
                <select value={it.unit} onChange={(e) => onUpdateUnit(it.id, e.target.value)} style={fieldInput({ padding: "6px 6px", fontSize: 12 })}>
                  {food.servings.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                </select>
                <button onClick={() => onRemoveItem(it.id)} aria-label={`Remove ${it.name}`} style={{ background: "none", border: "none", color: NT.dim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
            );
          })}
          <FoodSearchRow foods={foods} onAdd={onAddItem} />
          {templates.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {templates.map((t) => <button key={t.id} onClick={() => onApplyTemplate(t)} style={{ height: 30, padding: "0 10px", borderRadius: 999, background: NT.card2, border: `1px solid ${NT.lineSoft}`, color: NT.muted, fontFamily: NT.sans, fontSize: 11, cursor: "pointer" }}>+ {t.name}</button>)}
            </div>
          )}
          <textarea value={meal.note || ""} onChange={(e) => onChangeNote(e.target.value)} placeholder="Note for this meal (optional)" rows={2} style={fieldInput({ minHeight: 50, resize: "vertical" })} />
        </div>
      )}
    </div>
  );
}

function PublishSheet({ draft, warnings, onClose, onConfirm }) {
  const [from, setFrom] = useState(draft.from || isoDate());
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18 }}>
        <div style={{ fontFamily: NT.display, fontSize: 20, fontWeight: 600, color: NT.text, marginBottom: 10 }}>Publish plan v{draft.version}</div>
        <label style={{ display: "block", marginBottom: 12 }}>
          <div style={{ fontFamily: NT.sans, fontSize: 11, color: NT.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Effective from</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={fieldInput()} />
        </label>
        {warnings.length > 0 && (
          <div style={{ background: "rgba(227,164,92,.1)", border: `1px solid ${NT.accentBg}`, borderRadius: 12, padding: 10, marginBottom: 12, color: NT.accent, fontFamily: NT.sans, fontSize: 12, lineHeight: 1.5 }}>
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
        <div style={{ color: NT.muted, fontFamily: NT.sans, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>Your client will see this from {fmtDate(from)}. Earlier dates keep whatever version was live then — past days are never rewritten.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${NT.lineSoft}`, color: NT.muted, fontFamily: NT.sans, fontSize: 13, fontWeight: 600, padding: 13, borderRadius: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => onConfirm(from)} style={{ flex: 1, background: NT.accent, border: "none", color: NT.bg, fontFamily: NT.sans, fontSize: 13, fontWeight: 700, padding: 13, borderRadius: 14, cursor: "pointer" }}>{warnings.length ? "Publish anyway" : `Publish v${draft.version}`}</button>
        </div>
      </div>
    </div>
  );
}

// Coach-facing plan builder for ONE client - the unified replacement for
// the old template-library + "assign to client" flow (DECISIONS.md
// "Nutrition redesign"), restyled with the warm look (DECISIONS.md
// "Nutrition redesign v2"). There's no separate template document
// anymore, the coach edits this client's own plan directly and
// publishes it for them, versioned by effective date (see
// nutritionV2Math.js's planForDate/publishPlan for the exact
// versioning rules this builds on).
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

  if (loading) return <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18, color: NT.muted, fontFamily: NT.sans }}>Loading the plan…</div>;

  const totals = dayTotals(draft);
  const emptyMeals = draft.meals.filter((m) => !m.items.length).map((m) => m.name);
  const targetWarnings = ["kcal", "protein", "carbs", "fat"].filter((k) => draft.targets[k] && Math.abs(totals[k] - draft.targets[k]) / draft.targets[k] > 0.05)
    .map((k) => `${MAC_LABEL[k]}: planned foods are ${Math.round(totals[k])} vs a ${draft.targets[k]} target.`);
  const warnings = [...emptyMeals.map((n) => `${n} has no foods.`), ...targetWarnings];
  const statusPill = { draft: ["Unsaved changes", NT.muted], saving: ["Saving…", NT.muted], saved: ["Saved", NT.protein], offline: ["Offline — not saved", NT.bad] }[saveStatus];
  const history = plans.filter((p) => p.status !== "draft").slice().sort((a, b) => b.version - a.version);

  return (
    <div style={{ background: NT.bg, margin: "-14px", padding: 14, borderRadius: 20, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: NT.display, fontSize: 20, fontWeight: 600, color: NT.text }}>Nutrition plan {persistedDraft ? `v${draft.version} (draft)` : livePlan ? `v${draft.version} draft` : "— new"}</div>
          <div style={{ color: statusPill[1], fontFamily: NT.sans, fontSize: 12, marginTop: 2 }}>{statusPill[0]}{livePlan && livePlan.version !== draft.version ? ` · live: v${livePlan.version}` : ""}</div>
        </div>
        <button onClick={() => setPublishOpen(true)} style={{ background: NT.accent, color: NT.bg, border: "none", fontFamily: NT.sans, fontSize: 13, fontWeight: 700, padding: "11px 20px", borderRadius: 999, cursor: "pointer" }}>Publish</button>
      </div>

      <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18 }}>
        <div style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.muted, marginBottom: 14 }}>Daily targets</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 14 }}>
          {["kcal", "protein", "carbs", "fat"].map((k) => (
            <div key={k}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: NT.sans, fontSize: 10.5, color: NT.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 2, background: MACRO_COLORS[k] }} />{MAC_LABEL[k]}{k !== "kcal" ? " (g)" : ""}
              </div>
              <input type="number" value={draft.targets[k] || ""} onChange={(e) => patchTarget(k, e.target.value)} onFocus={(e) => e.target.select()} style={fieldInput({ fontFamily: NT.display, fontSize: 19, fontWeight: 600, padding: "10px 12px" })} />
              <div style={{ color: NT.faint, fontFamily: NT.sans, fontSize: 10.5, marginTop: 5 }}>Planned: {Math.round(totals[k])}</div>
            </div>
          ))}
        </div>
      </div>

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
        <div style={{ background: NT.card, border: `1px solid ${NT.line}`, borderRadius: 20, padding: 18 }}>
          <div style={{ fontFamily: NT.sans, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: NT.muted, marginBottom: 10 }}>Plan history</div>
          <div style={{ display: "grid", gap: 8 }}>
            {history.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: NT.sans, fontSize: 13, color: NT.text, padding: "8px 0", borderTop: `1px solid ${NT.line}` }}>
                <span>v{p.version} · {fmtDate(p.from)} – {p.to ? fmtDate(p.to) : "ongoing"}</span>
                <span style={{ color: p.status === "archived" ? NT.dim : NT.protein, fontSize: 11 }}>{p.status === "archived" ? "Superseded before it started" : p === history.find((x) => x.version === livePlan?.version) ? "Live" : "Past"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {publishOpen && (
        <PublishSheet draft={draft} warnings={warnings} onClose={() => setPublishOpen(false)} onConfirm={doPublish} />
      )}
    </div>
  );
}
