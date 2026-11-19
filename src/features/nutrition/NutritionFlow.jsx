import { NutritionV2Flow } from "../nutrition-v2/NutritionV2Flow.jsx";

// Daily habits moved to Progress > Habits (Nov 19 2026).

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
      <NutritionV2Flow client={client} updateClient={updateClient} isCoach={isCoach} />
    </div>
  );
}
