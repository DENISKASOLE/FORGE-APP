import { useMemo } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { renderBarChartPNG, renderSeriesChartPNG } from "../../lib/reportCharts.js";
import { datesInRange } from "./progressReportMath.js";
import { REPORT_COLORS as C } from "./progressReportModel.js";

function short(iso) { return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""; }
const sectionLabel = { fontFamily: BRAND.sans, fontSize: 10, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 };
const h2 = { fontFamily: BRAND.display, fontSize: 19, fontWeight: 700, color: BRAND.text, margin: "2px 0 14px" };
const statLabel = { fontFamily: BRAND.sans, fontSize: 9.5, color: BRAND.muted, letterSpacing: "0.08em", textTransform: "uppercase" };
const statValue = { fontFamily: BRAND.display, fontSize: 20, fontWeight: 700, color: BRAND.text };

function Tile({ label, value, sub }) {
  return (
    <div style={{ background: BRAND.card2, borderRadius: 12, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={statLabel}>{label}</span>
      <span style={statValue}>{value}</span>
      {sub && <span style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.dim }}>{sub}</span>}
    </div>
  );
}
function ChartImg({ src, height = 150 }) {
  return <img src={src} alt="" style={{ width: "100%", height, display: "block" }} />;
}
function EmptyNote({ children }) {
  return <div style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.muted, padding: "10px 0" }}>{children}</div>;
}

function SummaryPage({ model, notes }) {
  const { training, nutrition, body, period, comparison } = model;
  const tiles = [];
  if (body.weight.length) {
    const change = body.weight[body.weight.length - 1].value - body.weight[0].value;
    tiles.push({ label: "Weight change", value: `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`, sub: `${body.weight.length} readings` });
  }
  if (training.planned) tiles.push({ label: "Sessions completed", value: `${training.completedCount}/${training.planned}`, sub: `${Math.round(training.completionRate * 100)}% of planned` });
  if (training.planned) tiles.push({ label: "Training volume", value: `${(training.totalVolume / 1000).toFixed(1)} t`, sub: `${training.sessions.length} completed workouts` });
  if (nutrition.totalDays) tiles.push({ label: "Nutrition logging", value: `${nutrition.loggedCount}/${nutrition.totalDays}`, sub: nutrition.adherence != null ? `${Math.round(nutrition.adherence * 100)}% meal adherence` : "days logged" });
  if (training.pbs.length) tiles.push({ label: "Personal bests", value: String(training.pbs.length), sub: "set this period" });

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={sectionLabel}>Executive summary · {short(period.from)} – {short(period.to)}</div>
        <div style={h2}>Client Progress Report</div>
      </div>
      <div style={{ display: "flex", gap: 10, fontFamily: BRAND.sans, fontSize: 12, color: BRAND.muted, flexWrap: "wrap" }}>
        <span>Compared with {comparison.window ? `${short(comparison.window.a)} – ${short(comparison.window.b)}` : "nothing"}</span>
      </div>
      {tiles.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
          {tiles.map((t, i) => <Tile key={i} {...t} />)}
        </div>
      ) : <EmptyNote>Not enough data yet to show headline numbers for this period.</EmptyNote>}
      <div>
        <div style={sectionLabel}>Period highlights</div>
        {model.wins.length === 0 && <EmptyNote>No highlights could be supported by this period's data.</EmptyNote>}
        {model.wins.map((w, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 6, padding: "4px 0" }}>
            <span style={{ fontFamily: BRAND.sans, fontWeight: 600, color: C.kcal }}>{i + 1}</span>
            <div>
              <div style={{ fontFamily: BRAND.sans, fontSize: 13, color: BRAND.text }}>{(notes.wins[i] ?? w.text)}</div>
              <div style={{ fontFamily: BRAND.sans, fontSize: 10.5, color: BRAND.muted }}>Evidence: {w.source}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 14px", borderLeft: `2px solid ${C.kcal}`, background: BRAND.card2, borderRadius: 8 }}>
        <div style={sectionLabel}>From your coach</div>
        <p style={{ margin: 0, fontFamily: BRAND.sans, fontSize: 13, lineHeight: 1.5, color: BRAND.text }}>{notes.summary || "No summary written yet."}</p>
      </div>
    </Card>
  );
}

