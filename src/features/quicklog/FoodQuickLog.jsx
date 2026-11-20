import { useEffect, useRef, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Sheet } from "../../components/ui/Sheet.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { useFatSecretResults, getFoodServings, lookupBarcode } from "../../lib/fatsecret.js";
import { mealChoices, foodEntry, addFoodEntry } from "./quickLogData.js";

const inputS = { width: "100%", boxSizing: "border-box", height: 48, borderRadius: 14, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, padding: "0 14px", fontSize: 16, fontFamily: "inherit" };
const chip = (on) => ({ padding: "8px 12px", borderRadius: 12, border: `1px solid ${on ? BRAND.gold : BRAND.line}`, background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent", color: on ? BRAND.gold : BRAND.text, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
const primary = { width: "100%", height: 50, borderRadius: 14, border: "none", background: BRAND.btnBg, color: BRAND.btnInk, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

// Step 2 of both flows: pick a serving + amount + which meal, then add.
function ServingStep({ client, updateClient, food, onDone, onBack, mealKey: fixedMeal, dateISO }) {
  const [servings, setServings] = useState(food.servings?.length ? food.servings : null);
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const { meals, defaultKey } = mealChoices(client, dateISO);
  const [mealKey, setMealKey] = useState(fixedMeal || defaultKey);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (servings) return;
    let cancelled = false;
    getFoodServings(food.id)
      .then((d) => { if (!cancelled) setServings(d.servings?.length ? d.servings : [{ desc: food.serving || "1 serving", kcal: food.kcal || 0, protein: food.protein || 0, carbs: food.carbs || 0, fats: food.fats || 0 }]); })
      .catch(() => { if (!cancelled) setServings([{ desc: food.serving || "1 serving", kcal: food.kcal || 0, protein: food.protein || 0, carbs: food.carbs || 0, fats: food.fats || 0 }]); });
    return () => { cancelled = true; };
  }, [food, servings]);
  const s = servings?.[idx];
  const mealName = meals.find((m) => m.key === mealKey)?.name || "meal";

  async function add() {
    if (!s || qty <= 0) return;
    setSaving(true);
    try {
      await addFoodEntry(client, updateClient, foodEntry({ food, serving: s, qty, mealKey, ...(dateISO ? { dateISO } : {}) }));
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
      showToast(`Added to ${mealName}.`, "success");
      onDone();
    } catch {
      showToast("Couldn't save - check your connection and try again.", "warn");
    } finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 19, fontWeight: 600 }}>{food.name}</div>
        {food.brand && <div style={{ color: BRAND.muted, fontSize: 13 }}>{food.brand}</div>}
      </div>
      {!servings ? <div style={{ color: BRAND.muted, fontSize: 13, padding: "16px 0", textAlign: "center" }}>Loading servings…</div> : (
        <>
          {servings.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {servings.map((sv, i) => <button key={i} onClick={() => setIdx(i)} style={chip(i === idx)}>{sv.desc}</button>)}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 14, color: BRAND.muted }}>Servings</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setQty(Math.max(0.5, Math.round((qty - 0.5) * 10) / 10))} aria-label="Less" style={stepBtn}>−</button>
              <span style={{ minWidth: 36, textAlign: "center", fontFamily: BRAND.display, fontSize: 18, fontWeight: 600 }}>{qty}</span>
              <button onClick={() => setQty(Math.round((qty + 0.5) * 10) / 10)} aria-label="More" style={stepBtn}>+</button>
            </div>
          </div>
          {s && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8, textAlign: "center" }}>
              {[["kcal", s.kcal, BRAND.text, ""], ["Carbs", s.carbs, "var(--blue)", "g"], ["Fat", s.fats, "var(--violet)", "g"], ["Protein", s.protein, "var(--green)", "g"]].map(([l, v, c, u]) => (
                <div key={l} style={{ padding: "8px 4px", borderRadius: 12, background: BRAND.card2 }}>
                  <div style={{ fontFamily: BRAND.display, fontSize: 16, fontWeight: 600, color: c }}>{Math.round((v || 0) * qty)}{u}</div>
                  <div style={{ fontSize: 11, color: BRAND.muted }}>{l}</div>
                </div>
              ))}
            </div>
          )}
          <div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginBottom: 6 }}>Add to</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {meals.map((m) => <button key={m.key} onClick={() => setMealKey(m.key)} style={chip(m.key === mealKey)}>{m.name}</button>)}
            </div>
          </div>
          <button onClick={add} disabled={saving || !s} style={primary}>{saving ? "Saving…" : `Add to ${mealName}`}</button>
        </>
      )}
      <button onClick={onBack} style={{ background: "none", border: "none", color: BRAND.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
    </div>
  );
}
const stepBtn = { width: 36, height: 36, borderRadius: 99, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, fontSize: 18, cursor: "pointer", display: "grid", placeItems: "center", padding: 0 };

