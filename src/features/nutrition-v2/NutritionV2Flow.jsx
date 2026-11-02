import { useMemo, useState } from "react";
import { Chip } from "../../components/ui/Chip.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { normalizePlans, normalizeLogs, normalizeMarks, normalizeNotes, logsForDate, marksForDate, saveLogs, saveMarks } from "../../lib/nutritionV2.js";
import { mergeLegacyMacroLog } from "./nutritionV2Math.js";
import { CoachPlanBuilderV2 } from "./CoachPlanBuilderV2.jsx";
import { NutritionV2Progress } from "./NutritionV2Progress.jsx";
import { FuelToday } from "./FuelToday.jsx";

// Unified replacement for food_log/macros/prescribed_plan (DECISIONS.md
// "Nutrition redesign"), restyled per the approved Fuel tab redesign
// (DECISIONS.md "Fuel tab redesign", docs/design/fuel-tab/BRIEF.md). The
// coach side keeps the app's standard look (CoachPlanBuilderV2 /
// NutritionV2Progress get their own pass); this file is the
// client-facing shell - today just FuelToday, with My week / Change-a-
// meal to follow as their own steps.
export function NutritionV2Flow({ client, updateClient, isCoach }) {
  const [coachTab, setCoachTab] = useState("builder");
  const [logs, setLogs] = useState(() => normalizeLogs(client.nutritionV2Logs));
  const [marks, setMarks] = useState(() => normalizeMarks(client.nutritionV2Marks));
  // Plans are edited by the coach (CoachPlanBuilderV2), never here - just
  // re-synced whenever the client object itself changes (a refresh, or
  // the coach publishing while this client's app is open elsewhere).
  const plans = useMemo(() => normalizePlans(client.nutritionV2Plans), [client.nutritionV2Plans]);
  const notes = useMemo(() => normalizeNotes(client.nutritionV2Notes), [client.nutritionV2Notes]);

  const today = isoDate();
  // Legacy macros -> the new flat log shape, merged at render time (see
  // nutritionV2Math.js's mergeLegacyMacroLog) rather than written back
  // proactively from an effect - the merged result only actually gets
  // persisted the moment the client writes something new for today
  // (writeDay below always saves whatever todayEntries currently holds,
  // so a confirm/swap/off-plan log on a legacy-only day naturally
  // carries the old entries forward in the same write). A day never
  // revisited just stays untouched in its original macro_log row
  // forever, which is fine - no data is ever deleted.
  const todayEntries = useMemo(() => {
    const existing = logsForDate(logs, today);
    if (existing.length || isCoach) return existing;
    const legacyDay = client.nutrition?.macro_log?.[today];
    return legacyDay ? mergeLegacyMacroLog(legacyDay, today) : existing;
  }, [logs, today, isCoach, client.nutrition]);

  async function writeDay(nextEntries, nextMarksForToday = marksForDate(marks, today)) {
    const nextLogs = { ...logs, [today]: nextEntries };
    const nextMarks = { ...marks, [today]: nextMarksForToday };
    setLogs(nextLogs);
    setMarks(nextMarks);
    updateClient({ ...client, nutritionV2Logs: nextLogs, nutritionV2Marks: nextMarks });
    await Promise.all([saveLogs(client.id, nextLogs), saveMarks(client.id, nextMarks)]);
  }

  if (isCoach) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip selected={coachTab === "builder"} onClick={() => setCoachTab("builder")}>Plan builder</Chip>
          <Chip selected={coachTab === "review"} onClick={() => setCoachTab("review")}>Weekly review</Chip>
        </div>
        {coachTab === "builder" ? <CoachPlanBuilderV2 client={client} updateClient={updateClient} /> : <NutritionV2Progress key={client.id} client={client} updateClient={updateClient} isCoach plans={plans} logs={logs} marks={marks} />}
      </div>
    );
  }

  return (
    <FuelToday
      client={client}
      plans={plans}
      logs={logs}
      marks={marks}
      entries={todayEntries}
      notes={notes}
      onWrite={writeDay}
    />
  );
}
