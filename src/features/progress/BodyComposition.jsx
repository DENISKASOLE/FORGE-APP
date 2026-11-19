import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { uid } from "../../lib/uid.js";
import { isoDate } from "../../lib/dateUtils.js";
import { uploadClientFile, getSignedPhotoUrl, deleteClientPhoto } from "../../lib/storage.js";
import { weightHistoryFromCheckins } from "../../lib/clientMetrics.js";
import { scansFor, latestWithChange, leanFrom, saveScans } from "../../lib/bodyComposition.js";

// Progress › Body composition (Nov 19 2026). One card for body weight,
// body fat % and lean body mass - replaces the separate "Body Weight" card
// and the AI-read "Body Analysis" uploads. Weight also includes check-in
// and quick-log weigh-ins; body fat and lean mass come from scans the coach
// enters from an InBody/DEXA report.
const METRICS = [
  { key: "weight", label: "Body weight", short: "Weight", unit: "kg", good: "down", color: "var(--accent)" },
  { key: "bodyFat", label: "Body fat", short: "Body fat", unit: "%", good: "down", color: "var(--orange)" },
  { key: "leanMass", label: "Lean body mass", short: "Lean mass", unit: "kg", good: "up", color: "var(--green)" },
];
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" }) : "");
const lbl = { fontFamily: BRAND.sans, fontSize: 11, fontWeight: 600, color: BRAND.muted, letterSpacing: "0.08em", textTransform: "uppercase" };

function weightSeries(client, scans) {
  const byDate = new Map();
  weightHistoryFromCheckins(client.checkIns, client.measurementsHistory).forEach((p) => byDate.set(p.date, p.value));
  scans.forEach((s) => { if (s.weight != null) byDate.set(s.date, s.weight); });
  return [...byDate.entries()].map(([date, value]) => ({ date, value: Number(value) })).filter((p) => Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
}

function Trend({ points, color, unit }) {
  if (points.length < 2) return <div style={{ fontFamily: BRAND.sans, fontSize: 12, color: BRAND.dim, padding: "18px 2px 6px" }}>A trend line appears after the second reading.</div>;
  const W = 320, H = 96, P = 8;
  const vs = points.map((p) => p.value), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const x = (i) => P + (i * (W - P * 2)) / (points.length - 1);
  const y = (v) => H - P - ((v - lo) / span) * (H - P * 2 - 10);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
        <path d={`${d} L${x(points.length - 1)} ${H} L${x(0)} ${H} Z`} fill={color} opacity="0.08" />
        <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.6} fill={i === points.length - 1 ? color : "var(--card)"} stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 10.5, color: BRAND.dim, marginTop: 4 }}>
        <span>{fmtDate(points[0].date)} · {points[0].value}{unit}</span>
        <span style={{ color: BRAND.text, fontWeight: 600 }}>{fmtDate(last.date)} · {last.value}{unit}</span>
      </div>
    </div>
  );
}