export function FoodSearchSheet({ client, updateClient, onClose, mealKey, dateISO }) {
  const [q, setQ] = useState("");
  const [food, setFood] = useState(null);
  const { results, loading } = useFatSecretResults(q);
  return (
    <Sheet title={food ? "Add food" : "Log food"} onClose={onClose}>
      {food ? <ServingStep client={client} updateClient={updateClient} food={food} onDone={onClose} onBack={() => setFood(null)} mealKey={mealKey} dateISO={dateISO} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 320 }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods, e.g. banana, Greek yogurt" style={inputS} aria-label="Search foods" />
          {loading && <div style={{ color: BRAND.muted, fontSize: 13 }}>Searching…</div>}
          {!loading && q.trim() && results.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>No foods found. Try another word.</div>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(q.trim() ? results : []).map((f) => (
              <button key={f.id} onClick={() => setFood(f)} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 2px", border: "none", borderBottom: `1px solid ${BRAND.line}`, background: "none", color: BRAND.text, textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>
                <span style={{ minWidth: 0 }}>{f.name}{f.brand ? <span style={{ color: BRAND.muted }}> · {f.brand}</span> : null}</span>
                <span style={{ color: BRAND.muted, fontSize: 12, flexShrink: 0 }}>{f.kcal} kcal{f.serving ? ` / ${f.serving}` : ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

// Camera barcode scanner (ZXing, loaded only when opened). On a hit it
// looks the code up on FatSecret and moves to the serving step. Typing
// the number works as a fallback (no camera permission, damaged label).
export function BarcodeSheet({ client, updateClient, onClose, onSearchInstead, mealKey, dateISO }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const busyRef = useRef(false);
  const [status, setStatus] = useState("starting");
  const [manual, setManual] = useState("");
  const [food, setFood] = useState(null);
  const [attempt, setAttempt] = useState(0);

  async function lookup(code) {
    if (busyRef.current) return;
    busyRef.current = true;
    controlsRef.current?.stop();
    setStatus("looking");
    try {
      const f = await lookupBarcode(code);
      if (!f.name) throw new Error("barcode not found");
      setFood(f);
    } catch {
      setStatus("notfound");
      busyRef.current = false;
    }
  }

  useEffect(() => {
    if (food) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current, (result) => {
          if (result && !cancelled) lookup(result.getText());
        });
        if (cancelled) controls.stop(); else { controlsRef.current = controls; setStatus((s) => (s === "starting" ? "scanning" : s)); }
      } catch {
        if (!cancelled) setStatus("nocamera");
      }
    })();
    return () => { cancelled = true; controlsRef.current?.stop(); };
  }, [food, attempt]);

  if (food) {
    return <Sheet title="Add food" onClose={onClose}><ServingStep client={client} updateClient={updateClient} food={food} onDone={onClose} mealKey={mealKey} dateISO={dateISO} onBack={() => { setFood(null); busyRef.current = false; setStatus("starting"); }} /></Sheet>;
  }
  const msg = { starting: "Starting camera…", scanning: "Point the camera at the barcode.", looking: "Looking it up…", notfound: "Barcode not found. Try again, type the number, or search by name.", nocamera: "Camera not available. Type the barcode number below or search by name." }[status];
  return (
    <Sheet title="Scan barcode" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 18, overflow: "hidden", background: "#000" }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div aria-hidden="true" style={{ position: "absolute", left: "12%", right: "12%", top: "38%", height: "24%", border: "2px solid rgba(255,255,255,.85)", borderRadius: 12 }} />
        </div>
        <div style={{ fontSize: 13, color: status === "notfound" || status === "nocamera" ? BRAND.orange : BRAND.muted, textAlign: "center" }}>{msg}</div>
        {status === "notfound" && <button onClick={() => { busyRef.current = false; setStatus("starting"); setAttempt((a) => a + 1); }} style={{ ...primary, background: BRAND.card2, color: BRAND.text }}>Scan again</button>}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Barcode number" style={{ ...inputS, flex: 1 }} aria-label="Barcode number" />
          <button onClick={() => manual.length >= 8 && lookup(manual)} disabled={manual.length < 8} style={{ ...primary, width: 90 }}>Find</button>
        </div>
        <button onClick={onSearchInstead} style={{ background: "none", border: "none", color: BRAND.gold, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Search by name instead</button>
      </div>
    </Sheet>
  );
}
