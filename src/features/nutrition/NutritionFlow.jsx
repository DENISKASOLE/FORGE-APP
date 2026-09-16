import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { NUTRITION_PHASES, NUTRITION_MODES, weekOfFor, saveNutritionState } from "../../lib/nutrition.js";
import { downloadNutritionExport } from "../../lib/nutritionExport.js";
import { draftNutritionReport } from "../../lib/ai.js";
import { SupplementStack } from "./SupplementStack.jsx";
import { FoodDiary } from "./FoodDiary.jsx";
import { MacroTracker } from "./MacroTracker.jsx";
import { Report } from "./Report.jsx";

const PHASE_LABELS = { baseline: "Baseline", report: "Report", adjustment: "Adjustment", maintenance: "Maintenance" };
const MODE_LABELS = { food_log: "Food log + macros", macros: "Macros only" };

// Coach-facing switch for what the client's Nutrition tab actually is.
// Deliberately separate from the phase chips above it: phase drives the
// coaching cycle (baseline -> report -> adjustment -> maintenance), mode
// drives what the client can see and do, and the two move independently.
function TrackingModeControl({ nutrition, onSetMode }) {
  const mode = nutrition.tracking_mode;
  // The moment the ask described: they've come through the phases and are
  // holding steady, so the diary has done its job. Surfaced as a one-tap
  // nudge rather than something the coach has to remember to go and do.
  const suggestSwitch = mode === "food_log" && nutrition.phase === "maintenance";

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <SectionLabel color={T.muted}>What the client sees</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {NUTRITION_MODES.map((m) => (
          <Chip key={m} selected={mode === m} onClick={() => onSetMode(m)}>{MODE_LABELS[m]}</Chip>
        ))}
      </div>
      <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
        {mode === "macros"
          ? "They track macros only — the food diary and habit logging are hidden. Their existing food log is kept, not deleted, and returns if you switch back."
          : "The full journey: photo/description diary, habits, and the macro tracker available from inside it."}
      </div>
      {suggestSwitch && (
        <div style={{ background: T.card2, border: `${T.hairline} solid ${T.gold}`, borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
          <div style={{ color: T.accent, fontSize: 12, lineHeight: 1.5 }}>
            They're in maintenance — most clients only need to hit their numbers from here. Move them to macros only?
          </div>
          <Button onClick={() => onSetMode("macros")} style={{ justifySelf: "start" }}>Switch to macros only</Button>
        </div>
      )}
    </div>
  );
}

const TARGET_FIELDS = [["calories", "Calories"], ["protein", "Protein (g)"], ["carbs", "Carbs (g)"], ["fats", "Fats (g)"]];

// Set the client's macro targets without running the whole weekly-report
// flow - the only way a "straight to macros" client gets numbers to hit.
// Falls back to showing whatever the report already set, so the coach can
// see the current targets either way.
function MacroTargetsControl({ nutrition, onSave }) {
  const current = nutrition.targets || nutrition.report?.targets || null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({
    calories: current?.calories ?? "", protein: current?.protein ?? "",
    carbs: current?.carbs ?? "", fats: current?.fats ?? "",
  }));

  function save() {
    const cleaned = {};
    for (const [key] of TARGET_FIELDS) {
      const n = Number(draft[key]);
      if (!isNaN(n) && n > 0) cleaned[key] = Math.round(n);
    }
    onSave(Object.keys(cleaned).length ? cleaned : null);
    setOpen(false);
    showToast(Object.keys(cleaned).length ? "Macro targets saved." : "Macro targets cleared.", "success");
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ color: T.muted, fontSize: 12 }}>
          {current
            ? `Targets: ${current.calories || "–"}kcal · ${current.protein || "–"}p / ${current.carbs || "–"}c / ${current.fats || "–"}f`
            : "No macro targets set — the client sees totals with nothing to aim at."}
        </div>
        <Button variant="dark" onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : current ? "Edit targets" : "Set targets"}</Button>
      </div>
      {open && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
            {TARGET_FIELDS.map(([key, label]) => (
              <Field key={key} label={label} type="number" value={draft[key]} onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))} />
            ))}
          </div>
          <Button onClick={save} style={{ justifySelf: "start" }}>Save targets</Button>
        </div>
      )}
    </div>
  );
}

function CoachPhaseControls({ client, nutrition, onPersist }) {
  const [reportDraft, setReportDraft] = useState(() => (nutrition.report ? JSON.stringify(nutrition.report, null, 2) : ""));
  const [showReportEditor, setShowReportEditor] = useState(false);
  const [reportError, setReportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [drafting, setDrafting] = useState(false);

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
  async function draftWithAI() {
    setDrafting(true);
    try {
      const draft = await draftNutritionReport(client, nutrition);
      setReportDraft(JSON.stringify(draft, null, 2));
      setReportError("");
      setShowReportEditor(true);
      showToast("Draft ready — review it before saving.", "success");
    } catch (e) {
      showToast(e.message || "Couldn't draft a report.", "error");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <Card style={{ padding: 14, display: "grid", gap: 10 }}>
      <SectionLabel color={T.muted}>Coach controls</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {NUTRITION_PHASES.map((p) => (
          <Chip key={p} selected={nutrition.phase === p} onClick={() => setPhase(p)}>{PHASE_LABELS[p]}</Chip>
        ))}
      </div>
      <TrackingModeControl nutrition={nutrition} onSetMode={(tracking_mode) => onPersist({ ...nutrition, tracking_mode })} />
      <MacroTargetsControl nutrition={nutrition} onSave={(targets) => onPersist({ ...nutrition, targets })} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button variant="dark" onClick={exportWeek} disabled={exporting}>{exporting ? "Exporting..." : "Export week (JSON + photos)"}</Button>
        <Button onClick={draftWithAI} disabled={drafting}>{drafting ? "Drafting..." : "Draft with AI ✨"}</Button>
        <Button variant="dark" onClick={() => setShowReportEditor((v) => !v)}>{showReportEditor ? "Close report editor" : "Set report"}</Button>
      </div>
      {showReportEditor && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ color: T.muted, fontSize: 12 }}>Paste JSON here, or use "Draft with AI" above to fill this in from the week's logged data — review and edit before saving either way.</div>
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

  const macrosOnly = nutrition.tracking_mode === "macros";

  let body;
  if (macrosOnly) {
    // Straight to the numbers - no supplement-stack onboarding, no phase
    // routing, no diary. This is the whole tab for these clients, so it
    // renders inline (not as the overlay it is inside the food diary),
    // keeping the bottom nav reachable.
    body = <MacroTracker client={client} updateClient={updateClient} embedded />;
  } else if (!isCoach && !nutrition.setup_complete) {
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