function BodyPage({ model }) {
  const { body, period } = model;
  const days = datesInRange(period.from, period.to);
  const idxByDate = Object.fromEntries(days.map((d, i) => [d, i]));
  const weightChart = useMemo(() => {
    if (body.weight.length < 2) return null;
    const vals = body.weight.map((p) => p.value);
    const rollVals = body.weightRoll.map((p) => p.value);
    const all = [...vals, ...rollVals];
    return renderSeriesChartPNG({
      width: 640, height: 170, yMin: Math.min(...all) - 0.3, yMax: Math.max(...all) + 0.3, yCount: 4,
      xCount: days.length, xLabels: [{ i: 0, label: short(days[0]) }, { i: days.length - 1, label: short(days[days.length - 1]) }],
      series: [
        { type: "line", points: body.weightRoll.map((p) => ({ i: idxByDate[p.date], v: p.value })), color: C.ink, width: 1.8 },
        { type: "dots", points: body.weight.map((p) => ({ i: idxByDate[p.date], v: p.value })), color: C.kcal, r: 3 },
      ],
    });
  }, [body, days, idxByDate]);

  const numericFields = Object.keys(body.measurements.latest || {}).filter((k) => k !== "id" && k !== "date" && !isNaN(parseFloat(body.measurements.latest?.[k])));

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={h2}>Body metrics</div>
      <div>
        <div style={sectionLabel}>Body weight · {body.weight.length} readings</div>
        {weightChart ? <ChartImg src={weightChart} /> : <EmptyNote>Not enough weight readings in this period to show a trend.</EmptyNote>}
      </div>
      <div>
        <div style={sectionLabel}>Measurements</div>
        {body.measurements.latest ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {numericFields.map((k) => {
              const latest = body.measurements.latest[k];
              const prev = body.measurements.prev?.[k];
              const delta = prev != null ? +(latest - prev).toFixed(1) : null;
              return (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5, borderBottom: `${BRAND.hairline} solid ${BRAND.lineSoft}`, padding: "5px 0" }}>
                  <span style={{ color: BRAND.text, textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                  <span style={{ color: BRAND.muted }}>{latest}{delta != null ? ` (${delta > 0 ? "+" : ""}${delta} vs previous)` : ""}</span>
                </div>
              );
            })}
          </div>
        ) : <EmptyNote>No measurements recorded in this period.</EmptyNote>}
      </div>
    </Card>
  );
}

