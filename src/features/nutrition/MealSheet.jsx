import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { Sheet } from "../../components/ui/Sheet.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { usePhotoUrl, uploadClientPhoto, deleteClientPhoto, isStoragePath } from "../../lib/storage.js";
import { compressImage } from "../../lib/compressImage.js";
import { emptyMealEntry } from "./data.js";

const COOKING_METHODS = [
  { key: "none", label: "None / raw" },
  { key: "grilled", label: "Grilled" },
  { key: "baked", label: "Baked" },
  { key: "pan", label: "Pan-fried" },
  { key: "fried", label: "Deep-fried" },
];

function IngredientRow({ ingredient, onChange, onRemove }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, alignItems: "end" }}>
      <label>
        <div style={{ color: T.muted, fontSize: 10, fontWeight: 800, marginBottom: 4, textTransform: "uppercase" }}>Item</div>
        <input value={ingredient.item} onChange={(e) => onChange({ ...ingredient, item: e.target.value })} placeholder="rolled oats" style={inputStyle({ fontSize: 14 })} />
      </label>
      <label>
        <div style={{ color: T.muted, fontSize: 10, fontWeight: 800, marginBottom: 4, textTransform: "uppercase" }}>Amount</div>
        <input value={ingredient.amount} onChange={(e) => onChange({ ...ingredient, amount: e.target.value })} placeholder="80" inputMode="decimal" style={inputStyle({ fontSize: 14 })} />
      </label>
      <label>
        <div style={{ color: T.muted, fontSize: 10, fontWeight: 800, marginBottom: 4, textTransform: "uppercase" }}>Unit</div>
        <input value={ingredient.unit} onChange={(e) => onChange({ ...ingredient, unit: e.target.value })} placeholder="g" style={inputStyle({ fontSize: 14 })} />
      </label>
      <button type="button" onClick={onRemove} style={{ background: "none", border: "none", color: T.bad, fontWeight: 900, fontSize: 20, cursor: "pointer", height: 44 }}>×</button>
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
    let photoPath = existingPhoto;
    if (photoFile) {
      const blob = await compressImage(photoFile);
      photoPath = await uploadClientPhoto(clientId, "nutrition", blob);
      if (isStoragePath(initial?.photo)) await deleteClientPhoto(initial.photo);
    }
    const cleanIngredients = ingredients.filter((i) => i.item.trim()).map((i) => ({ item: i.item.trim(), amount: Number(i.amount) || 0, unit: i.unit.trim() || "g" }));
    await onSave({ ...emptyMealEntry(), time, photo: photoPath, description: description.trim(), method, packaged, ingredients: cleanIngredients });
    setSaving(false);
  }

  const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);

  return (
    <Sheet title={`${isEditing ? "Edit" : "Log"} ${slotLabel}`} onClose={onClose}>
      <div style={{ display: "grid", gap: 14 }}>
        {photoPreview || existingPhotoUrl ? (
          <div style={{ position: "relative" }}>
            <img src={photoPreview || existingPhotoUrl} alt="meal" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 16 }} />
            <label style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,.7)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "8px 12px", borderRadius: 999, cursor: "pointer" }}>
              Retake
              <input type="file" accept="image/*" capture="environment" onChange={(e) => pickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
            </label>
          </div>
        ) : (
          <label style={{ display: "grid", placeItems: "center", height: 160, background: T.card2, border: `2px dashed ${T.line}`, borderRadius: 16, cursor: "pointer", color: T.muted, fontWeight: 700, gap: 6 }}>
            <span style={{ fontSize: 28 }}>📷</span>
            <span>Take a photo of your meal</span>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => pickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
          </label>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Time" type="time" value={time} onChange={setTime} />
          <label style={{ display: "flex", alignItems: "flex-end", paddingBottom: 12, gap: 8, color: T.muted, fontSize: 13, fontWeight: 700 }}>
            <input type="checkbox" checked={packaged} onChange={(e) => setPackaged(e.target.checked)} />
            Packaged / has a label
          </label>
        </div>

        <Field label="Description" value={description} onChange={setDescription} placeholder="e.g. Oats, berries + whey" />

        <div>
          <SectionLabel color={T.muted} style={{ marginBottom: 8 }}>Cooking method</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {COOKING_METHODS.map((m) => (
              <Chip key={m.key} selected={method === m.key} onClick={() => setMethod(m.key)} color={accentColor}>{m.label}</Chip>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <SectionLabel color={T.muted}>Ingredients</SectionLabel>
          {ingredients.map((row, i) => (
            <IngredientRow key={i} ingredient={row} onChange={(next) => updateIngredient(i, next)} onRemove={() => removeIngredient(i)} />
          ))}
          <Button variant="dark" onClick={addIngredient}>+ Add ingredient</Button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {isEditing && onDelete && <Button variant="red" onClick={onDelete} style={{ flex: 1 }}>Delete</Button>}
          <Button onClick={save} disabled={saving} style={{ flex: 2, background: accentColor || T.gold }}>
            {saving ? "Saving..." : "Save meal"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
