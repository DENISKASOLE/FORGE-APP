import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { uid } from "../../lib/uid.js";
import { isoDate } from "../../lib/dateUtils.js";
import { upsertSection } from "../../lib/clientData.js";
import { uploadClientFile, getSignedPhotoUrl, deleteClientPhoto } from "../../lib/storage.js";
import { extractBodyAnalysis, bodyAnalysisMetric, MAX_BODY_ANALYSIS_BYTES } from "../../lib/ai.js";

// The metrics worth showing big at the top when the report has them - the
// rest still render in the full list below, nothing extracted is hidden.
const HEADLINE_KEYS = [
  ["body_fat_percent", "Body fat"],
  ["skeletal_muscle_mass", "Muscle mass"],
  ["weight", "Weight"],
  ["visceral_fat", "Visceral fat"],
];

function UploadModal({ onClose, onSave }) {
  const [file, setFile] = useState(null);
  const [date, setDate] = useState(isoDate());
  const [busy, setBusy] = useState(false);

  function pick(f) {
    if (!f) return;
    if (f.size > MAX_BODY_ANALYSIS_BYTES) { showToast("That file is too big - please upload a report under 10MB.", "warn"); return; }
    setFile(f);
  }

  async function save() {
    if (!file) { showToast("Choose a report file first.", "warn"); return; }
    setBusy(true);
    await onSave({ file, date });
    setBusy(false);
  }

  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 20, fontWeight: 500 }}>Upload body analysis</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <label style={{ display: "grid", placeItems: "center", minHeight: 120, background: BRAND.card2, border: `2px dashed ${BRAND.line}`, borderRadius: 14, marginBottom: 14, cursor: "pointer", color: file ? BRAND.text : BRAND.muted, fontWeight: 500, fontSize: 13, padding: 14, textAlign: "center" }}>
          {file ? file.name : "+ Choose a PDF report"}
          <input type="file" accept="application/pdf,image/*" onChange={(e) => pick(e.target.files?.[0])} style={{ display: "none" }} />
        </label>
        <Field label="Date uploaded" type="date" value={date} onChange={setDate} />
        <div style={{ color: BRAND.dim, fontSize: 11, lineHeight: 1.5, marginTop: 10 }}>
          InBody, DEXA, bioimpedance printouts and similar. The AI reads the report and uses it to understand this client - it only records what's printed, it never estimates missing values.
        </div>
        <Button onClick={save} disabled={busy} style={{ width: "100%", marginTop: 12 }}>{busy ? "Reading report..." : "Upload & Read"}</Button>
      </Card>
    </div>
  );
}

function ReportDetail({ report, onClose }) {
  const [url, setUrl] = useState("");
  const ex = report.extracted || {};

  async function openFile() {
    if (!report.storagePath) { showToast("The original file wasn't saved for this report.", "warn"); return; }
    const signed = url || await getSignedPhotoUrl(report.storagePath);
    if (!signed) { showToast("Couldn't open that file.", "error"); return; }
    setUrl(signed);
    window.open(signed, "_blank");
  }

  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: BRAND.display, fontSize: 20, fontWeight: 500 }}>{ex.reportType || "Body analysis"}</div>
            <div style={{ color: BRAND.muted, fontSize: 12 }}>{ex.testDate || report.date}</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>

        {ex.summary && <div style={{ color: BRAND.text, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{ex.summary}</div>}

        {ex.metrics?.length > 0 && (
          <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 12, marginBottom: 12 }}>
            {ex.metrics.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: i ? `${BRAND.hairline} solid ${BRAND.line}` : "none" }}>
                <div style={{ color: BRAND.muted, fontSize: 12, minWidth: 0 }}>{m.label}{m.note ? <span style={{ color: BRAND.dim }}> · {m.note}</span> : null}</div>
                <div style={{ color: BRAND.text, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>{m.value}{m.unit}</div>
              </div>
            ))}
          </div>
        )}

        {ex.keyFindings?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>Key findings</div>
            {ex.keyFindings.map((k, i) => <div key={i} style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.5 }}>• {k}</div>)}
          </div>
        )}

        {ex.coachNotes && (
          <div style={{ background: BRAND.blueBg, border: `${BRAND.hairline} solid var(--blue)`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ color: "var(--blue)", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>For programming</div>
            <div style={{ color: BRAND.text, fontSize: 12, lineHeight: 1.5 }}>{ex.coachNotes}</div>
          </div>
        )}

        {report.storagePath && <Button variant="dark" onClick={openFile} style={{ width: "100%" }}>Open original file</Button>}
      </Card>
    </div>
  );
}