function ScanEditor({ scan, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(scan?.date || isoDate());
  const [weight, setWeight] = useState(scan?.weight ?? "");
  const [bodyFat, setBodyFat] = useState(scan?.bodyFat ?? "");
  const [lean, setLean] = useState(scan?.leanMass ?? "");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const autoLean = leanFrom(weight, bodyFat);
  const field = (label, value, set, unit, placeholder) => (
    <label style={{ display: "block" }}>
      <div style={{ fontFamily: BRAND.sans, fontSize: 14, fontWeight: 500, color: BRAND.text, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", height: 50, borderRadius: 999, border: "1.5px solid var(--line-strong)", background: BRAND.card, padding: "0 18px" }}>
        <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: BRAND.text, fontSize: 17, fontFamily: BRAND.sans }} />
        <span style={{ color: BRAND.muted, fontSize: 14, fontFamily: BRAND.sans }}>{unit}</span>
      </div>
    </label>
  );
  async function save() {
    if (weight === "" && bodyFat === "" && lean === "") { showToast("Enter at least one number from the report.", "warn"); return; }
    setBusy(true);
    await onSave({ date, weight, bodyFat, leanMass: lean === "" ? autoLean : lean, file });
    setBusy(false);
  }
  return (
    <div className="fx-push" style={{ position: "fixed", inset: 0, zIndex: 1300, background: "var(--page)", overflowY: "auto", padding: "calc(env(safe-area-inset-top) + 12px) 22px calc(env(safe-area-inset-bottom) + 28px)", boxSizing: "border-box", fontFamily: BRAND.sans, color: BRAND.text }}>
      <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onClose} disabled={busy} style={{ background: "none", border: "none", color: BRAND.muted, fontSize: 15, fontWeight: 600, cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}>Cancel</button>
          {scan && onDelete && <button onClick={onDelete} style={{ background: "none", border: "none", color: BRAND.red, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>}
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{scan ? "Edit scan" : "Add body composition scan"}</div>
        <div style={{ fontSize: 14, color: BRAND.muted, lineHeight: 1.5, marginTop: -8 }}>Copy the numbers from the InBody, DEXA or scale report.</div>
        <label style={{ display: "block" }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Scan date</div>
          <input type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", height: 50, borderRadius: 999, border: "1.5px solid var(--line-strong)", background: BRAND.card, padding: "0 18px", fontSize: 16, color: BRAND.text, fontFamily: "inherit" }} />
        </label>
        {field("Body weight", weight, setWeight, "kg", "e.g. 79.2")}
        {field("Body fat", bodyFat, setBodyFat, "%", "e.g. 18.4")}
        {field("Lean body mass", lean, setLean, "kg", autoLean != null ? `${autoLean} (worked out)` : "e.g. 64.6")}
        {!scan && (
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 54, borderRadius: 16, border: "1.5px dashed var(--line-strong)", color: BRAND.muted, fontSize: 14, cursor: "pointer", padding: "0 14px", textAlign: "center" }}>
            {file ? `📎 ${file.name}` : "Attach the report (optional)"}
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
          </label>
        )}
        <button onClick={save} disabled={busy} className="pressable"
          style={{ height: 54, borderRadius: 999, border: "none", background: "var(--btn-bg)", color: "var(--btn-ink)", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {busy ? "Saving…" : "Save scan"}
        </button>
      </div>
    </div>
  );
}

export function BodyCompositionCard({ client, updateClient, isCoach }) {
  const scans = scansFor(client);
  const manual = client.bodyComposition || [];
  const [metric, setMetric] = useState("weight");
  const [editing, setEditing] = useState(null); // null | "new" | scan
  const [allScans, setAllScans] = useState(false);
  const wSeries = weightSeries(client, scans);
  const latestWeight = wSeries.length ? { value: wSeries[wSeries.length - 1].value, date: wSeries[wSeries.length - 1].date, change: wSeries.length > 1 ? Math.round((wSeries[wSeries.length - 1].value - wSeries[wSeries.length - 2].value) * 10) / 10 : null } : (client.weight ? { value: client.weight, change: null } : null);
  const now = { weight: latestWeight, bodyFat: latestWithChange(scans, "bodyFat"), leanMass: latestWithChange(scans, "leanMass") };
  const m = METRICS.find((x) => x.key === metric);
  const series = metric === "weight" ? wSeries : [...scans].reverse().filter((s) => s[metric] != null).map((s) => ({ date: s.date, value: s[metric] }));

  async function handleSave({ date, weight, bodyFat, leanMass, file }) {
    let storagePath = editing && editing !== "new" ? editing.storagePath || "" : "";
    let fileName = editing && editing !== "new" ? editing.fileName || "" : "";
    if (file) {
      try { storagePath = await uploadClientFile(client.id, "body-composition", file, (file.name.split(".").pop() || "pdf").toLowerCase()); fileName = file.name; }
      catch { showToast("Saved, but the report file couldn't be attached.", "warn"); }
    }
    const scan = { id: editing && editing !== "new" && !editing.legacy ? editing.id : uid(), date, weight, bodyFat, leanMass, storagePath, fileName, enteredAt: new Date().toISOString() };
    const rest = manual.filter((s) => s.id !== scan.id && !(editing?.legacy && s.date === editing.date));
    const r = await saveScans(client, [scan, ...rest], updateClient);
    setEditing(null);
    showToast(r?.error ? "Saved on this device - it will sync." : "Scan saved.", "success");
  }
  async function handleDelete() {
    const s = editing;
    if (!(await confirmDialog("Delete this scan?", { danger: true, confirmLabel: "Delete" }))) return;
    if (s.legacy) { showToast("This scan came from an older report. Remove it under the old Body Analysis reports.", "warn"); return; }
    if (s.storagePath) await deleteClientPhoto(s.storagePath).catch(() => {});
    await saveScans(client, manual.filter((x) => x.id !== s.id), updateClient);
    setEditing(null);
  }
  async function openFile(s) {
    const url = await getSignedPhotoUrl(s.storagePath);
    if (url) window.open(url, "_blank"); else showToast("Couldn't open that file.", "error");
  }

  return (
    <div className="glass" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ fontFamily: BRAND.display, fontWeight: 700, fontSize: 18, color: BRAND.text }}>Body composition analytics</div>
          {scans[0] && <div style={{ fontFamily: BRAND.sans, fontSize: 12, color: BRAND.muted, marginTop: 2 }}>Last scan {fmtDate(scans[0].date)}</div>}
        </div>
        {isCoach && <Button onClick={() => setEditing("new")} style={{ flexShrink: 0 }}>+ Add scan</Button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
        {METRICS.map((x) => {
          const v = now[x.key];
          const ch = v?.change;
          const good = ch == null || ch === 0 ? null : x.good === "down" ? ch < 0 : ch > 0;
          const on = metric === x.key;
          return (
            <button key={x.key} onClick={() => setMetric(x.key)} aria-pressed={on}
              style={{ textAlign: "left", minWidth: 0, background: BRAND.card, border: `1.5px solid ${on ? x.color : "var(--line-strong)"}`, borderRadius: 14, padding: "10px 10px 9px", cursor: "pointer", fontFamily: BRAND.sans, color: BRAND.text }}>
              <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.short}</div>
              <div style={{ marginTop: 3, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>{v?.value ?? "–"}</span>
                <span style={{ fontSize: 11, color: BRAND.muted, marginLeft: 2 }}>{x.unit}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: good == null ? BRAND.dim : good ? BRAND.green : BRAND.red, whiteSpace: "nowrap" }}>
                {ch == null ? "—" : ch === 0 ? "no change" : `${ch > 0 ? "▲" : "▼"} ${Math.abs(ch)}${x.unit}`}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: BRAND.sans, fontSize: 12, fontWeight: 600, color: BRAND.text, marginBottom: 6 }}>{m.label} trend</div>
        <Trend points={series} color={m.color} unit={m.unit} />
      </div>

      {scans.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={lbl}>{allScans ? "Scans" : "Latest scan"}</div>
            {scans.length > 1 && (
              <button type="button" onClick={() => setAllScans((v) => !v)} aria-expanded={allScans} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "4px 0", cursor: "pointer", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, fontFamily: BRAND.sans }}>
                {allScans ? "Show less" : `All scans (${scans.length})`}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: allScans ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="m6 9 6 6 6-6" /></svg>
              </button>
            )}
          </div>
          {(allScans ? scans : scans.slice(0, 1)).map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: i ? `1px solid ${BRAND.line}` : "none", fontFamily: BRAND.sans }}>
              <button onClick={() => isCoach && setEditing(s)} style={{ flex: 1, minWidth: 0, display: "flex", gap: 10, alignItems: "baseline", background: "none", border: "none", padding: 0, cursor: isCoach ? "pointer" : "default", textAlign: "left", color: BRAND.text, fontFamily: "inherit" }}>
                <span style={{ fontSize: 13, fontWeight: 600, width: 74, flexShrink: 0 }}>{fmtDate(s.date)}</span>
                <span style={{ fontSize: 12.5, color: BRAND.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[s.weight != null && `${s.weight} kg`, s.bodyFat != null && `${s.bodyFat}% fat`, s.leanMass != null && `${s.leanMass} kg lean`].filter(Boolean).join(" · ")}
                </span>
              </button>
              {s.storagePath && <button onClick={() => openFile(s)} style={{ background: "none", border: "none", color: BRAND.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>Report</button>}
            </div>
          ))}
        </div>
      )}

      {!scans.length && isCoach && (
        <div style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.dim, lineHeight: 1.5, marginTop: 12 }}>
          Add a scan with weight, body fat and lean mass from an InBody or DEXA report.
        </div>
      )}

      {editing && <ScanEditor scan={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={handleSave} onDelete={editing !== "new" ? handleDelete : null} />}
    </div>
  );
}
