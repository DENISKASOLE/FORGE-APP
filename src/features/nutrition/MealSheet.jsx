import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Sheet } from "../../components/ui/Sheet.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { usePhotoUrl, uploadClientPhoto, deleteClientPhoto, isStoragePath } from "../../lib/storage.js";
import { compressImage } from "../../lib/compressImage.js";
import { emptyMealEntry } from "../../lib/nutrition.js";
import { showToast } from "../../components/ui/Toast.jsx";

// Grouped by how much cooking fat the method typically adds, and coloured
// by that - so the colour carries real information for the coach reading
// the log back, rather than just being decoration. The original five keys
// (none/grilled/baked/pan/fried) are kept exactly as they were so meals
// already logged still resolve.
const FAT_TIERS = {
  none: { color: T.good, label: "No added fat" },
  little: { color: T.blue, label: "Little added fat" },
  some: { color: T.warn, label: "Some added fat" },
  lots: { color: T.bad, label: "Lots of added fat" },
};

const COOKING_METHODS = [
  { key: "none", label: "None / raw", tier: "none" },
  { key: "steamed", label: "Steamed", tier: "none" },
  { key: "boiled", label: "Boiled", tier: "none" },
  { key: "poached", label: "Poached", tier: "none" },
  { key: "grilled", label: "Grilled", tier: "none" },
  { key: "airfried", label: "Air-fried", tier: "none" },
  { key: "microwaved", label: "Microwaved", tier: "none" },
  { key: "baked", label: "Baked", tier: "little" },
  { key: "roasted", label: "Roasted", tier: "little" },
  { key: "slowcooked", label: "Slow-cooked", tier: "little" },
  { key: "pan", label: "Pan-fried", tier: "some" },
  { key: "sauteed", label: "Sautéed", tier: "some" },
  { key: "stirfried", label: "Stir-fried", tier: "some" },
  { key: "fried", label: "Deep-fried", tier: "lots" },
  { key: "battered", label: "Battered / breaded", tier: "lots" },
];

function CookingMethodChip({ method, selected, onClick }) {
  const { color } = FAT_TIERS[method.tier];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: T.sans, borderRadius: 999, padding: "8px 13px", cursor: "pointer",
        fontSize: 11, fontWeight: selected ? 700 : 500, textTransform: "uppercase", letterSpacing: "0.1em",
        whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 7,
        background: selected ? `color-mix(in srgb, ${color} 22%, transparent)` : T.card2,
        border: `1.5px solid ${selected ? color : T.line}`,
        color: selected ? color : T.muted,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, opacity: selected ? 1 : 0.55 }} />
      {method.label}
    </button>
  );
}

