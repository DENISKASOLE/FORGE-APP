import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Sheet } from "../../components/ui/Sheet.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { inputStyle, textareaStyle } from "../../components/ui/Field.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { normalizeReportNotes, saveReportNotes, normalizeReportHistory, saveReportHistory, newReportHistoryEntry } from "../../lib/progressReports.js";
import { uploadClientFile, getSignedPhotoUrl } from "../../lib/storage.js";
import { sharePdfBlob, safeFilename } from "../../lib/pdf.js";
import { buildProgressReportPDF } from "../../lib/progressReportPdf.js";
import { REPORT_PERIODS, COMPARISON_OPTIONS } from "./progressReportModel.js";
import { buildReportModel } from "./progressReportMath.js";
import { ReportPreview } from "./ReportPreview.jsx";

const label = { fontFamily: BRAND.sans, fontSize: 10, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 };

function coverageRows(model) {
  const { body, training, nutrition, heart, recovery } = model;
  return [
    { label: "Body weight", ok: body.weight.length > 0, detail: `${body.weight.length} readings in this period` },
    { label: "Measurements", ok: body.measurements.inRange.length > 0, detail: body.measurements.inRange.length ? `${body.measurements.inRange.length} entries` : "None logged this period" },
    { label: "Training sessions", ok: training.planned > 0, detail: `${training.completedCount} completed of ${training.planned} planned` },
    { label: "Nutrition logs", ok: nutrition.loggedCount > 0, detail: `${nutrition.loggedCount} of ${nutrition.totalDays} days logged` },
    { label: "Workout heart rate / calories", ok: heart.hasHr || heart.hasKcal, detail: heart.hasHr || heart.hasKcal ? "Recorded for some sessions" : "Not recorded" },
    { label: "Sleep & steps", ok: recovery.sleep.length > 0 || recovery.steps.length > 0, detail: recovery.sleep.length || recovery.steps.length ? `Sleep ${recovery.sleep.length} · steps ${recovery.steps.length}` : "Not tracked" },
    { label: "Check-ins", ok: recovery.checkins.hasCheck, detail: recovery.checkins.hasCheck ? `${recovery.checkins.checks.length} matching entries` : "None configured/submitted" },
  ];
}

function HistoryRow({ entry }) {
  const [opening, setOpening] = useState(false);
  async function open() {
    setOpening(true);
    try {
      const url = await getSignedPhotoUrl(entry.storagePath);
      if (url) window.open(url, "_blank", "noopener");
      else showToast("Couldn't open that saved report.", "error");
    } finally {
      setOpening(false);
    }
  }
  return (
    <button type="button" onClick={open} disabled={opening} style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "8px 0", borderBottom: `${BRAND.hairline} solid ${BRAND.lineSoft}` }}>
      <div style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.text }}>{entry.periodLabel}</div>
      <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted }}>{entry.filename} · {opening ? "Opening..." : "Tap to open"}</div>
    </button>
  );
}

