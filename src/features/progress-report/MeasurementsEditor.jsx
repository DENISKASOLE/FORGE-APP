import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Sheet } from "../../components/ui/Sheet.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { MEASUREMENT_FIELDS } from "../../lib/constants.js";
import { normalizeMeasurementHistory, newMeasurementEntry, saveMeasurementHistory, saveLatestMeasurementsSnapshot } from "../../lib/progressReports.js";

const label = { fontFamily: BRAND.sans, fontSize: 9, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.1em", textTransform: "uppercase" };

// First real screen for client-logged dated measurements. Until now
// client.measurements was a single overwritten snapshot with no editor
// anywhere in the app (confirmed by recon) - this is additive: it keeps
// that existing snapshot in sync (via saveLatestMeasurementsSnapshot) so
// ProgressTab.jsx's two read-only displays need no changes, while giving
// the Progress Report real dated history to chart trends from.
export function MeasurementsEditor({ client, updateClient, onClose }) {
  const [history, setHistory] = useState(() => normalizeMeasurementHistory(client.measurementsHistory));
  const [date, setDate] = useState(isoDate());
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);

  async function addEntry() {
    const filled = Object.fromEntries(Object.entries(fields).filter(([, v]) => String(v || "").trim() !== ""));
    if (!date || Object.keys(filled).length === 0) { showToast("Pick a date and fill in at least one measurement.", "warn"); return; }
    setSaving(true);
    try {
      const entry = newMeasurementEntry(filled, date);
      const next = [...history, entry].sort((a, b) => a.date.localeCompare(b.date));
      await saveMeasurementHistory(client.id, next);
      const numericOnly = Object.fromEntries(Object.entries(filled).filter(([, v]) => !isNaN(parseFloat(v))).map(([k, v]) => [k, parseFloat(v)]));
      if (Object.keys(numericOnly).length) await saveLatestMeasurementsSnapshot(client.id, { progress: client.progress, measurements: client.measurements }, numericOnly);
      setHistory(next);
      setFields({});
      updateClient({ ...client, measurementsHistory: next, measurements: { ...client.measurements, ...numericOnly } });
      showToast("Measurement entry saved.", "success");
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id) {
    const ok = await confirmDialog("Delete this measurement entry? This cannot be undone.", { danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    const next = history.filter((e) => e.id !== id);
    await saveMeasurementHistory(client.id, next);
    setHistory(next);
    updateClient({ ...client, measurementsHistory: next });
  }

  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Sheet title={`Measurements · ${client.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={label}>New entry date</div>
          <input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} style={inputStyle({ marginTop: 6 })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {MEASUREMENT_FIELDS.map(([key, name]) => (
            <label key={key} style={{ display: "block" }}>
              <div style={{ ...label, marginBottom: 6 }}>{name}</div>
              <input value={fields[key] || ""} onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))} placeholder="-" style={inputStyle()} />
            </label>
          ))}
        </div>
        <Button onClick={addEntry} disabled={saving}>{saving ? "Saving..." : "Save entry"}</Button>

        <div style={{ borderTop: `${BRAND.hairline} solid ${BRAND.line}`, paddingTop: 14 }}>
          <div style={{ ...label, marginBottom: 10 }}>History</div>
          {sorted.length === 0 && <div style={{ fontFamily: BRAND.sans, fontSize: 13, color: BRAND.muted }}>No measurements logged yet.</div>}
          {sorted.map((entry) => (
            <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: `${BRAND.hairline} solid ${BRAND.lineSoft}` }}>
              <div>
                <div style={{ fontFamily: BRAND.sans, fontSize: 13, fontWeight: 500, color: BRAND.text }}>{entry.date}</div>
                <div style={{ fontFamily: BRAND.sans, fontSize: 11.5, color: BRAND.muted, marginTop: 2 }}>
                  {MEASUREMENT_FIELDS.filter(([k]) => entry[k] != null && entry[k] !== "").map(([k, name]) => `${name} ${entry[k]}`).join(" · ") || "No values"}
                </div>
              </div>
              <button type="button" onClick={() => removeEntry(entry.id)} style={{ background: "none", border: "none", color: BRAND.red, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