// Uploaded body-composition reports. The extracted numbers are fed into the
// other AI features as grounding context (see buildBodyAnalysisSummary in
// lib/ai.js) - that's the real point of this, not just the archive.
export function BodyAnalysisCard({ client, updateClient, isCoach }) {
  const reports = client.bodyAnalysis || [];
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(null);
  const latest = reports[0];

  async function persist(next) {
    updateClient({ ...client, bodyAnalysis: next });
    const { error } = await upsertSection(client.id, "body_analysis", { reports: next });
    if (error) showToast(error.message || "Couldn't save that report.", "error");
  }

  async function handleUpload({ file, date }) {
    let extracted;
    try {
      extracted = await extractBodyAnalysis(file);
    } catch (e) {
      showToast(e.message || "Couldn't read that report.", "error");
      return;
    }
    // Keeping the original is best-effort: the extracted data is what
    // matters, so a storage failure shouldn't throw away a good read.
    let storagePath = "";
    try {
      storagePath = await uploadClientFile(client.id, "body-analysis", file, (file.name.split(".").pop() || "pdf").toLowerCase());
    } catch {
      showToast("Report read successfully, but the original file couldn't be stored.", "warn");
    }
    await persist([{ id: uid(), date, fileName: file.name, storagePath, extracted, uploadedAt: new Date().toISOString() }, ...reports]);
    setUploading(false);
    showToast("Body analysis read and saved.", "success");
  }

  async function remove(report) {
    if (!await confirmDialog(`Delete this body analysis report? The AI will stop using it.`, { danger: true, confirmLabel: "Delete" })) return;
    if (report.storagePath) await deleteClientPhoto(report.storagePath);
    await persist(reports.filter((r) => r.id !== report.id));
  }

  return (
    <div className="glass" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: reports.length ? 12 : 0 }}>
        <div>
          <div style={{ fontFamily: BRAND.sans, fontSize: 8, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.14em", textTransform: "uppercase" }}>Body composition</div>
          <div style={{ fontFamily: BRAND.display, fontWeight: 700, fontSize: 16, color: BRAND.text, marginTop: 2 }}>Body Analysis</div>
        </div>
        {isCoach && (
          <button onClick={() => setUploading(true)} style={{ fontFamily: BRAND.sans, background: BRAND.gold, color: BRAND.btnInk, border: "none", borderRadius: 999, padding: "8px 14px", fontWeight: 500, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Upload report ✨</button>
        )}
      </div>

      {!reports.length && (
        <div style={{ fontFamily: BRAND.sans, fontSize: 12, color: BRAND.dim, lineHeight: 1.5 }}>
          {isCoach
            ? "Upload an InBody/DEXA report and the AI reads it, then uses those numbers everywhere it coaches this client - nutrition targets, summaries, and their AI chat."
            : "No body analysis report yet. Your coach can upload one."}
        </div>
      )}

      {latest && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 12 }}>
            {HEADLINE_KEYS.map(([key, label]) => {
              const m = bodyAnalysisMetric(latest, key);
              if (!m) return null;
              return (
                <div key={key} style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 10, textAlign: "center" }}>
                  <div style={{ color: BRAND.muted, fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                  <div style={{ color: BRAND.text, fontSize: 18, fontWeight: 700, marginTop: 3 }}>{m.value}<span style={{ fontSize: 11, color: BRAND.muted }}>{m.unit}</span></div>
                </div>
              );
            })}
          </div>
          {latest.extracted?.summary && <div style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>{latest.extracted.summary}</div>}
          {reports.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: `${BRAND.hairline} solid ${BRAND.line}` }}>
              <button onClick={() => setOpen(r)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ color: BRAND.text, fontSize: 13, fontWeight: 500 }}>{r.extracted?.reportType || "Body analysis"}</div>
                <div style={{ color: BRAND.dim, fontSize: 11 }}>{r.extracted?.testDate || r.date} · {r.extracted?.metrics?.length || 0} metrics</div>
              </button>
              {isCoach && <button onClick={() => remove(r)} style={{ background: "none", border: "none", color: BRAND.red, fontSize: 11, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>Delete</button>}
            </div>
          ))}
        </>
      )}

      {uploading && <UploadModal onClose={() => setUploading(false)} onSave={handleUpload} />}
      {open && <ReportDetail report={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