export function ProgressReportBuilder({ client, updateClient, onClose }) {
  const [period, setPeriod] = useState("4w");
  const [customA, setCustomA] = useState("");
  const [customB, setCustomB] = useState(isoDate());
  const [cmp, setCmp] = useState("prev");
  const [offMap, setOffMap] = useState({});
  const [trainerName, setTrainerName] = useState("Coach");
  const [notes, setNotes] = useState(() => normalizeReportNotes(client.progressReportNotes));
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveToHistory, setSaveToHistory] = useState(true);
  const [tab, setTab] = useState("preview");
  const history = normalizeReportHistory(client.progressReportHistory);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!client.trainer_id) return;
      const { data } = await supabase.from("trainers").select("name").eq("id", client.trainer_id).maybeSingle();
      if (!cancelled && data?.name) setTrainerName(data.name);
    })();
    return () => { cancelled = true; };
  }, [client.trainer_id]);

  const model = useMemo(
    () => buildReportModel(client, trainerName, { period, customA, customB, cmp, offMap }),
    [client, trainerName, period, customA, customB, cmp, offMap]
  );

  function setWin(i, value) { setNotes((n) => { const wins = n.wins.slice(); wins[i] = value; return { ...n, wins }; }); }
  function setPrio(i, value) { setNotes((n) => { const prios = n.prios.slice(); prios[i] = value; return { ...n, prios }; }); }
  function setGoal(i, field, value) { setNotes((n) => { const goals = n.goals.map((g) => g.slice()); goals[i][field] = value; return { ...n, goals }; }); }

  async function saveNotes() {
    setSaving(true);
    try {
      await saveReportNotes(client.id, notes);
      updateClient({ ...client, progressReportNotes: notes });
      showToast("Report notes saved.", "success");
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const blob = await buildProgressReportPDF(model, notes);
      const filename = `${safeFilename(client.name)}_progress-report_${model.period.from}_${model.period.to}.pdf`;
      const result = await sharePdfBlob(blob, filename, `${client.name}'s Progress Report`);
      if (saveToHistory) {
        const storagePath = await uploadClientFile(client.id, "progress-reports", blob, "pdf");
        const entry = newReportHistoryEntry({ periodLabel: `${model.period.from} - ${model.period.to}`, from: model.period.from, to: model.period.to, filename, storagePath });
        const nextHistory = [...history, entry];
        await saveReportHistory(client.id, nextHistory);
        updateClient({ ...client, progressReportHistory: nextHistory });
      }
      showToast(result === "shared" ? `Report shared${saveToHistory ? " and saved to history" : ""}.` : `Report exported${saveToHistory ? " and saved to history" : ""}.`, "success");
    } catch (e) {
      showToast(e.message || "Couldn't export the report.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Sheet title={`Progress Report · ${client.name}`} onClose={onClose} maxWidth={720}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "72vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {REPORT_PERIODS.map((p) => <Chip key={p.key} selected={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</Chip>)}
            <span style={{ width: 1, background: BRAND.lineSoft, margin: "4px 2px" }} />
            {COMPARISON_OPTIONS.map((c) => <Chip key={c.key} selected={cmp === c.key} onClick={() => setCmp(c.key)}>vs {c.label}</Chip>)}
          </div>
          {period === "custom" && (
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" value={customA} max={isoDate()} onChange={(e) => setCustomA(e.target.value)} style={inputStyle()} />
              <input type="date" value={customB} max={isoDate()} onChange={(e) => setCustomB(e.target.value)} style={inputStyle()} />
            </div>
          )}
          {model.period.err && <div style={{ fontFamily: BRAND.sans, fontSize: 11.5, color: BRAND.red }}>{model.period.err} Showing the last 4 weeks until the dates are valid.</div>}
          <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted }}>
            {model.period.from} – {model.period.to} · {model.period.days} days
            {" · "}{model.comparison.window ? `vs ${model.comparison.window.a} – ${model.comparison.window.b}` : model.comparison.reason}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <Chip selected={tab === "preview"} onClick={() => setTab("preview")}>Preview</Chip>
          <Chip selected={tab === "edit"} onClick={() => setTab("edit")}>Report details</Chip>
        </div>

        <div style={{ overflowY: "auto", minHeight: 0, flex: 1 }}>
          {tab === "preview" ? (
            <ReportPreview model={model} notes={notes} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={label}>Data coverage</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {coverageRows(model).map((r) => (
                    <div key={r.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: r.ok ? BRAND.green : BRAND.muted, fontFamily: BRAND.sans, fontSize: 13 }}>{r.ok ? "●" : "○"}</span>
                      <div>
                        <div style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.text }}>{r.label}</div>
                        <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted }}>{r.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={label}>Sections in this report</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {model.sections.map((s) => (
                    <label key={s.key} style={{ display: "flex", gap: 8, alignItems: "center", opacity: s.available ? 1 : 0.5, cursor: s.fixed || !s.available ? "default" : "pointer" }}>
                      <input type="checkbox" checked={s.included} disabled={s.fixed || !s.available} onChange={() => setOffMap((m) => ({ ...m, [s.key]: !m[s.key] }))} />
                      <span style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.text }}>{s.label}</span>
                      {!s.available && <span style={{ fontFamily: BRAND.sans, fontSize: 10.5, color: BRAND.muted }}>no data</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div style={label}>Coach notes</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label>
                    <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted, marginBottom: 4 }}>Coach summary</div>
                    <textarea value={notes.summary} onChange={(e) => setNotes((n) => ({ ...n, summary: e.target.value }))} placeholder="Shown at the top of the report and on the review page..." style={textareaStyle({ minHeight: 70 })} />
                  </label>
                  {[0, 1, 2].map((i) => (
                    <label key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted }}>Win {i + 1}{notes.wins[i] == null ? " (from data)" : " (edited)"}</span>
                        {notes.wins[i] != null && <button type="button" onClick={() => setWin(i, null)} style={{ background: "none", border: "none", color: BRAND.gold, fontSize: 10.5, cursor: "pointer" }}>Reset to data</button>}
                      </div>
                      <textarea value={notes.wins[i] ?? model.wins[i]?.text ?? ""} onChange={(e) => setWin(i, e.target.value)} style={textareaStyle({ minHeight: 44 })} />
                    </label>
                  ))}
                  <label>
                    <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted, marginBottom: 4 }}>Main challenge</div>
                    <textarea value={notes.challenge || model.challenge} onChange={(e) => setNotes((n) => ({ ...n, challenge: e.target.value }))} style={textareaStyle({ minHeight: 60 })} />
                  </label>
                  {[0, 1, 2].map((i) => (
                    <label key={i}>
                      <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted, marginBottom: 4 }}>Priority {i + 1}</div>
                      <input value={notes.prios[i] || ""} onChange={(e) => setPrio(i, e.target.value)} style={inputStyle()} />
                    </label>
                  ))}
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ display: "flex", gap: 6 }}>
                      <input placeholder="Goal" value={notes.goals[i]?.[0] || ""} onChange={(e) => setGoal(i, 0, e.target.value)} style={inputStyle()} />
                      <input placeholder="Measure and target" value={notes.goals[i]?.[1] || ""} onChange={(e) => setGoal(i, 1, e.target.value)} style={inputStyle()} />
                    </div>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={notes.reflOn} onChange={() => setNotes((n) => ({ ...n, reflOn: !n.reflOn }))} />
                    <span style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.text }}>Include client reflection</span>
                  </label>
                  {notes.reflOn && <textarea value={notes.refl} onChange={(e) => setNotes((n) => ({ ...n, refl: e.target.value }))} placeholder="Quote from the client..." style={textareaStyle({ minHeight: 50 })} />}
                  <Button onClick={saveNotes} disabled={saving} variant="dark">{saving ? "Saving..." : "Save notes"}</Button>
                </div>
              </div>

              <div>
                <div style={label}>Saved reports</div>
                {history.length === 0 && <div style={{ fontFamily: BRAND.sans, fontSize: 12, color: BRAND.muted }}>No reports exported yet.</div>}
                {[...history].reverse().map((h) => <HistoryRow key={h.id} entry={h} />)}
              </div>
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, borderTop: `${BRAND.hairline} solid ${BRAND.line}` }}>
          <div style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {model.includedSections.length} sections · {safeFilename(client.name)}_progress-report_{model.period.from}_{model.period.to}.pdf
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: BRAND.sans, fontSize: 11.5, color: BRAND.muted }}>
              <input type="checkbox" checked={saveToHistory} onChange={() => setSaveToHistory((v) => !v)} />
              Save to progress history
            </label>
            <Button onClick={exportPdf} disabled={exporting} style={{ flex: 1, minWidth: 140 }}>{exporting ? "Preparing PDF..." : "Export PDF"}</Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
