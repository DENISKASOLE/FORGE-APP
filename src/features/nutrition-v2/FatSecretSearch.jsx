import { useEffect, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { getFoodServings } from "../../lib/fatsecret.js";

export function FatSecretResultRow({ food, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", justifyContent: "space-between", width: "100%", textAlign: "left", background: "transparent", border: "none", color: T.text, fontFamily: T.sans, fontSize: 13, padding: "8px 8px", borderRadius: 8, cursor: "pointer" }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{food.name}{food.brand ? ` · ${food.brand}` : ""}</span>
      <span style={{ color: T.dim, fontSize: 11, flexShrink: 0, marginLeft: 8 }}>{food.kcal} kcal{food.serving ? ` / ${food.serving}` : ""}</span>
    </button>
  );
}
export function FatSecretGroupLabel() {
  return <div style={{ fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em", padding: "8px 8px 2px" }}>From FatSecret</div>;
}

// Picks a serving + quantity for one FatSecret food - search results only
// carry one summary serving's macros, so the real serving list (and the
// other servings a food can be logged in) is fetched fresh on open.
// onAdd(serving, multiplier) hands back the chosen serving's own macros
// and how many of it; the caller turns that into a plan item or a log
// entry via fatSecretFoodRow() in nutritionV2Model.js.
export function FatSecretServingSheet({ food, onClose, onAdd }) {
  const [servings, setServings] = useState(null);
  const [servingIdx, setServingIdx] = useState(0);
  const [qty, setQty] = useState("1");
  useEffect(() => {
    let cancelled = false;
    const fallback = [{ desc: food.serving || "1 serving", kcal: food.kcal || 0, protein: food.protein || 0, carbs: food.carbs || 0, fats: food.fats || 0, amount: "", unit: "" }];
    getFoodServings(food.id)
      .then((data) => { if (!cancelled) setServings(data.servings?.length ? data.servings : fallback); })
      .catch(() => { if (!cancelled) setServings(fallback); });
    return () => { cancelled = true; };
  }, [food]);
  const serving = servings?.[servingIdx];
  const mult = Number(qty) || 0;

  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 15, color: T.text }}>{food.name}</div>
        {food.brand && <div style={{ color: T.muted, fontSize: 12, marginTop: 2, marginBottom: 10 }}>{food.brand}</div>}
        {!servings ? (
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
            {serving && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 12 }}>
                <Mini label="kcal" value={Math.round(serving.kcal * mult)} />
                <Mini label="protein" value={`${Math.round(serving.protein * mult)}g`} />
                <Mini label="carbs" value={`${Math.round(serving.carbs * mult)}g`} />
                <Mini label="fats" value={`${Math.round(serving.fats * mult)}g`} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
              <Button disabled={!serving || mult <= 0} onClick={() => onAdd(serving, mult)} style={{ flex: 1 }}>Add</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
