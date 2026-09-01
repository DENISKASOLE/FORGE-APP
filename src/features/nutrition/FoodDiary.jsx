import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { inputStyle } from "../../components/ui/Field.jsx";
import { usePhotoUrl, deleteClientPhoto, isStoragePath } from "../../lib/storage.js";
import { isoDate, addDays, startOfWeek, weekDays } from "../../lib/dateUtils.js";
import { MEAL_SLOTS, dayLogFor, habitLogFor, saveNutritionState } from "../../lib/nutrition.js";
import { SLEEP_HOURS, WATER_LITERS } from "../../lib/constants.js";
import { MealSheet } from "./MealSheet.jsx";

function fmtIngredient(i) {
  const unit = (i.unit || "").trim();
  const amountUnit = unit.length <= 2 ? `${i.amount}${unit}` : `${i.amount} ${unit}`;
  return `${amountUnit} ${i.item}`.trim();
}

function MealThumb({ photo, color, size = 72 }) {
  const url = usePhotoUrl(photo);
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: 16, objectFit: "cover", flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: 16, background: `color-mix(in srgb, ${color} 16%, transparent)`, flexShrink: 0 }} />;
}

function NutritionCalendarCard({ nutrition, date, setDate }) {
  const [anchor, setAnchor] = useState(() => new Date(`${date}T00:00:00`));
  const weekStart = startOfWeek(anchor);
  const days = weekDays(weekStart);
  const monthLabel = weekStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  function shiftWeek(dir) { setAnchor((a) => addDays(a, dir * 7)); }
  return (
    <div style={{ background: T.card, border: `${T.hairline} solid ${T.line}`, borderRadius: 20, padding: 18 }}>
      <div style={{ fontFamily: T.display, fontSize: 24, fontWeight: 800, color: T.gold, letterSpacing: "-0.4px" }}>Nutrition</div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 14, marginBottom: 14 }}>
        <button onClick={() => shiftWeek(-1)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", padding: 4 }}>&lsaquo;</button>
        <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 15, color: T.accent }}>{monthLabel}</div>
        <button onClick={() => shiftWeek(1)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", padding: 4 }}>&rsaquo;</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {days.map((d) => {
          const dLog = nutrition.food_log[d.date];
          const logged = dLog && (MEAL_SLOTS.some((s) => dLog[s]) || dLog.snacks?.length);
          const selected = d.date === date;
          return (
            <div key={d.date} style={{ display: "grid", justifyItems: "center", gap: 7 }}>
              <div style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 600, color: T.dim, letterSpacing: "0.06em" }}>{d.name.slice(0, 3).toUpperCase()}</div>
              <button
                onClick={() => setDate(d.date)}
                style={{
                  width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: selected ? T.blue : "transparent",
                  color: selected ? "#06202b" : T.accent,
                  fontFamily: T.sans, fontWeight: 700, fontSize: 15,
                  display: "grid", placeItems: "center",
                }}
              >{new Date(`${d.date}T00:00:00`).getDate()}</button>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: logged ? T.blue : T.dim, opacity: logged ? 1 : 0.5 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MealCard({ label, color, entry, onOpen, right }) {
  const ingredientsText = entry?.ingredients?.length ? entry.ingredients.map(fmtIngredient).join(", ") : "";
  return (
    <div style={{ background: T.card, border: `${T.hairline} solid ${T.line}`, borderRadius: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: entry ? 14 : 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
        </div>
        <span style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 500, color: T.dim, letterSpacing: "0.04em" }}>{right}</span>
      </div>
      {entry ? (
        <button onClick={onOpen} style={{ display: "flex", gap: 14, width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <MealThumb photo={entry.photo} color={color} />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 16, color: T.accent, lineHeight: 1.3 }}>{entry.description || "Meal logged"}</div>
            {ingredientsText && <div style={{ fontFamily: T.sans, fontWeight: 400, fontSize: 13, color: T.muted, lineHeight: 1.45, marginTop: 5 }}>{ingredientsText}</div>}
          </div>
        </button>
      ) : (
        <button onClick={onOpen} style={{ width: "100%", padding: "20px 12px", borderRadius: 14, border: `1.5px dashed ${T.line}`, background: "transparent", color: T.dim, fontFamily: T.sans, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
          Snap your meal
        </button>
      )}
    </div>
  );
}

function HabitCard({ habits, onChange }) {
  const label = { fontFamily: T.sans, fontSize: 10, fontWeight: 600, color: T.dim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, textAlign: "center" };
  return (
    <div style={{ background: T.card, border: `${T.hairline} solid ${T.line}`, borderRadius: 18, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.gold, flexShrink: 0 }} />
        <span style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>Log Habits</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <label>
          <div style={label}>Steps</div>
          <input type="number" inputMode="numeric" min="0" value={habits.steps} onChange={(e) => onChange({ ...habits, steps: e.target.value })} placeholder="0" style={inputStyle({ textAlign: "center", fontSize: 15, fontWeight: 700, padding: "10px 6px" })} />
        </label>
        <label>
          <div style={label}>Sleep</div>
          <select value={habits.sleep} onChange={(e) => onChange({ ...habits, sleep: e.target.value })} style={inputStyle({ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "10px 6px" })}>
            {SLEEP_HOURS.map((h) => <option key={h} value={h}>{h ? `${h}h` : "—"}</option>)}
          </select>
        </label>
        <label>
          <div style={label}>Water</div>
          <select value={habits.water} onChange={(e) => onChange({ ...habits, water: e.target.value })} style={inputStyle({ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "10px 6px" })}>
            {WATER_LITERS.map((w) => <option key={w} value={w}>{w ? `${w}L` : "—"}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

export function FoodDiary({ client, updateClient, nutrition }) {
  const [date, setDate] = useState(isoDate());
  const [editing, setEditing] = useState(null); // { slot: 'breakfast'|'lunch'|'dinner'|'snacks', index? }

  const day = dayLogFor(nutrition, date);
  const habits = habitLogFor(nutrition, date);
  const loggedCount = MEAL_SLOTS.filter((s) => day[s]).length + (day.snacks.length > 0 ? 1 : 0);
  const today = isoDate();

  async function persist(nextNutrition) {
    updateClient({ ...client, nutrition: nextNutrition });
    await saveNutritionState(client.id, nextNutrition);
  }

  function saveHabits(next) {
    persist({ ...nutrition, habits: { ...nutrition.habits, [date]: next } });
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

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
      <NutritionCalendarCard nutrition={nutrition} date={date} setDate={setDate} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
        <span style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 13, color: T.accent }}>{date === today ? "Today" : date}</span>
        <span style={{ fontFamily: T.sans, fontWeight: 500, fontSize: 12, color: loggedCount === 4 ? T.good : T.muted }}>{loggedCount} of 4 logged</span>
      </div>

      <MealCard label="Breakfast" color={T.meal.breakfast} entry={day.breakfast} onOpen={() => setEditing({ slot: "breakfast" })} right={day.breakfast?.time || ""} />
      <MealCard label="Lunch" color={T.meal.lunch} entry={day.lunch} onOpen={() => setEditing({ slot: "lunch" })} right={day.lunch?.time || ""} />
      <MealCard label="Dinner" color={T.meal.dinner} entry={day.dinner} onOpen={() => setEditing({ slot: "dinner" })} right={day.dinner?.time || ""} />

      <div style={{ background: T.card, border: `${T.hairline} solid ${T.line}`, borderRadius: 18, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: day.snacks.length ? 14 : 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.meal.snacks, flexShrink: 0 }} />
            <span style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>Snacks</span>
          </div>
          {day.snacks.length > 0 && <span style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 500, color: T.dim, letterSpacing: "0.04em" }}>{day.snacks.length} LOGGED</span>}
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {day.snacks.map((s, i) => {
            const ingredientsText = s.ingredients?.length ? s.ingredients.map(fmtIngredient).join(", ") : "";
            return (
              <button key={i} onClick={() => setEditing({ slot: "snacks", index: i })} style={{ display: "flex", gap: 14, width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <MealThumb photo={s.photo} color={T.meal.snacks} />
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 16, color: T.accent, lineHeight: 1.3 }}>{s.description || "Snack logged"}</div>
                  {ingredientsText && <div style={{ fontFamily: T.sans, fontWeight: 400, fontSize: 13, color: T.muted, lineHeight: 1.45, marginTop: 5 }}>{ingredientsText}</div>}
                </div>
              </button>
            );
          })}
          <button onClick={() => setEditing({ slot: "snacks" })} style={{ width: "100%", padding: "16px 12px", borderRadius: 14, border: `1.5px dashed ${T.line}`, background: "transparent", color: T.dim, fontFamily: T.sans, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
            Add another snack
          </button>
        </div>
      </div>

      <HabitCard habits={habits} onChange={saveHabits} />

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