function TrainingPage({ model }) {
  const { training } = model;
  const volChart = useMemo(() => {
    if (!training.weeklyVolume.length) return null;
    return renderBarChartPNG(training.weeklyVolume.map((w) => short(w.start)), training.weeklyVolume.map((w) => Math.round(w.volume / 1000 * 10) / 10), { color: C.kcal, suffix: "t", width: 640, height: 170 });
  }, [training]);
  const catChart = useMemo(() => {
    const entries = Object.entries(training.categories);
    if (!entries.length) return null;
    return renderBarChartPNG(entries.map(([k]) => k), entries.map(([, v]) => Math.round(v)), { color: C.protein, width: 640, height: 150 });
  }, [training]);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={h2}>Training performance</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
        <Tile label="Planned" value={training.planned} sub="sessions" />
        <Tile label="Completed" value={training.completedCount} sub={`${Math.round(training.completionRate * 100)}%`} />
        <Tile label="Missed" value={training.missed} sub="sessions" />
      </div>
      <div>
        <div style={sectionLabel}>Completed volume per week</div>
        {volChart ? <ChartImg src={volChart} /> : <EmptyNote>No completed sessions with set data in this period.</EmptyNote>}
      </div>
      <div>
        <div style={sectionLabel}>Strength progression</div>
        {training.progression.filter((p) => p.hasData).length === 0 && <EmptyNote>Not enough repeated sets in this period to show progression.</EmptyNote>}
        {training.progression.filter((p) => p.hasData).map((p) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5, borderBottom: `${BRAND.hairline} solid ${BRAND.lineSoft}`, padding: "6px 0" }}>
            <span style={{ color: BRAND.text }}>{p.name}</span>
            <span style={{ color: BRAND.muted }}>{p.first.load}kg×{p.first.reps} → {p.last.load}kg×{p.last.reps} ({p.change > 0 ? "+" : ""}{p.change}kg){p.e1rmLast ? ` · est. 1RM ${Math.round(p.e1rmLast)}kg` : ""}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={sectionLabel}>Volume by category</div>
        {catChart ? <ChartImg src={catChart} height={130} /> : <EmptyNote>No categorized volume this period.</EmptyNote>}
      </div>
      <div>
        <div style={sectionLabel}>Personal bests</div>
        {training.pbs.length === 0 && <EmptyNote>No personal bests set this period.</EmptyNote>}
        {training.pbs.map((pb, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5, padding: "4px 0" }}>
            <span style={{ color: BRAND.text }}>{pb.name}</span>
            <span style={{ color: BRAND.muted }}>{pb.detail} · {short(pb.date)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NutritionPage({ model }) {
  const { nutrition } = model;
  const kcalChart = useMemo(() => {
    const logged = nutrition.days.filter((d) => d.has);
    if (!logged.length) return null;
    return renderBarChartPNG(logged.map((d) => short(d.date)), logged.map((d) => d.totals.kcal), { color: C.kcal, width: 640, height: 160 });
  }, [nutrition]);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={h2}>Nutrition performance</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
        <Tile label="Logging consistency" value={`${nutrition.loggedCount}/${nutrition.totalDays}`} sub="days logged" />
        <Tile label="Meal adherence" value={nutrition.adherence != null ? `${Math.round(nutrition.adherence * 100)}%` : "Not calculated"} sub={nutrition.adherence != null ? `${nutrition.counts.eaten}/${nutrition.outcome} as planned` : "No plan prescribed"} />
        <Tile label="Target attainment" value={nutrition.loggedCount ? `${nutrition.kcalWithinTarget}/${nutrition.loggedCount}` : "—"} sub="days within ±10% kcal" />
      </div>
      <div>
        <div style={sectionLabel}>Logged calories per day</div>
        {kcalChart ? <ChartImg src={kcalChart} /> : <EmptyNote>No logged days in this period.</EmptyNote>}
      </div>
    </Card>
  );
}

function HeartPage({ model }) {
  const { heart } = model;
  const hrChart = useMemo(() => {
    if (!heart.hasHr) return null;
    const pts = heart.hr.map((h, i) => ({ i, ...h }));
    const vals = pts.flatMap((p) => [p.avg, p.max]).filter((v) => v != null);
    if (!vals.length) return null;
    return renderSeriesChartPNG({
      width: 640, height: 160, yMin: Math.min(...vals) - 8, yMax: Math.max(...vals) + 6, xCount: pts.length,
      xLabels: pts.map((p, i) => ({ i, label: short(p.date) })).filter((_, i) => i === 0 || i === pts.length - 1),
      series: [
        { type: "triangles", points: pts.filter((p) => p.max != null).map((p) => ({ i: p.i, v: p.max })), color: C.ink },
        { type: "dots", points: pts.filter((p) => p.avg != null).map((p) => ({ i: p.i, v: p.avg })), color: C.kcal, r: 3 },
      ],
    });
  }, [heart]);
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={h2}>Heart rate & workout energy</div>
      <div>
        <div style={sectionLabel}>Workout heart rate · avg / peak per session</div>
        {hrChart ? <ChartImg src={hrChart} /> : <EmptyNote>No heart-rate data logged for sessions this period.</EmptyNote>}
      </div>
      <div>
        <div style={sectionLabel}>Estimated calories burned</div>
        {heart.hasKcal ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {heart.kcal.map((k, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5 }}>
                <span style={{ color: BRAND.text }}>{short(k.date)}</span>
                <span style={{ color: BRAND.muted }}>{k.value} kcal (estimate)</span>
              </div>
            ))}
          </div>
        ) : <EmptyNote>Not recorded for sessions this period.</EmptyNote>}
      </div>
    </Card>
  );
}

