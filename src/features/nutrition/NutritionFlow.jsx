import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { NUTRITION_PHASES, weekOfFor, saveNutritionState } from "../../lib/nutrition.js";
import { downloadNutritionExport } from "../../lib/nutritionExport.js";
import { SupplementStack } from "./SupplementStack.jsx";
import { FoodDiary } from "./FoodDiary.jsx";
import { Report } from "./Report.jsx";

const PHASE_LABELS = { baseline: "Baseline", report: "Report", adjustment: "Adjustment", maintenance: "Maintenance" };

function CoachPhaseControls({ client, nutrition, onPersist }) {
  const [reportDraft, setReportDraft] = useState(() => (nutrition.report ? JSON.stringify(nutrition.report, null, 2) : ""));
  const [showReportEditor, setShowReportEditor] = useState(false);
  const [reportError, setReportError] = useState("");
  const [exporting, setExporting] = useState(false);

  function setPhase(phase) {
    onPersist({ ...nutrition, phase, week_of: (phase === "baseline" || phase === "adjustment") ? weekOfFor() : nutrition.week_of });
  }
  function saveReport() {
    try {
      const parsed = reportDraft.trim() ? JSON.parse(reportDraft) : null;
      onPersist({ ...nutrition, report: parsed });
      setReportError("");
      setShowReportEditor(false);
    } catch {
      setReportError("That's not valid JSON — check for a stray comma or quote.");
    }
  }
  async function exportWeek() {
    setExporting(true);
    try { await downloadNutritionExport(client, nutrition); } finally { setExporting(false); }
  }

  return (
    <Card style={{ padding: 14, display: "grid", gap: 10 }}>
      <SectionLabel color={T.muted}>Coach controls</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {NUTRITION_PHASES.map((p) => (
          <Chip key={p} selected={nutrition.phase === p} onClick={() => setPhase(p)}>{PHASE_LABELS[p]}</Chip>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button variant="dark" onClick={exportWeek} disabled={exporting}>{exporting ? "Exporting..." : "Export week (JSON + photos)"}</Button>
        <Button variant="dark" onClick={() => setShowReportEditor((v) => !v)}>{showReportEditor ? "Close report editor" : "Set report"}</Button>
      </div>
      {showReportEditor && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ color: T.muted, fontSize: 12 }}>Paste the ReportData JSON you got back for this client.</div>
          <textarea value={reportDraft} onChange={(e) => setReportDraft(e.target.value)} rows={8} style={{ width: "100%", background: T.card2, border: `var(--hairline) solid ${T.line}`, borderRadius: 12, color: T.accent, padding: 12, fontFamily: "monospace", fontSize: 12, boxSizing: "border-box" }} />
          {reportError && <div style={{ color: T.bad, fontSize: 12, fontWeight: 500 }}>{reportError}</div>}
          <Button onClick={saveReport}>Save report</Button>
        </div>
      )}
    </Card>
  );
}

export function NutritionFlow({ client, updateClient, isCoach }) {
  const nutrition = client.nutrition;

  async function persist(next) {
    updateClient({ ...client, nutrition: next });
    await saveNutritionState(client.id, next);
  }

  async function saveSupplementStack(stack) {
    await persist({ ...nutrition, supplement_stack: stack, setup_complete: true });
  }

  function startReCheck() {
    persist({ ...nutrition, phase: "baseline", week_of: weekOfFor(), food_log: {}, report: null });
  }

  let body;
  if (!isCoach && !nutrition.setup_complete) {
    body = <SupplementStack nutrition={nutrition} onSave={saveSupplementStack} />;
  } else if (nutrition.phase === "baseline") {
    body = <FoodDiary client={client} updateClient={updateClient} nutrition={nutrition} phase="baseline" />;
  } else if (nutrition.phase === "adjustment") {
    body = <FoodDiary client={client} updateClient={updateClient} nutrition={nutrition} phase="adjustment" />;
  } else if (nutrition.phase === "maintenance") {
    body = <Report report={nutrition.report} nutrition={nutrition} onReCheck={!isCoach ? startReCheck : undefined} />;
  } else {
    body = <Report report={nutrition.report} nutrition={nutrition} />;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {isCoach && <CoachPhaseControls client={client} nutrition={nutrition} onPersist={persist} />}
      {body}
    </div>
  );
}
