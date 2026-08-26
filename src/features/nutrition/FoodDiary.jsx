import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { usePhotoUrl, deleteClientPhoto, isStoragePath } from "../../lib/storage.js";
import { isoDate, addDays } from "../../lib/dateUtils.js";
import { MEAL_SLOTS, dayLogFor, saveNutritionState } from "../../lib/nutrition.js";
import { MealSheet } from "./MealSheet.jsx";

function MealThumb({ photo, size = 44 }) {
  const url = usePhotoUrl(photo);
  if (!url) return null;
  return <img src={url} alt="" style={{ width: size, height: size, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />;
}

function MealRow({ label, color, entry, onClick, onEdit }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 0", cursor: "pointer" }}>
      {entry ? <MealThumb photo={entry.photo} /> : <div style={{ width: 44, height: 44, borderRadius: 10, background: T.card2, border: `1px dashed ${T.line}`, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
        <div style={{ color: entry ? T.accent : T.dim, fontSize: 13, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {entry ? (entry.description || "Logged, no description") : "Tap to log"}
        </div>
      </div>
      {entry && <span style={{ color: T.muted, fontSize: 11, fontWeight: 700 }}>{onEdit ? "Edit" : ""}</span>}
    </button>
  );
}

export function FoodDiary({ client, updateClient, nutrition, phase }) {
  const [date, setDate] = useState(isoDate());
  const [editing, setEditing] = useState(null); // { slot: 'breakfast'|'lunch'|'dinner'|'snacks', index? }

  const day = dayLogFor(nutrition, date);
  const loggedCount = MEAL_SLOTS.filter((s) => day[s]).length + (day.snacks.length > 0 ? 1 : 0);

  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(new Date(`${nutrition.week_of}T00:00:00`), i)));
  const today = isoDate();

  async function persist(nextNutrition) {
    updateClient({ ...client, nutrition: nextNutrition });
    await saveNutritionState(client.id, nextNutrition);
  }

  function saveMeal(entry) {
    const nextDay = { ...day };
    if (editing.slot === "snacks") {
      const snacks = [...day.snacks];
      if (editing.index != null) snacks[editing.index] = entry; else snacks.push(entry);
      nextDay.snacks = snacks;
    } else {
      nextDay[editing.slot] = entry;
    }
    persist({ ...nutrition, food_log: { ...nutrition.food_log, [date]: nextDay } });
    setEditing(null);
  }

  async function deleteMeal() {
    const removed = editing.slot === "snacks" ? day.snacks[editing.index] : day[editing.slot];
    const nextDay = { ...day };
    if (editing.slot === "snacks") nextDay.snacks = day.snacks.filter((_, i) => i !== editing.index);
    else nextDay[editing.slot] = null;
    persist({ ...nutrition, food_log: { ...nutrition.food_log, [date]: nextDay } });
    setEditing(null);
    if (removed && isStoragePath(removed.photo)) await deleteClientPhoto(removed.photo);
  }

  const heading = phase === "adjustment" ? "Log your new plan" : "Log your current eating";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <SectionLabel>{phase === "adjustment" ? "Adjustment week" : "Baseline week"}</SectionLabel>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.accent, marginTop: 4 }}>{heading}</div>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        {weekDates.map((d) => {
          const dt = new Date(`${d}T00:00:00`);
          const dLog = nutrition.food_log[d];
          const logged = dLog && (MEAL_SLOTS.some((s) => dLog[s]) || dLog.snacks?.length);
          const selected = d === date;
          return (
            <button key={d} onClick={() => setDate(d)} style={{ flex: "0 0 auto", width: 42, padding: "8px 0", borderRadius: 12, cursor: "pointer", background: selected ? T.gold : T.card2, border: `1px solid ${selected ? T.gold : T.line}`, color: selected ? "#000" : T.accent, display: "grid", justifyItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.7 }}>{dt.toLocaleDateString(undefined, { weekday: "short" })[0]}</span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{dt.getDate()}</span>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: logged ? (selected ? "#000" : T.good) : "transparent" }} />
            </button>
          );
        })}
      </div>

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: T.accent }}>{date === today ? "Today" : date}</div>
          <div style={{ color: loggedCount === 4 ? T.good : T.muted, fontSize: 12, fontWeight: 800 }}>{loggedCount} of 4 logged</div>
        </div>
      </Card>

      <Card style={{ padding: "4px 16px" }}>
        <MealRow label="Breakfast" color={T.meal.breakfast} entry={day.breakfast} onEdit onClick={() => setEditing({ slot: "breakfast" })} />
        <div style={{ borderTop: `1px solid ${T.line}` }} />
        <MealRow label="Lunch" color={T.meal.lunch} entry={day.lunch} onEdit onClick={() => setEditing({ slot: "lunch" })} />
        <div style={{ borderTop: `1px solid ${T.line}` }} />
        <MealRow label="Dinner" color={T.meal.dinner} entry={day.dinner} onEdit onClick={() => setEditing({ slot: "dinner" })} />
      </Card>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <SectionLabel color={T.meal.snacks}>Snacks</SectionLabel>
          <button onClick={() => setEditing({ slot: "snacks" })} style={{ background: "none", border: "none", color: T.meal.snacks, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>+ Add</button>
        </div>
        <Card style={{ padding: day.snacks.length ? "4px 16px" : 16 }}>
          {day.snacks.length === 0 && <div style={{ color: T.dim, fontSize: 13, fontWeight: 600 }}>No snacks logged.</div>}
          {day.snacks.map((s, i) => (
            <div key={i}>
              {i > 0 && <div style={{ borderTop: `1px solid ${T.line}` }} />}
              <MealRow label={`Snack ${i + 1}`} color={T.meal.snacks} entry={s} onEdit onClick={() => setEditing({ slot: "snacks", index: i })} />
            </div>
          ))}
        </Card>
      </div>

      {editing && (
        <MealSheet
          clientId={client.id}
          slot={editing.slot === "snacks" ? "snack" : editing.slot}
          initial={editing.slot === "snacks" ? (editing.index != null ? day.snacks[editing.index] : null) : day[editing.slot]}
          accentColor={T.meal[editing.slot] || T.meal.snacks}
          onSave={saveMeal}
          onDelete={(editing.slot === "snacks" ? editing.index != null : day[editing.slot]) ? deleteMeal : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