function RecoveryPage({ model }) {
  const { recovery } = model;
  const sleepChart = useMemo(() => {
    if (recovery.sleep.length < 2) return null;
    return renderBarChartPNG(recovery.sleep.map((s) => short(s.date)), recovery.sleep.map((s) => s.value), { color: C.fat, width: 640, height: 140, suffix: "h" });
  }, [recovery]);
  const stepsChart = useMemo(() => {
    if (recovery.steps.length < 2) return null;
    return renderBarChartPNG(recovery.steps.map((s) => short(s.date)), recovery.steps.map((s) => s.value), { color: C.muted, width: 640, height: 140 });
  }, [recovery]);
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={h2}>Recovery & behaviour</div>
      <div>
        <div style={sectionLabel}>Sleep, hours</div>
        {sleepChart ? <ChartImg src={sleepChart} height={120} /> : <EmptyNote>Not enough sleep entries this period.</EmptyNote>}
      </div>
      <div>
        <div style={sectionLabel}>Steps</div>
        {stepsChart ? <ChartImg src={stepsChart} height={120} /> : <EmptyNote>Not enough step entries this period.</EmptyNote>}
      </div>
      <div>
        <div style={sectionLabel}>Weekly check-ins</div>
        {recovery.checkins.hasCheck ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recovery.checkins.checks.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5 }}>
                <span style={{ color: BRAND.text }}>{short(c.date)}</span>
                <span style={{ color: BRAND.muted }}>{[c.energy != null && `Energy ${c.energy}`, c.soreness != null && `Soreness ${c.soreness}`, c.stress != null && `Stress ${c.stress}`].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        ) : <EmptyNote>No matching check-in scale questions configured for this client.</EmptyNote>}
      </div>
    </Card>
  );
}

function ReviewPage({ model, notes }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={h2}>Coach review & next period</div>
      <p style={{ margin: 0, fontFamily: BRAND.sans, fontSize: 13.5, lineHeight: 1.55, color: BRAND.text }}>{notes.summary || "No summary written yet."}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={sectionLabel}>Top wins</div>
          {model.wins.map((w, i) => <div key={i} style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.text, padding: "3px 0" }}>{i + 1}. {notes.wins[i] ?? w.text}</div>)}
        </div>
        <div>
          <div style={sectionLabel}>Main challenge</div>
          <div style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.text }}>{notes.challenge || model.challenge}</div>
        </div>
      </div>
      <div>
        <div style={sectionLabel}>Priorities for next period</div>
        {notes.prios.filter((p) => p && p.trim()).map((p, i) => <div key={i} style={{ fontFamily: BRAND.sans, fontSize: 13, color: BRAND.text, padding: "3px 0" }}>{i + 1}. {p}</div>)}
        {notes.prios.every((p) => !p || !p.trim()) && <EmptyNote>No priorities set yet.</EmptyNote>}
      </div>
      <div>
        <div style={sectionLabel}>Goals</div>
        {notes.goals.filter((g) => g[0] || g[1]).map((g, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5, borderBottom: `${BRAND.hairline} solid ${BRAND.lineSoft}`, padding: "6px 0" }}>
            <span style={{ color: BRAND.text, fontWeight: 500 }}>{g[0] || "—"}</span>
            <span style={{ color: BRAND.muted }}>{g[1] || "—"}</span>
          </div>
        ))}
      </div>
      {notes.reflOn && notes.refl?.trim() && (
        <div style={{ padding: "12px 14px", background: BRAND.card2, borderRadius: 8 }}>
          <div style={sectionLabel}>Client reflection</div>
          <div style={{ fontFamily: BRAND.sans, fontSize: 13, fontStyle: "italic", color: BRAND.text }}>&ldquo;{notes.refl}&rdquo;</div>
        </div>
      )}
    </Card>
  );
}

const PAGE_COMPONENTS = { summary: SummaryPage, body: BodyPage, training: TrainingPage, nutrition: NutritionPage, heart: HeartPage, recovery: RecoveryPage, review: ReviewPage };

export function ReportPreview({ model, notes }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {model.includedSections.map((key) => {
        const Page = PAGE_COMPONENTS[key];
        return Page ? <Page key={key} model={model} notes={notes} /> : null;
      })}
    </div>
  );
}