function IngredientRow({ ingredient, onChange, onRemove }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, alignItems: "end" }}>
      <label>
        {/* Full ink, not muted: these sat at the same grey as the input
            placeholders beneath them, so label and example text blurred
            into one another. */}
        <div style={{ color: T.accent, fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.14em" }}>Item</div>
        <input value={ingredient.item} onChange={(e) => onChange({ ...ingredient, item: e.target.value })} placeholder="rolled oats" style={inputStyle({ fontSize: 14 })} />
      </label>
      <label>
        {/* Full ink, not muted: these sat at the same grey as the input
            placeholders beneath them, so label and example text blurred
            into one another. */}
        <div style={{ color: T.accent, fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.14em" }}>Amount</div>
        <input value={ingredient.amount} onChange={(e) => onChange({ ...ingredient, amount: e.target.value })} placeholder="80" inputMode="decimal" style={inputStyle({ fontSize: 14 })} />
      </label>
      <label>
        {/* Full ink, not muted: these sat at the same grey as the input
            placeholders beneath them, so label and example text blurred
            into one another. */}
        <div style={{ color: T.accent, fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.14em" }}>Unit</div>
        <input value={ingredient.unit} onChange={(e) => onChange({ ...ingredient, unit: e.target.value })} placeholder="g" style={inputStyle({ fontSize: 14 })} />
      </label>
      <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: T.bad, fontWeight: 500, fontSize: 20, cursor: "pointer", height: 44 }}>×</button>
    </div>
  );
}

export function MealSheet({ clientId, slot, initial, accentColor, onSave, onDelete, onClose }) {
  const isEditing = !!initial;
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [existingPhoto, setExistingPhoto] = useState(initial?.photo || "");
  const existingPhotoUrl = usePhotoUrl(existingPhoto);
  const [time, setTime] = useState(initial?.time || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [method, setMethod] = useState(initial?.method || "none");
  const [packaged, setPackaged] = useState(!!initial?.packaged);
  const [ingredients, setIngredients] = useState(initial?.ingredients?.length ? initial.ingredients : [{ item: "", amount: "", unit: "g" }]);
  const [saving, setSaving] = useState(false);

  function pickPhoto(file) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setExistingPhoto("");
  }
  function updateIngredient(i, next) {
    setIngredients((rows) => rows.map((r, idx) => (idx === i ? next : r)));
  }
  function removeIngredient(i) {
    setIngredients((rows) => rows.filter((_, idx) => idx !== i));
  }
  function addIngredient() {
    setIngredients((rows) => [...rows, { item: "", amount: "", unit: "g" }]);
  }

  async function save() {
    setSaving(true);
    try {
      let photoPath = existingPhoto;
      if (photoFile) {
        const blob = await compressImage(photoFile);
        photoPath = await uploadClientPhoto(clientId, "nutrition", blob);
        if (isStoragePath(initial?.photo)) await deleteClientPhoto(initial.photo);
      }
      const cleanIngredients = ingredients.filter((i) => i.item.trim()).map((i) => ({ item: i.item.trim(), amount: Number(i.amount) || 0, unit: i.unit.trim() || "g" }));
      await onSave({ ...emptyMealEntry(), time, photo: photoPath, description: description.trim(), method, packaged, ingredients: cleanIngredients });
    } catch (error) {
      showToast(error.message || "Couldn't save this meal. Check your connection and try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
  // Falls back to "none" so a meal logged before a method existed (or with
  // a key since removed) still renders instead of throwing on lookup.
  const selectedTier = COOKING_METHODS.find((m) => m.key === method)?.tier || "none";

  return (
    <Sheet title={`${isEditing ? "Edit" : "Log"} ${slotLabel}`} onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        {photoPreview || existingPhotoUrl ? (
          <div style={{ position: "relative" }}>
            <img src={photoPreview || existingPhotoUrl} alt="meal" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 14 }} />
            <label style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,.7)", color: "#fff", fontSize: 11, fontWeight: 500, padding: "8px 12px", borderRadius: 999, cursor: "pointer" }}>
              Retake
              <input type="file" accept="image/*" capture="environment" onChange={(e) => pickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
            </label>
          </div>
        ) : (
          <label style={{ display: "grid", placeItems: "center", height: 160, background: `color-mix(in srgb, ${accentColor || T.blue} 8%, ${T.card2})`, border: `2px dashed ${accentColor || T.blue}`, borderRadius: 14, cursor: "pointer", color: accentColor || T.blue, fontWeight: 600, gap: 6 }}>
            <span style={{ fontSize: 28 }}>📷</span>
            <span>Take a photo of your meal</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: T.muted }}>Optional, but it makes your report far more useful</span>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => pickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
          </label>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
          <Field label="Time" type="time" value={time} onChange={setTime} />
          {/* Was a bare native checkbox, which renders as a stark white
              square on a dark sheet. Styled as a toggle tile instead. */}
          <button
            type="button"
            onClick={() => setPackaged((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer",
              background: packaged ? `color-mix(in srgb, ${T.violet} 18%, transparent)` : T.card2,
              border: `1.5px solid ${packaged ? T.violet : T.line}`,
              borderRadius: 12, padding: "11px 12px", fontFamily: T.sans,
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: "grid", placeItems: "center",
              background: packaged ? T.violet : "transparent",
              border: `1.5px solid ${packaged ? T.violet : T.line}`,
              color: T.btnInk, fontSize: 12, fontWeight: 700, lineHeight: 1,
            }}>{packaged ? "✓" : ""}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: packaged ? T.violet : T.muted, lineHeight: 1.3 }}>
              Packaged / has a label
            </span>
          </button>
        </div>

        <Field label="Description" value={description} onChange={setDescription} placeholder="e.g. Oats, berries + whey" />

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <SectionLabel color={accentColor || T.accent}>Cooking method</SectionLabel>
            <span style={{ fontFamily: T.sans, fontSize: 10, color: FAT_TIERS[selectedTier].color, fontWeight: 600 }}>
              {FAT_TIERS[selectedTier].label}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {COOKING_METHODS.map((m) => (
              <CookingMethodChip key={m.key} method={m} selected={method === m.key} onClick={() => setMethod(m.key)} />
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <SectionLabel color={accentColor || T.accent}>Ingredients</SectionLabel>
          {ingredients.map((row, i) => (
            <IngredientRow key={i} ingredient={row} onChange={(next) => updateIngredient(i, next)} onRemove={() => removeIngredient(i)} />
          ))}
          <Button variant="dark" onClick={addIngredient}>+ Add ingredient</Button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {isEditing && onDelete && <Button variant="red" onClick={onDelete} style={{ flex: 1 }}>Delete</Button>}
          <Button onClick={save} disabled={saving} style={{ flex: 2 }}>
            {saving ? "Saving..." : "Save meal"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
