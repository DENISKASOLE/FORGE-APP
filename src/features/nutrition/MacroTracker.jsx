import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { MacroBar } from "../../components/ui/MacroBar.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { isoDate, addDays, startOfWeek, weekDays } from "../../lib/dateUtils.js";
import { MACRO_SLOTS, macroDayFor, macroDayTotals, slotTotals, saveNutritionState } from "../../lib/nutrition.js";
import { FoodSearchScreen } from "./FoodSearchScreen.jsx";

const SLOT_META = {
  breakfast: { label: "Breakfast", color: T.meal.breakfast },
  lunch: { label: "Lunch", color: T.meal.lunch },
  dinner: { label: "Dinner", color: T.meal.dinner },
  snacks: { label: "Snacks", color: T.meal.snacks },
};

function MacroCalendarCard({ nutrition, date, setDate }) {
  const [anchor, setAnchor] = useState(() => new Date(`${date}T00:00:00`));
  const weekStart = startOfWeek(anchor);
  const days = weekDays(weekStart);
  const monthLabel = weekStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  function shiftWeek(dir) { setAnchor((a) => addDays(a, dir * 7)); }
  return (
    <div className="glass" style={{ padding: 18 }}>
      <div style={{ fontFamily: T.display, fontSize: 24, fontWeight: 800, color: T.gold, letterSpacing: "-0.4px" }}>Macro Tracker</div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 14, marginBottom: 14 }}>
        <button onClick={() => shiftWeek(-1)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", padding: 4 }}>&lsaquo;</button>
        <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 15, color: T.accent }}>{monthLabel}</div>
        <button onClick={() => shiftWeek(1)} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", padding: 4 }}>&rsaquo;</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {days.map((d) => {
          const dTotals = macroDayTotals(macroDayFor(nutrition, d.date));
          const logged = dTotals.kcal > 0;
          const selected = d.date === date;
          return (
            <div key={d.date} style={{ display: "grid", justifyItems: "center", gap: 7 }}>
              <div style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 600, color: T.dim, letterSpacing: "0.06em" }}>{d.name.slice(0, 3).toUpperCase()}</div>
              <button
                onClick={() => setDate(d.date)}
                style={{
                  width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: selected ? T.gold : "transparent",
                  boxShadow: selected ? "0 6px 20px color-mix(in srgb, var(--accent) 30%, transparent)" : "none",
                  color: selected ? T.btnInk : T.accent,
                  fontFamily: T.sans, fontWeight: 700, fontSize: 15,
                  display: "grid", placeItems: "center",
                }}
              >{new Date(`${d.date}T00:00:00`).getDate()}</button>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: logged ? T.gold : T.dim, opacity: logged ? 1 : 0.5 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlotCard({ meta, items, onAdd, onDelete }) {
  const totals = slotTotals(items);
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: items.length ? 12 : 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
          <span style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>{meta.label}</span>
        </div>
        {items.length > 0 && <span style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 500, color: T.dim }}>{Math.round(totals.kcal)} kcal</span>}
      </div>
      {items.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: T.card2, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 13, color: T.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                <div style={{ fontFamily: T.sans, fontSize: 11, color: T.muted, marginTop: 2 }}>{item.serving}{item.amount !== 1 ? ` × ${item.amount}` : ""} · {Math.round(item.kcal)} kcal</div>
              </div>
              <button onClick={() => onDelete(item)} style={{ background: "none", border: "none", color: T.dim, fontSize: 16, cursor: "pointer", flexShrink: 0, padding: 4 }}>&times;</button>
            </div>
          ))}
        </div>
      )}
      <button onClick={onAdd} style={{ width: "100%", padding: "12px 12px", borderRadius: 14, border: `1.5px dashed ${T.line}`, background: "transparent", color: T.dim, fontFamily: T.sans, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
        + Add food
      </button>
    </Card>
  );
}

export function MacroTracker({ client, updateClient, onClose }) {
  const nutrition = client.nutrition;
  const [date, setDate] = useState(isoDate());
  const [addingSlot, setAddingSlot] = useState(null);

  const day = macroDayFor(nutrition, date);
  const totals = macroDayTotals(day);
  const targets = nutrition.report?.targets;
  const today = isoDate();

  async function deleteItem(slot, item) {
    if (!await confirmDialog(`Remove "${item.name}" from ${SLOT_META[slot].label.toLowerCase()}?`, { danger: true, confirmLabel: "Remove" })) return;
    const nextDay = { ...day, [slot]: day[slot].filter((i) => i.id !== item.id) };
    const next = { ...nutrition, macro_log: { ...nutrition.macro_log, [date]: nextDay } };
    updateClient({ ...client, nutrition: next });
    await saveNutritionState(client.id, next);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 1050, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 0", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: T.card2, border: `${T.hairline} solid ${T.line}`, borderRadius: 10, width: 36, height: 36, color: T.muted, fontSize: 16, cursor: "pointer" }}>&larr;</button>
        <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 13, color: T.muted }}>{date === today ? "Today" : date}</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
        <MacroCalendarCard nutrition={nutrition} date={date} setDate={setDate} />

        <Card style={{ padding: 16, display: "grid", gap: 12 }}>
          <SectionLabel color={T.muted}>{targets ? "Today vs target" : "Today's totals"}</SectionLabel>
          {targets ? (
            <>
              <MacroBar label="Calories" value={totals.kcal} target={targets.calories} unit="" color={T.gold} />
              <MacroBar label="Protein" value={totals.protein} target={targets.protein} color={T.good} />
              <MacroBar label="Carbs" value={totals.carbs} target={targets.carbs} color={T.dim} />
              <MacroBar label="Fats" value={totals.fats} target={targets.fats} color={T.dim} />
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              <div><div style={{ fontFamily: T.sans, fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Kcal</div><div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.gold }}>{Math.round(totals.kcal)}</div></div>
              <div><div style={{ fontFamily: T.sans, fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Protein</div><div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.accent }}>{Math.round(totals.protein)}g</div></div>
              <div><div style={{ fontFamily: T.sans, fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Carbs</div><div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.accent }}>{Math.round(totals.carbs)}g</div></div>
              <div><div style={{ fontFamily: T.sans, fontSize: 10, color: T.dim, textTransform: "uppercase", letterSpacing: "0.1em" }}>Fats</div><div style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.accent }}>{Math.round(totals.fats)}g</div></div>
            </div>
          )}
        </Card>

        {MACRO_SLOTS.map((slot) => (
          <SlotCard key={slot} meta={SLOT_META[slot]} items={day[slot]} onAdd={() => setAddingSlot(slot)} onDelete={(item) => deleteItem(slot, item)} />
        ))}
      </div>

      {addingSlot && (
        <FoodSearchScreen client={client} updateClient={updateClient} date={date} slot={addingSlot} onClose={() => setAddingSlot(null)} />
      )}
    </div>
  );
}
