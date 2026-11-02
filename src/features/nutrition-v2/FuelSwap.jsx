import { useState } from "react";
import { showToast } from "../../components/ui/Toast.jsx";
import { startOfWeek, addDays } from "../../lib/dateUtils.js";
import { uid } from "../../lib/uid.js";
import { compressImage } from "../../lib/compressImage.js";
import { uploadClientPhoto } from "../../lib/storage.js";
import { itemMacros, mealTotals, resolvePlanDayNum, dayOfWeekISO } from "./nutritionV2Math.js";
import { emptyMacros } from "./nutritionV2Model.js";
import { FUEL, fuelLbl } from "./fuelTheme.js";

const SIZE_OPTIONS = ["Small", "Normal", "Large"];
// A swap option counts as "noticeably less protein" than the planned
// meal at this gap - matches this codebase's other "is this a real
// difference" thresholds (macroSanityCheck, HEAVY_EXTRAS_PCT).
const SWAP_PROTEIN_GAP_PCT = 0.15;

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtTime12(hhmm) {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
function weekdayName(dayNum, todayISO) {
  const monday = startOfWeek(new Date(`${todayISO}T00:00:00`));
  return addDays(monday, dayNum - 1).toLocaleDateString(undefined, { weekday: "long" });
}
// "Chapati and chicken curry" from the meal's first two items - a short,
// readable title for the radio card; the full ingredient line (with
// amounts) goes underneath as the subtitle.
function mealShortTitle(items) {
  if (!items.length) return "Nothing planned";
  const names = items.length === 1 ? [items[0].name] : [items[0].name, items[1].name];
  const joined = names.join(" and ").toLowerCase();
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}
function itemsLine(items) {
  return items.map((it) => `${it.qty}${it.unit === "piece" ? "" : ` ${it.unit}`} ${it.name.toLowerCase()}`).join(", ");
}
// Every OTHER weekday in the current rotation that has a different meal
// for this slot - deduped, since a plan with no rotation set up yet
// resolves every weekday to the identical default meal, and offering 6
// copies of "swap for the exact same meal" would be useless.
function swapOptionsFor(plan, mealKey, todayDayNum, todayISO) {
  const seen = new Set();
  const options = [];
  for (let dayNum = 1; dayNum <= 7; dayNum++) {
    if (dayNum === todayDayNum) continue;
    const resolved = resolvePlanDayNum(plan, dayNum);
    const meal = resolved?.meals?.find((m) => m.key === mealKey);
    if (!meal || !meal.items.length) continue;
    const key = meal.items.map((it) => `${it.name}:${it.qty}:${it.unit}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ dayNum, dayName: weekdayName(dayNum, todayISO), meal, totals: mealTotals(meal) });
  }
  return options;
}

// Client · Change a meal (docs/design/fuel-tab/Swap.dc.html,
// DECISIONS.md "Fuel tab redesign"). A bottom sheet over Today with 3
// independent ways to log a meal that didn't go to plan - no-shame
// logging throughout, nothing here is shown in red.
//
// `meal` is the plan meal being changed (its own `.items` are the
// planned prescription, shown as the fallback eating-out estimate).
// `plan`/`todayISO`/`entries`/`todayMarks`/`onWrite` mirror FuelToday's
// own props exactly, so this sheet writes through the same writeDay path.
export function FuelSwap({ client, plan, meal, todayISO, entries, todayMarks, onWrite, onClose }) {
  const todayDayNum = dayOfWeekISO(todayISO);
  const options = plan ? swapOptionsFor(plan, meal.key, todayDayNum, todayISO) : [];
  const [selectedDay, setSelectedDay] = useState(null);
  const [query, setQuery] = useState("");
  const [size, setSize] = useState("Normal");
  const [photoFile, setPhotoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const plannedTotals = mealTotals(meal);

  function replaceMealEntries(added) {
    const kept = entries.filter((e) => e.meal !== meal.key);
    return onWrite([...kept, ...added], todayMarks);
  }

  async function saveSwap(option) {
    const time = nowHHMM();
    const title = mealShortTitle(option.meal.items);
    const added = option.meal.items.map((it) => ({
      id: uid(), date: todayISO, meal: meal.key, name: title, foodId: it.foodId, qty: it.qty, unit: it.unit,
      macros: itemMacros(it), source: "sub", time, planItemId: null, estimate: false, replaces: meal.key, reason: null, photo: null,
    }));
    await replaceMealEntries(added);
    showToast(`Logged as swapped for ${meal.name}.`, "success");
    onClose();
  }

  async function logEatingOut() {
    const estimate = meal.eatingOutEstimate && Object.keys(meal.eatingOutEstimate).length ? meal.eatingOutEstimate : plannedTotals;
    const entry = {
      id: uid(), date: todayISO, meal: meal.key, name: "Eating out", foodId: null, qty: null, unit: null,
      macros: { ...emptyMacros(), ...estimate }, source: "quick", time: nowHHMM(), planItemId: null, estimate: true, replaces: null, reason: "Eating out", photo: null,
    };
    await replaceMealEntries([entry]);
    showToast(`Logged ${meal.name.toLowerCase()} as eating out.`, "success");
    onClose();
  }

  async function saveSomethingElse() {
    setSaving(true);
    let photoPath = null;
    if (photoFile) {
      try {
        const blob = await compressImage(photoFile);
        photoPath = await uploadClientPhoto(client.id, "fuel-log", blob);
      } catch {
        showToast("Couldn't upload the photo - logged without it.", "warn");
      }
    }
    const entry = {
      id: uid(), date: todayISO, meal: meal.key, name: query.trim() || "Something else", foodId: null, qty: null, unit: null,
      macros: emptyMacros(), source: photoPath ? "photo" : "quick", time: nowHHMM(), planItemId: null, estimate: true, replaces: null, reason: size, photo: photoPath,
    };
    await replaceMealEntries([entry]);
    setSaving(false);
    showToast(`Logged ${meal.name.toLowerCase()}.`, "success");
    onClose();
  }

  function saveMain() {
    const selected = options.find((o) => o.dayNum === selectedDay);
    if (selected) { saveSwap(selected); return; }
    if (query.trim() || photoFile) { saveSomethingElse(); return; }
    showToast("Pick a swap, or describe what you had, first.", "warn");
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.6)", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 64, background: FUEL.card, borderTop: `1px solid ${FUEL.lineSoft}`, borderRadius: "26px 26px 0 0", padding: "10px 20px 24px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto", color: FUEL.text, fontWeight: 700 }}>
        <div style={{ width: 40, height: 4, borderRadius: 9, background: FUEL.lineDashed, margin: "0 auto" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={fuelLbl}>{meal.name} · {fmtTime12(meal.time)}</div>
            <div style={{ fontSize: 22, marginTop: 4 }}>Change this meal</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, borderRadius: 99, background: FUEL.card2, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke={FUEL.text} strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </div>

        {options.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={fuelLbl}>1 · Swap for another plan meal</div>
            <div style={{ fontSize: 12, color: FUEL.muted, marginBottom: 2 }}>Coach-approved {meal.name.toLowerCase()}s from your week. Same job, different food.</div>
            {options.map((opt) => {
              const selected = selectedDay === opt.dayNum;
              const gap = plannedTotals.protein > 0 ? (plannedTotals.protein - opt.totals.protein) / plannedTotals.protein : 0;
              const hint = gap >= SWAP_PROTEIN_GAP_PCT && opt.meal.note ? opt.meal.note : null;
              return (
                <label key={opt.dayNum} style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, borderRadius: 16, border: `1px solid ${selected ? FUEL.text : FUEL.line}`, background: selected ? FUEL.card2 : FUEL.card, cursor: "pointer" }}>
                  <input type="radio" name="swap" checked={selected} onChange={() => setSelectedDay(opt.dayNum)} style={{ width: 20, height: 20, accentColor: FUEL.text, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{mealShortTitle(opt.meal.items)}</div>
                    <div style={{ fontSize: 12, color: FUEL.muted, marginTop: 3 }}>{opt.dayName}'s {meal.name.toLowerCase()} · {itemsLine(opt.meal.items)}</div>
                    {hint && <div style={{ fontSize: 12, color: FUEL.amber, marginTop: 4 }}>{hint}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: FUEL.protein, whiteSpace: "nowrap" }}>{Math.round(opt.totals.protein)} g<br /><span style={{ color: FUEL.muted }}>protein</span></div>
                </label>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={fuelLbl}>{options.length > 0 ? "2" : "1"} · Eating out</div>
          <div style={{ padding: 14, borderRadius: 16, background: FUEL.card2, border: `1px solid ${FUEL.line}`, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, textAlign: "center", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" }}>
              <div style={{ padding: "10px 4px", borderRadius: 12, background: FUEL.card }}><div style={{ fontSize: 18, color: FUEL.protein }}>1st</div>Grilled protein</div>
              <div style={{ padding: "10px 4px", borderRadius: 12, background: FUEL.card }}><div style={{ fontSize: 18 }}>+1</div>One starch</div>
              <div style={{ padding: "10px 4px", borderRadius: 12, background: FUEL.card }}><div style={{ fontSize: 18, color: FUEL.coral }}>Skip</div>Fried &amp; sweet drinks</div>
            </div>
            <button onClick={logEatingOut} style={{ height: 46, borderRadius: 12, border: `1px solid ${FUEL.lineSoft}`, background: FUEL.card, color: FUEL.text, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>Log as eating out</button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={fuelLbl}>{options.length > 0 ? "3" : "2"} · Something else</div>
          <div style={{ display: "flex", gap: 8 }}>
            <label aria-label="Add a photo" style={{ width: 56, height: 52, flexShrink: 0, borderRadius: 14, border: `1px dashed ${FUEL.lineDashed}`, background: FUEL.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              {photoFile
                ? <img src={URL.createObjectURL(photoFile)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 13 }} />
                : <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke={FUEL.text} strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" fill="none" stroke={FUEL.text} strokeWidth="2" /></svg>}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
            </label>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What did you eat?" style={{ flex: 1, height: 52, borderRadius: 14, border: `1px solid ${FUEL.lineSoft}`, background: FUEL.card, color: FUEL.text, padding: "0 14px", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {SIZE_OPTIONS.map((s) => (
              <button key={s} onClick={() => setSize(s)} style={{ height: 44, borderRadius: 12, border: `1px solid ${size === s ? FUEL.text : FUEL.lineSoft}`, background: size === s ? FUEL.card2 : FUEL.card, color: FUEL.text, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer" }}>{s}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: FUEL.muted }}>No counting. A photo and a word is enough. Coach Denis sees it.</div>
        </div>

        <div style={{ flex: 1 }} />
        <button onClick={saveMain} disabled={saving} style={{ height: 54, borderRadius: 16, background: FUEL.text, color: "#000", border: "none", fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : `Save ${meal.name.toLowerCase()}`}</button>
      </div>
    </div>
  );
}
