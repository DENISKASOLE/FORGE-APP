import { useEffect, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { loadFoodLibrary, saveFoodLibrary, loadPlanTemplates, loadMealPresets } from "../../lib/nutritionPlan.js";
import { FOOD_CATEGORIES, FOOD_UNITS } from "./planModel.js";
import { macroSanityCheck } from "./planMath.js";
import { seedFoods } from "./seedData.js";

const CATEGORY_LABELS = { protein: "Protein", carb: "Carb", fat: "Fat", veg: "Veg", fruit: "Fruit", dairy: "Dairy", drink: "Drink", snack: "Snack", other: "Other" };
const STATE_OPTIONS = [["", "—"], ["raw", "Raw"], ["cooked", "Cooked"], ["dry", "Dry"]];
const LABEL_STYLE = { fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.14em" };
// Spec's macro colour tokens (NUTRITION_SPEC.md §0.2) - not yet reconciled
// into theme.css/tokens.js (a deliberate separate pass, see
// docs/nutrition-recon.md), so used as literals here for now.
const KCAL_COLOR = "#22D3EE";

function emptyFoodForm() {
  return { id: null, name: "", brand: "", state: "", category: "protein", unit: "g", pieceGrams: "", kcal: "", protein: "", carbs: "", fat: "", fibre: "", groceryName: "", groceryFactor: "1", archived: false };
}
function foodToForm(food) {
  return { ...emptyFoodForm(), ...food, state: food.state || "", pieceGrams: food.pieceGrams ?? "", fibre: food.fibre ?? "", groceryName: food.groceryName || "", groceryFactor: String(food.groceryFactor ?? 1) };
}

// Add/edit sheet. Archive is the default "remove" action per spec §5.4
// ("archive instead of delete when used in a template"); hard delete only
// offered when nothing in the library actually references this food.
function FoodFormModal({ initial, onClose, onSave, onArchiveToggle, onDelete, canHardDelete }) {
  const [form, setForm] = useState(() => (initial ? foodToForm(initial) : emptyFoodForm()));
  const isEditing = !!initial?.id;
  const kcal = Number(form.kcal) || 0;
  const sanity = macroSanityCheck({ kcal, protein: Number(form.protein) || 0, carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0 });
  const showSanityWarning = kcal > 0 && !sanity.ok;

  function set(patch) { setForm((f) => ({ ...f, ...patch })); }
  function save() {
    if (!form.name.trim()) { showToast("Name is required.", "warn"); return; }
    if (form.unit === "piece" && !(Number(form.pieceGrams) > 0)) { showToast("Piece foods need a gram weight.", "warn"); return; }
    onSave({
      id: form.id || uid(), name: form.name.trim(), brand: form.brand.trim(), state: form.state || null,
      category: form.category, unit: form.unit, pieceGrams: form.unit === "piece" ? Number(form.pieceGrams) : null,
      kcal, protein: Number(form.protein) || 0, carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0,
      fibre: form.fibre === "" ? null : Number(form.fibre),
      groceryName: form.groceryName.trim() || null, groceryFactor: Number(form.groceryFactor) || 1,
      archived: !!form.archived,
    });
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 20, fontWeight: 500, color: BRAND.text }}>{isEditing ? "Edit food" : "New food"}</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <Field label="Name" value={form.name} onChange={(v) => set({ name: v })} placeholder="e.g. Chicken breast" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Brand (optional)" value={form.brand} onChange={(v) => set({ brand: v })} />
            <label><div style={LABEL_STYLE}>State</div><select value={form.state} onChange={(e) => set({ state: e.target.value })} style={inputStyle()}>{STATE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: form.unit === "piece" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
            <label><div style={LABEL_STYLE}>Category</div><select value={form.category} onChange={(e) => set({ category: e.target.value })} style={inputStyle()}>{FOOD_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></label>
            <label><div style={LABEL_STYLE}>Unit</div><select value={form.unit} onChange={(e) => set({ unit: e.target.value })} style={inputStyle()}>{FOOD_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
            {form.unit === "piece" && <Field label="Grams / piece" type="number" value={form.pieceGrams} onChange={(v) => set({ pieceGrams: v })} />}
          </div>
          <SectionLabel color={BRAND.muted} style={{ marginTop: 4 }}>Per 100{form.unit === "ml" ? "ml" : "g"}</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
            <Field label="Kcal" type="number" value={form.kcal} onChange={(v) => set({ kcal: v })} />
            <Field label="Protein" type="number" value={form.protein} onChange={(v) => set({ protein: v })} />
            <Field label="Carbs" type="number" value={form.carbs} onChange={(v) => set({ carbs: v })} />
            <Field label="Fat" type="number" value={form.fat} onChange={(v) => set({ fat: v })} />
            <Field label="Fibre" type="number" value={form.fibre} onChange={(v) => set({ fibre: v })} />
          </div>
          {showSanityWarning && (
            <div style={{ background: BRAND.yellowBg, border: `1px solid ${BRAND.yellow}`, borderRadius: 10, padding: 10, color: BRAND.yellow, fontSize: 12, lineHeight: 1.5 }}>
              Kcal doesn't quite match 4P + 4C + 9F (~{sanity.expectedKcal} kcal expected from those macros) — worth double-checking, but you can still save.
            </div>
          )}
          <SectionLabel color={BRAND.muted} style={{ marginTop: 4 }}>Grocery list</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <Field label="Grocery name" value={form.groceryName} onChange={(v) => set({ groceryName: v })} placeholder={form.name || "defaults to food name"} />
            <Field label="Factor" type="number" value={form.groceryFactor} onChange={(v) => set({ groceryFactor: v })} />
          </div>
          <div style={{ color: BRAND.dim, fontSize: 11, lineHeight: 1.5 }}>Cooked rice → buy dry rice: name "Basmati rice, dry", factor 0.35.</div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          {isEditing && <Button variant="dark" onClick={() => onArchiveToggle(form)}>{form.archived ? "Unarchive" : "Archive"}</Button>}
          {isEditing && canHardDelete && <Button variant="red" onClick={() => onDelete(form)}>Delete</Button>}
          <Button onClick={save} style={{ flex: 1 }}>Save</Button>
        </div>
      </Card>
    </div>
  );
}

export function FoodsLibraryScreen({ trainerId, onBack }) {
  const isMobile = useIsMobile(520);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null); // food object, or {} for new
  const [usedFoodIds, setUsedFoodIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [library, templates, presets] = await Promise.all([
        loadFoodLibrary(trainerId), loadPlanTemplates(trainerId), loadMealPresets(trainerId),
      ]);
      if (cancelled) return;
      // Seed on first open only - never overwrites a coach's real library.
      if (library.length === 0) {
        const seeded = seedFoods();
        await saveFoodLibrary(trainerId, seeded);
        if (!cancelled) setFoods(seeded);
      } else {
        setFoods(library);
      }
      const used = new Set();
      [...templates, ...presets].forEach((doc) => {
        const items = doc.items || (doc.doc?.days || []).flatMap((d) => (d.blocks || []).filter((b) => b.type === "meal").flatMap((b) => b.items));
        (items || []).forEach((it) => used.add(it.food?.foodId));
      });
      if (!cancelled) { setUsedFoodIds(used); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [trainerId]);

  async function persist(next) {
    setFoods(next);
    await saveFoodLibrary(trainerId, next);
  }
  function saveFood(food) {
    const exists = foods.some((f) => f.id === food.id);
    persist(exists ? foods.map((f) => (f.id === food.id ? food : f)) : [food, ...foods]);
    setEditing(null);
    showToast(exists ? "Food updated." : "Food added.", "success");
  }
  function archiveToggle(food) {
    persist(foods.map((f) => (f.id === food.id ? { ...f, archived: !f.archived } : f)));
    setEditing(null);
    showToast(food.archived ? "Food unarchived." : "Food archived.", "success");
  }
  async function hardDelete(food) {
    if (!await confirmDialog(`Delete "${food.name}"? This can't be undone.`, { danger: true, confirmLabel: "Delete" })) return;
    persist(foods.filter((f) => f.id !== food.id));
    setEditing(null);
  }

  const visible = foods
    .filter((f) => showArchived || !f.archived)
    .filter((f) => category === "all" || f.category === category)
    .filter((f) => !search.trim() || f.name.toLowerCase().includes(search.trim().toLowerCase()) || (f.brand || "").toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text }}>Foods</div>
          <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 2 }}>Your food library, used to build nutrition plans.</div>
        </div>
        <Button onClick={() => setEditing({})}>+ New Food</Button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search foods or brands..." style={inputStyle()} />
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        <Chip selected={category === "all"} onClick={() => setCategory("all")}>All</Chip>
        {FOOD_CATEGORIES.map((c) => <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>{CATEGORY_LABELS[c]}</Chip>)}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
      </label>

      {loading ? (
        <Card><div style={{ color: BRAND.muted }}>Loading your food library…</div></Card>
      ) : visible.length === 0 ? (
        <Card>
          <div style={{ color: BRAND.muted, marginBottom: 10 }}>{search.trim() ? `No foods match "${search.trim()}".` : "No foods here yet."}</div>
          {search.trim() && <Button variant="dark" onClick={() => setEditing({ name: search.trim() })}>+ Create "{search.trim()}"</Button>}
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visible.map((f) => (
            <button key={f.id} onClick={() => setEditing(f)} className="glass" style={{ textAlign: "left", cursor: "pointer", padding: 14, opacity: f.archived ? 0.5 : 1, fontFamily: BRAND.sans, border: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: BRAND.text, fontWeight: 500, fontSize: 14 }}>
                    {f.name}{f.state ? `, ${f.state}` : ""}
                    {f.archived && <span style={{ color: BRAND.dim, fontWeight: 400, fontSize: 11 }}> · archived</span>}
                  </div>
                  <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 2 }}>
                    {CATEGORY_LABELS[f.category]} · {f.brand ? `${f.brand} · ` : ""}per 100{f.unit === "ml" ? "ml" : "g"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexShrink: 0, fontSize: 12, color: BRAND.dim, textAlign: "right" }}>
                  <span style={{ color: KCAL_COLOR }}>{f.kcal} kcal</span>
                  <span>{f.protein}P</span><span>{f.carbs}C</span><span>{f.fat}F</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <FoodFormModal
          initial={editing.id ? editing : (editing.name ? { name: editing.name } : null)}
          onClose={() => setEditing(null)}
          onSave={saveFood}
          onArchiveToggle={archiveToggle}
          onDelete={hardDelete}
          canHardDelete={!editing.id || !usedFoodIds.has(editing.id)}
        />
      )}
    </div>
  );
}
