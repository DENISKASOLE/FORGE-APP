import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { buildWeeklyReport } from "../../lib/weeklyReport.js";
import { buildWeeklyReportPDF, sharePdfBlob, safeFilename } from "../../lib/pdf.js";

// On-screen bars are plain SVG rects, matching how the rest of Progress
// hand-draws its charts (VolumeTrendChart/WeightSparkline) rather than
// pulling in a charting library. The exported PDF renders the identical
// week buckets via reportCharts.js's canvas version of the same idea -
// different rendering target, same numbers, same shape.
function BarChart({ labels, values, color, suffix = "" }) {
  const w = 320, h = 120, padSide = 6, padBottom = 20, padTop = 18;
  const max = Math.max(1, ...values);
  const barW = (w - padSide * 2) / values.length;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <line x1={padSide} y1={h - padBottom} x2={w - padSide} y2={h - padBottom} stroke="var(--line-soft)" strokeWidth={1} />
      {values.map((v, i) => {
        const barH = (v / max) * (h - padTop - padBottom);
        const x = padSide + i * barW + barW * 0.2;
        const bw = barW * 0.6;
        const y = h - padBottom - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(barH, 1)} rx={4} fill={color} opacity={i === values.length - 1 ? 1 : 0.72} />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="9" fontWeight="600" fill={BRAND.text}>{v ? `${v}${suffix}` : "-"}</text>
            <text x={x + bw / 2} y={h - padBottom + 13} textAnchor="middle" fontSize="8" fill={BRAND.dim}>{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
function LineChart({ labels, values, color }) {
  const w = 320, h = 100, pad = 8;
  if (values.length < 2) return <div style={{ height: h, display: "grid", placeItems: "center", color: BRAND.dim, fontSize: 12 }}>Not enough weigh-ins yet</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => [pad + (i / (values.length - 1)) * (w - pad * 2), h - pad - ((v - min) / span) * (h - pad * 2)]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 4 : 2.5} fill={color} />)}
    </svg>
  );
}
function ChartCard({ heading, children }) {
  return (
    <div className="glass" style={{ padding: 16 }}>
      <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>{heading}</div>
      {children}
    </div>
  );
}
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: "12px 10px", textAlign: "center" }}>
      <div style={{ color: color || BRAND.text, fontWeight: 700, fontSize: 18 }}>{value}</div>
      <div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

// Coach-only. Reads via buildWeeklyReport (lib/weeklyReport.js) so the
// numbers shown here and the numbers in the exported PDF can never drift -
// same function, two render targets (SVG on screen, canvas PNG on paper).
export function WeeklyReportModal({ client, onClose }) {
  const isMobile = useIsMobile(520);
  const [weeksBack, setWeeksBack] = useState(4);
  const [exporting, setExporting] = useState(false);
  const report = buildWeeklyReport(client, weeksBack);
  const weekLabels = report.weeks.map((w) => w.label);

  async function exportPDF() {
    setExporting(true);
    try {
      const blob = await buildWeeklyReportPDF(client, report);
      const result = await sharePdfBlob(blob, `${safeFilename(client.name)}_weekly_report_${report.generatedAt}.pdf`, `${client.name}'s Progress Report`);
      if (result === "downloaded") showToast("Report downloaded — attach it wherever you message this client.", "success");
      else if (result === "shared") showToast("Report ready to send.", "success");
    } catch (e) {
      showToast(e.message || "Couldn't build the PDF.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: BRAND.bg, zIndex: 1100, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "14px 14px 0" : "18px 18px 0", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 10, width: 36, height: 36, color: BRAND.muted, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>&larr;</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 19 : 22, fontWeight: 500, color: BRAND.text }}>Weekly Report</div>
          <div style={{ color: BRAND.muted, fontSize: 12 }}>{report.windowStart} – {report.windowEnd}</div>
        </div>
        <Button onClick={exportPDF} disabled={exporting} style={{ flexShrink: 0 }}>{exporting ? "Building..." : "Export PDF"}</Button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 14 : 18, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[4, 8, 12].map((n) => (
            <button key={n} onClick={() => setWeeksBack(n)} style={{ fontFamily: BRAND.sans, flex: 1, padding: "9px 0", borderRadius: 999, border: `${BRAND.hairline} solid ${weeksBack === n ? "transparent" : BRAND.line}`, background: weeksBack === n ? BRAND.gold : BRAND.card2, color: weeksBack === n ? BRAND.btnInk : BRAND.muted, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>{n} weeks</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <StatCard label="Sessions" value={report.totalSessions} />
          <StatCard label="Volume (kg)" value={report.totalVolume.toLocaleString()} />
          <StatCard label="Weight Δ" value={report.weightChange != null ? `${report.weightChange > 0 ? "+" : ""}${report.weightChange}` : "–"} color={report.weightChange < 0 ? BRAND.green : report.weightChange > 0 ? BRAND.yellow : BRAND.text} />
          <StatCard label="PBs" value={report.pbs.length} color={report.pbs.length ? BRAND.green : BRAND.text} />
        </div>

        <ChartCard heading="Training volume per week (kg)">
          <BarChart labels={weekLabels} values={report.weeks.map((w) => w.volume)} color={BRAND.gold} />
        </ChartCard>
        <ChartCard heading="Sessions completed per week">
          <BarChart labels={weekLabels} values={report.weeks.map((w) => w.sessionsCompleted)} color={BRAND.blue} />
        </ChartCard>
        <ChartCard heading={report.macrosOnly ? "Macro tracking: days logged / 7" : "Nutrition: days logged / 7"}>
          <BarChart labels={weekLabels} values={report.weeks.map((w) => w.nutritionDaysLogged)} color={BRAND.green} />
        </ChartCard>
        <ChartCard heading="Bodyweight trend (kg)">
          <LineChart labels={report.weightPoints.map((p) => p.date.slice(5))} values={report.weightPoints.map((p) => p.value)} color={BRAND.violet} />
        </ChartCard>

        {report.pbs.length > 0 && (
          <ChartCard heading="Personal bests this period">
            <div style={{ display: "grid", gap: 6 }}>
              {report.pbs.map((pb, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                  <span style={{ color: BRAND.text, fontWeight: 500 }}>{pb.name}</span>
                  <span style={{ color: BRAND.green }}>{pb.detail}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
