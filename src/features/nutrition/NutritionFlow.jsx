import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { habitLogFor } from "../../lib/nutrition.js";
import { isoDate, addDays } from "../../lib/dateUtils.js";
import { NutritionV2Flow } from "../nutrition-v2/NutritionV2Flow.jsx";

const HABIT_DAYS = 7;

// The client logs steps/sleep/water on their own Home screen (HabitLogCard)
// - unrelated to the Nutrition redesign (DECISIONS.md), so kept as-is
// through the cutover. This is the coach's read-only view of that same
// data, surfaced here because this is where the coach already looks for
// anything about a client's day-to-day.
function CoachHabitsCard({ nutrition }) {
  const today = isoDate();
  const days = Array.from({ length: HABIT_DAYS }, (_, i) => addDays(new Date(`${today}T00:00:00`), -i))
    .map((d) => isoDate(d));

  const avg = (vals) => (vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null);
  const rows = days.map((date) => ({ date, ...habitLogFor(nutrition, date) }));
  const avgSteps = avg(rows.map((r) => Number(r.steps)).filter((n) => n > 0));
  const avgSleep = avg(rows.map((r) => Number(r.sleep)).filter((n) => n > 0));
  const daysLogged = rows.filter((r) => r.steps || r.sleep || r.water).length;

  return (
    <Card style={{ padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <SectionLabel color={T.muted}>Daily habits</SectionLabel>
        <span style={{ color: T.dim, fontSize: 11, fontWeight: 600 }}>{daysLogged}/{HABIT_DAYS} days logged</span>
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        {rows.map((r, i) => {
          const isToday = r.date === today;
          const empty = !r.steps && !r.sleep && !r.water;
          return (
            <div key={r.date} style={{ display: "grid", gridTemplateColumns: "76px 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "7px 0", borderTop: i ? `${T.hairline} solid ${T.line}` : "none", opacity: empty ? 0.45 : 1 }}>
              <div style={{ color: isToday ? T.accent : T.muted, fontSize: 12, fontWeight: isToday ? 700 : 500 }}>
                {isToday ? "Today" : new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
              </div>
              <div style={{ color: T.accent, fontSize: 13, fontWeight: 600, textAlign: "center" }}>{r.steps ? `${Number(r.steps).toLocaleString()} steps` : "—"}</div>
              <div style={{ color: T.accent, fontSize: 13, fontWeight: 600, textAlign: "center" }}>{r.sleep ? `${r.sleep}h sleep` : "—"}</div>
              <div style={{ color: T.accent, fontSize: 13, fontWeight: 600, textAlign: "center" }}>{r.water ? `${r.water}L water` : "—"}</div>
            </div>
          );
        })}
      </div>
      {(avgSteps || avgSleep) && (
        <div style={{ color: T.muted, fontSize: 11, lineHeight: 1.5 }}>
          {avgSteps ? `Avg ${avgSteps.toLocaleString()} steps` : ""}{avgSteps && avgSleep ? " · " : ""}{avgSleep ? `Avg ${avgSleep}h sleep` : ""} on days logged.
        </div>
      )}
    </Card>
  );
}

// The Nutrition tab, fully replaced by the unified redesign
// (DECISIONS.md "Nutrition redesign") - every client gets the same
// experience now (NutritionV2Flow), no tracking_mode switch, no coach
// toggle. The old food_log/macros/prescribed_plan split, the baseline->
// report->adjustment->maintenance phase cycle, and the AI-drafted
// narrative report are retired - see mellow-wandering-grove.md and
// DECISIONS.md for what replaced them and why. Old data (food_log,
// macro_log, nutrition_plan, nutrition_plan_logs) is never deleted, just
// no longer read by anything.
export function NutritionFlow({ client, updateClient, isCoach }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {isCoach && <CoachHabitsCard nutrition={client.nutrition} />}
      <NutritionV2Flow client={client} updateClient={updateClient} isCoach={isCoach} />
    </div>
  );
}
