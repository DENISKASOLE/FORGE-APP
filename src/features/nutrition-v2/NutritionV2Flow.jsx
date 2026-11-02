import { useMemo, useState } from "react";
import { Chip } from "../../components/ui/Chip.jsx";
import { normalizePlans, normalizeLogs, normalizeMarks, normalizeNotes, marksForDate, saveLogs, saveMarks } from "../../lib/nutritionV2.js";
import { CoachPlanBuilderV2 } from "./CoachPlanBuilderV2.jsx";
import { NutritionV2Progress } from "./NutritionV2Progress.jsx";
import { FuelToday } from "./FuelToday.jsx";
import { FuelWeek } from "./FuelWeek.jsx";

// Unified replacement for food_log/macros/prescribed_plan (DECISIONS.md
// "Nutrition redesign"), restyled per the approved Fuel tab redesign
// (DECISIONS.md "Fuel tab redesign", docs/design/fuel-tab/BRIEF.md). The
// coach side keeps the app's standard look (CoachPlanBuilderV2 /
// NutritionV2Progress get their own pass); this file is the
// client-facing shell - FuelToday with FuelWeek pushed over it, the
// coach Nutrition dashboard (Coach.dc.html) still to come.
export function NutritionV2Flow({ client, updateClient, isCoach }) {
  const [coachTab, setCoachTab] = useState("builder");
  const [clientScreen, setClientScreen] = useState("today");
  const [logs, setLogs] = useState(() => normalizeLogs(client.nutritionV2Logs));
  const [marks, setMarks] = useState(() => normalizeMarks(client.nutritionV2Marks));
  // Plans are edited by the coach (CoachPlanBuilderV2), never here - just
  // re-synced whenever the client object itself changes (a refresh, or
  // the coach publishing while this client's app is open elsewhere).
  const plans = useMemo(() => normalizePlans(client.nutritionV2Plans), [client.nutritionV2Plans]);
  const notes = useMemo(() => normalizeNotes(client.nutritionV2Notes), [client.nutritionV2Notes]);

  // Writes one date's entries/marks - which date is up to the caller.
  // FuelToday owns its own dateISO (real date navigation, not just
  // "today") and the legacy macro_log merge-on-first-touch for whichever
  // date is selected, since it already holds the full logs/marks/client
  // objects needed to resolve any date, not just today's.
  async function writeDay(dateISO, nextEntries, nextMarksForDate = marksForDate(marks, dateISO)) {
    const nextLogs = { ...logs, [dateISO]: nextEntries };
    const nextMarks = { ...marks, [dateISO]: nextMarksForDate };
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

  if (clientScreen === "week") {
    return <FuelWeek client={client} plans={plans} logs={logs} marks={marks} notes={notes} onBack={() => setClientScreen("today")} />;
  }

  return (
    <FuelToday
      client={client}
      plans={plans}
      logs={logs}
      marks={marks}
      notes={notes}
      onWrite={writeDay}
      onOpenWeek={() => setClientScreen("week")}
    />
  );
}
