import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { inputStyle } from "../../components/ui/Field.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { SLEEP_HOURS, WATER_LITERS } from "../../lib/constants.js";
import { habitLogFor, saveNutritionState } from "../../lib/nutrition.js";

// Lives on the client's Home screen rather than inside the food diary,
// because habits aren't really nutrition-tab material: they're a daily
// check-in every client has, including macros-only clients who can't see
// the diary at all and previously had no way to log steps or sleep.
//
// Unlike the old in-diary version, this persists itself - Home has no
// nutrition-saving parent to delegate to.
export function HabitLogCard({ client, updateClient }) {
  const today = isoDate();
  const nutrition = client.nutrition;
  const [habits, setHabits] = useState(() => habitLogFor(nutrition, today));

  async function change(next) {
    setHabits(next);
    const updated = { ...nutrition, habits: { ...nutrition.habits, [today]: next } };
    updateClient({ ...client, nutrition: updated });
    await saveNutritionState(client.id, updated);
  }

  const label = { fontFamily: T.sans, fontSize: 10, fontWeight: 600, color: T.dim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, textAlign: "center" };
  const logged = [habits.steps, habits.sleep, habits.water].filter(Boolean).length;

  return (
    <div className="glass" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.gold, flexShrink: 0 }} />
          <span style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>Log today's Habits</span>
        </div>
        <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 600, color: logged === 3 ? T.good : T.dim, flexShrink: 0 }}>{logged}/3</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <label>
          <div style={label}>Steps</div>
          <input type="number" inputMode="numeric" min="0" value={habits.steps} onChange={(e) => change({ ...habits, steps: e.target.value })} placeholder="0" style={inputStyle({ textAlign: "center", fontSize: 15, fontWeight: 700, padding: "10px 6px" })} />
        </label>
        <label>
          <div style={label}>Sleep</div>
          <select value={habits.sleep} onChange={(e) => change({ ...habits, sleep: e.target.value })} style={inputStyle({ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "10px 6px" })}>
            {SLEEP_HOURS.map((h) => <option key={h} value={h}>{h ? `${h}h` : "—"}</option>)}
          </select>
        </label>
        <label>
          <div style={label}>Water</div>
          <select value={habits.water} onChange={(e) => change({ ...habits, water: e.target.value })} style={inputStyle({ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "10px 6px" })}>
            {WATER_LITERS.map((w) => <option key={w} value={w}>{w ? `${w}L` : "—"}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
