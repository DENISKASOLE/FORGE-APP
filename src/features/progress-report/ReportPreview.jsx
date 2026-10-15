import { useMemo, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { MacroBar } from "../../components/ui/MacroBar.jsx";
import { renderBarChartPNG, renderSeriesChartPNG } from "../../lib/reportCharts.js";
import { datesInRange } from "./progressReportMath.js";
import { REPORT_COLORS as C } from "./progressReportModel.js";

function short(iso) { return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""; }
function weeklyLoggedDays(days) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    weeks.push({ label: short(chunk[0].date), count: chunk.filter((d) => d.has).length, total: chunk.length });
  }
  return weeks;
}

const sectionLabel = { fontFamily: BRAND.sans, fontSize: 10, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 };
const h2 = { fontFamily: BRAND.display, fontSize: 18, fontWeight: 700, color: BRAND.text };
const statLabel = { fontFamily: BRAND.sans, fontSize: 9.5, color: BRAND.muted, letterSpacing: "0.08em", textTransform: "uppercase" };
const statValue = { fontFamily: BRAND.display, fontSize: 22, fontWeight: 700, color: BRAND.text };

function Tile({ label, value, sub, big }) {
  return (
    <div style={{ background: BRAND.card2, borderRadius: 14, padding: big ? "14px 16px" : "11px 13px", display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={statLabel}>{label}</span>
      <span style={{ ...statValue, fontSize: big ? 28 : 20 }}>{value}</span>
      {sub && <span style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.dim }}>{sub}</span>}
    </div>
  );
}
function ChartImg({ src, height = 150 }) {
  return <img src={src} alt="" style={{ width: "100%", height, display: "block" }} />;
}
function EmptyNote({ children }) {
  return <div style={{ fontFamily: BRAND.sans, fontSize: 12.5, color: BRAND.muted, padding: "8px 0" }}>{children}</div>;
}
function MiniChart({ title, src, empty, height = 100 }) {
  return (
    <div style={{ flex: "0 0 260px", scrollSnapAlign: "start", background: BRAND.card2, borderRadius: 14, padding: 12, minWidth: 0 }}>
      <div style={{ ...statLabel, marginBottom: 8 }}>{title}</div>
      {src ? <ChartImg src={src} height={height} /> : <div style={{ fontFamily: BRAND.sans, fontSize: 11.5, color: BRAND.dim, padding: "20px 0" }}>{empty}</div>}
    </div>
  );
}
// Collapsed by default except the first one opened - the old Weekly
// Report's whole appeal was that it was short; cramming every detail
// page open at once recreated the "wall of empty state" problem this
// rewrite exists to fix. One section open, the rest a tap away.
function Collapsible({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "none", border: "none", padding: 16, cursor: "pointer", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <span style={h2}>{title}</span>
          {badge && <span style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted }}>{badge}</span>}
        </div>
        <span style={{ fontFamily: BRAND.sans, fontSize: 11, fontWeight: 600, color: BRAND.gold, flexShrink: 0 }}>{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>}
    </Card>
  );
}

function HeroSection({ model, notes }) {
  const { training, nutrition, body, period, comparison } = model;
  const tiles = [];
  if (body.weight.length) {
    const change = body.weight[body.weight.length - 1].value - body.weight[0].value;
    tiles.push({ label: "Weight change", value: `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`, sub: `${body.weight.length} readings` });
  }
  if (training.planned) tiles.push({ label: "Sessions completed", value: `${training.completedCount}/${training.planned}`, sub: `${Math.round(training.completionRate * 100)}% of planned` });
  if (training.planned) tiles.push({ label: "Training volume", value: `${(training.totalVolume / 1000).toFixed(1)} t`, sub: `${training.sessions.length} workouts` });
  if (nutrition.totalDays) tiles.push({ label: "Nutrition logging", value: `${nutrition.loggedCount}/${nutrition.totalDays}`, sub: nutrition.adherence != null ? `${Math.round(nutrition.adherence * 100)}% meal adherence` : "days logged" });
  if (training.pbs.length) tiles.push({ label: "Personal bests", value: String(training.pbs.length), sub: "set this period" });

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={sectionLabel}>Progress report · {short(period.from)} – {short(period.to)}</div>
        <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 800, color: BRAND.text, letterSpacing: "-0.4px" }}>{model.client.name}</div>
        <div style={{ fontFamily: BRAND.sans, fontSize: 11.5, color: BRAND.muted, marginTop: 2 }}>Compared with {comparison.window ? `${short(comparison.window.a)} – ${short(comparison.window.b)}` : "nothing"}</div>
      </div>
      {tiles.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {tiles.map((t, i) => <Tile key={i} big={i === 0} {...t} />)}
        </div>
      ) : <EmptyNote>Not enough data yet to show headline numbers for this period.</EmptyNote>}
      {training.planned > 0 && (
        <MacroBar label="Sessions completed" value={training.completedCount} target={training.planned} unit="" color={C.kcal} />
      )}
      {nutrition.adherence != null && (
        <MacroBar label="Meal adherence" value={Math.round(nutrition.adherence * 100)} target={100} unit="%" color={C.protein} />
      )}
      {model.wins.length > 0 && (
        <div>
          <div style={sectionLabel}>Highlights</div>
          {model.wins.map((w, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 6, padding: "4px 0" }}>
              <span style={{ fontFamily: BRAND.sans, fontWeight: 600, color: C.kcal }}>{i + 1}</span>
              <div style={{ fontFamily: BRAND.sans, fontSize: 13, color: BRAND.text, lineHeight: 1.4 }}>{notes.wins[i] ?? w.text}</div>
            </div>
          ))}
        </div>
      )}
      {notes.summary && (
        <div style={{ padding: "12px 14px", borderLeft: `2px solid ${C.kcal}`, background: BRAND.card2, borderRadius: 8 }}>
          <div style={sectionLabel}>From your coach</div>
          <p style={{ margin: 0, fontFamily: BRAND.sans, fontSize: 13, lineHeight: 1.5, color: BRAND.text }}>{notes.summary}</p>
        </div>
      )}
    </Card>
  );
}

// Revives the old Weekly Report's reliable 4-chart core - weight,
// training volume/week, sessions completed/week, nutrition days
// logged/week - as a quick horizontal-scroll strip up top, before the
// deeper collapsible detail below. Only renders charts that have data;
// disappears entirely if none do (the hero/wins above still carry the
// page in that case rather than showing four empty boxes in a row).
function CoreChartsStrip({ model }) {
  const { body, training, nutrition, period } = model;
  const days = useMemo(() => datesInRange(period.from, period.to), [period.from, period.to]);
  const idxByDate = useMemo(() => Object.fromEntries(days.map((d, i) => [d, i])), [days]);

  const weightChart = useMemo(() => {
    if (body.weight.length < 2) return null;
    const all = [...body.weight.map((p) => p.value), ...body.weightRoll.map((p) => p.value)];
    return renderSeriesChartPNG({
      width: 480, height: 120, yMin: Math.min(...all) - 0.3, yMax: Math.max(...all) + 0.3, yCount: 3, xCount: days.length,
      series: [
        { type: "line", points: body.weightRoll.map((p) => ({ i: idxByDate[p.date], v: p.value })), color: C.ink, width: 1.6 },
        { type: "dots", points: body.weight.map((p) => ({ i: idxByDate[p.date], v: p.value })), color: C.kcal, r: 2.6 },
      ],
    });
  }, [body, days, idxByDate]);
  const volChart = useMemo(() => training.weeklyVolume.length
    ? renderBarChartPNG(training.weeklyVolume.map((w) => short(w.start)), training.weeklyVolume.map((w) => Math.round(w.volume / 100) / 10), { color: C.kcal, suffix: "t", width: 480, height: 120 })
    : null, [training.weeklyVolume]);
  const sessChart = useMemo(() => training.weeklyVolume.length
    ? renderBarChartPNG(training.weeklyVolume.map((w) => short(w.start)), training.weeklyVolume.map((w) => w.count), { color: C.ink2 || "#5C5C5C", width: 480, height: 120 })
    : null, [training.weeklyVolume]);
  const nutritionChart = useMemo(() => {
    const weeks = weeklyLoggedDays(nutrition.days);
    return weeks.some((w) => w.count) ? renderBarChartPNG(weeks.map((w) => w.label), weeks.map((w) => w.count), { color: C.protein, width: 480, height: 120 }) : null;
  }, [nutrition.days]);

  const charts = [
    weightChart && { title: "Body weight", src: weightChart },
    volChart && { title: "Training volume / week", src: volChart },
    sessChart && { title: "Sessions completed / week", src: sessChart },
    nutritionChart && { title: "Nutrition days logged / week", src: nutritionChart },
  ].filter(Boolean);
  if (!charts.length) return null;

  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollSnapType: "x proximity", marginLeft: -2, paddingLeft: 2 }}>
      {charts.map((c, i) => <MiniChart key={i} title={c.title} src={c.src} height={90} />)}
    </div>
  );
}

function BodySection({ model }) {
  const { body, period } = model;
  const days = datesInRange(period.from, period.to);
  const idxByDate = Object.fromEntries(days.map((d, i) => [d, i]));
  const weightChart = useMemo(() => {
    if (body.weight.length < 2) return null;
    const all = [...body.weight.map((p) => p.value), ...body.weightRoll.map((p) => p.value)];
    return renderSeriesChartPNG({
      width: 640, height: 170, yMin: Math.min(...all) - 0.3, yMax: Math.max(...all) + 0.3, yCount: 4, xCount: days.length,
      xLabels: [{ i: 0, label: short(days[0]) }, { i: days.length - 1, label: short(days[days.length - 1]) }],
      series: [
        { type: "line", points: body.weightRoll.map((p) => ({ i: idxByDate[p.date], v: p.value })), color: C.ink, width: 1.8 },
        { type: "dots", points: body.weight.map((p) => ({ i: idxByDate[p.date], v: p.value })), color: C.kcal, r: 3 },
      ],
    });
  }, [body, days, idxByDate]);
  const numericFields = Object.keys(body.measurements.latest || {}).filter((k) => k !== "id" && k !== "date" && !isNaN(parseFloat(body.measurements.latest?.[k])));

  return (
    <>
      <div>
        <div style={sectionLabel}>Body weight · {body.weight.length} readings</div>
        {weightChart ? <ChartImg src={weightChart} /> : <EmptyNote>Not enough weight readings in this period to show a trend.</EmptyNote>}
      </div>
      {body.measurements.latest && numericFields.length > 0 && (
        <div>
          <div style={sectionLabel}>Measurements</div>
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
        </div>
      )}
    </>
  );
}

function TrainingSection({ model }) {
  const { training } = model;
  const volChart = useMemo(() => training.weeklyVolume.length
    ? renderBarChartPNG(training.weeklyVolume.map((w) => short(w.start)), training.weeklyVolume.map((w) => Math.round(w.volume / 100) / 10), { color: C.kcal, suffix: "t", width: 640, height: 170 })
    : null, [training.weeklyVolume]);
  const catChart = useMemo(() => {
    const entries = Object.entries(training.categories);
    return entries.length ? renderBarChartPNG(entries.map(([k]) => k), entries.map(([, v]) => Math.round(v)), { color: C.protein, width: 640, height: 150 }) : null;
  }, [training.categories]);
  const prog = training.progression.filter((p) => p.hasData);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10 }}>
        <Tile label="Planned" value={training.planned} sub="sessions" />
        <Tile label="Completed" value={training.completedCount} sub={`${Math.round(training.completionRate * 100)}%`} />
        <Tile label="Missed" value={training.missed} sub="sessions" />
      </div>
      <div>
        <div style={sectionLabel}>Completed volume per week</div>
        {volChart ? <ChartImg src={volChart} /> : <EmptyNote>No completed sessions with set data in this period.</EmptyNote>}
      </div>
      {prog.length > 0 && (
        <div>
          <div style={sectionLabel}>Strength progression</div>
          {prog.map((p) => (
            <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5, borderBottom: `${BRAND.hairline} solid ${BRAND.lineSoft}`, padding: "6px 0" }}>
              <span style={{ color: BRAND.text }}>{p.name}</span>
              <span style={{ color: BRAND.muted }}>{p.first.load}kg×{p.first.reps} → {p.last.load}kg×{p.last.reps} ({p.change > 0 ? "+" : ""}{p.change}kg){p.e1rmLast ? ` · est. 1RM ${Math.round(p.e1rmLast)}kg` : ""}</span>
            </div>
          ))}
        </div>
      )}
      {catChart && (
        <div>
          <div style={sectionLabel}>Volume by category</div>
          <ChartImg src={catChart} height={130} />
        </div>
      )}
      {training.pbs.length > 0 && (
        <div>
          <div style={sectionLabel}>Personal bests</div>
          {training.pbs.map((pb, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5, padding: "4px 0" }}>
              <span style={{ color: BRAND.text }}>{pb.name}</span>
              <span style={{ color: BRAND.muted }}>{pb.detail} · {short(pb.date)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function NutritionSection({ model }) {
  const { nutrition } = model;
  const kcalChart = useMemo(() => {
    const logged = nutrition.days.filter((d) => d.has);
    return logged.length ? renderBarChartPNG(logged.map((d) => short(d.date)), logged.map((d) => d.totals.kcal), { color: C.kcal, width: 640, height: 160 }) : null;
  }, [nutrition.days]);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        <Tile label="Logging consistency" value={`${nutrition.loggedCount}/${nutrition.totalDays}`} sub="days logged" />
        <Tile label="Meal adherence" value={nutrition.adherence != null ? `${Math.round(nutrition.adherence * 100)}%` : "N/A"} sub={nutrition.adherence != null ? `${nutrition.counts.eaten}/${nutrition.outcome} as planned` : "No plan prescribed"} />
        <Tile label="Target attainment" value={nutrition.loggedCount ? `${nutrition.kcalWithinTarget}/${nutrition.loggedCount}` : "—"} sub="days within ±10% kcal" />
      </div>
      <div>
        <div style={sectionLabel}>Logged calories per day</div>
        {kcalChart ? <ChartImg src={kcalChart} /> : <EmptyNote>No logged days in this period.</EmptyNote>}
      </div>
    </>
  );
}

function HeartSection({ model }) {
  const { heart } = model;
  const hrChart = useMemo(() => {
    if (!heart.hasHr) return null;
    const pts = heart.hr.map((h, i) => ({ i, ...h }));
    const vals = pts.flatMap((p) => [p.avg, p.max]).filter((v) => v != null);
    if (!vals.length) return null;
    return renderSeriesChartPNG({
      width: 640, height: 160, yMin: Math.min(...vals) - 8, yMax: Math.max(...vals) + 6, xCount: pts.length,
      series: [
        { type: "triangles", points: pts.filter((p) => p.max != null).map((p) => ({ i: p.i, v: p.max })), color: C.ink },
        { type: "dots", points: pts.filter((p) => p.avg != null).map((p) => ({ i: p.i, v: p.avg })), color: C.kcal, r: 3 },
      ],
    });
  }, [heart]);
  return (
    <>
      <div>
        <div style={sectionLabel}>Workout heart rate · avg / peak per session</div>
        {hrChart ? <ChartImg src={hrChart} /> : <EmptyNote>No heart-rate data logged for sessions this period.</EmptyNote>}
      </div>
      {heart.hasKcal && (
        <div>
          <div style={sectionLabel}>Estimated calories burned</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {heart.kcal.map((k, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5 }}>
                <span style={{ color: BRAND.text }}>{short(k.date)}</span>
                <span style={{ color: BRAND.muted }}>{k.value} kcal (estimate)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RecoverySection({ model }) {
  const { recovery } = model;
  const sleepChart = useMemo(() => recovery.sleep.length >= 2
    ? renderBarChartPNG(recovery.sleep.map((s) => short(s.date)), recovery.sleep.map((s) => s.value), { color: C.fat, width: 640, height: 140, suffix: "h" })
    : null, [recovery.sleep]);
  const stepsChart = useMemo(() => recovery.steps.length >= 2
    ? renderBarChartPNG(recovery.steps.map((s) => short(s.date)), recovery.steps.map((s) => s.value), { color: C.muted, width: 640, height: 140 })
    : null, [recovery.steps]);
  return (
    <>
      {sleepChart && <div><div style={sectionLabel}>Sleep, hours</div><ChartImg src={sleepChart} height={120} /></div>}
      {stepsChart && <div><div style={sectionLabel}>Steps</div><ChartImg src={stepsChart} height={120} /></div>}
      {recovery.checkins.hasCheck && (
        <div>
          <div style={sectionLabel}>Weekly check-ins</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recovery.checkins.checks.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5 }}>
                <span style={{ color: BRAND.text }}>{short(c.date)}</span>
                <span style={{ color: BRAND.muted }}>{[c.energy != null && `Energy ${c.energy}`, c.soreness != null && `Soreness ${c.soreness}`, c.stress != null && `Stress ${c.stress}`].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ReviewSection({ model, notes }) {
  const goals = notes.goals.filter((g) => g[0] || g[1]);
  const prios = notes.prios.filter((p) => p && p.trim());
  return (
    <>
      <p style={{ margin: 0, fontFamily: BRAND.sans, fontSize: 13.5, lineHeight: 1.55, color: BRAND.text }}>{notes.summary || model.challenge}</p>
      {prios.length > 0 && (
        <div>
          <div style={sectionLabel}>Priorities for next period</div>
          {prios.map((p, i) => <div key={i} style={{ fontFamily: BRAND.sans, fontSize: 13, color: BRAND.text, padding: "3px 0" }}>{i + 1}. {p}</div>)}
        </div>
      )}
      {goals.length > 0 && (
        <div>
          <div style={sectionLabel}>Goals</div>
          {goals.map((g, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontFamily: BRAND.sans, fontSize: 12.5, borderBottom: `${BRAND.hairline} solid ${BRAND.lineSoft}`, padding: "6px 0" }}>
              <span style={{ color: BRAND.text, fontWeight: 500 }}>{g[0] || "—"}</span>
              <span style={{ color: BRAND.muted }}>{g[1] || "—"}</span>
            </div>
          ))}
        </div>
      )}
      {notes.reflOn && notes.refl?.trim() && (
        <div style={{ padding: "12px 14px", background: BRAND.card2, borderRadius: 8 }}>
          <div style={sectionLabel}>Client reflection</div>
          <div style={{ fontFamily: BRAND.sans, fontSize: 13, fontStyle: "italic", color: BRAND.text }}>&ldquo;{notes.refl}&rdquo;</div>
        </div>
      )}
      {prios.length === 0 && goals.length === 0 && !notes.summary && <EmptyNote>Add coach notes to fill out this page.</EmptyNote>}
    </>
  );
}

const DETAIL_SECTIONS = {
  body: { title: "Body metrics", Component: BodySection },
  training: { title: "Training performance", Component: TrainingSection },
  nutrition: { title: "Nutrition performance", Component: NutritionSection },
  heart: { title: "Heart rate & workout energy", Component: HeartSection },
  recovery: { title: "Recovery & behaviour", Component: RecoverySection },
  review: { title: "Coach review & next period", Component: ReviewSection },
};

export function ReportPreview({ model, notes }) {
  const included = model.includedSections;
  const detailKeys = included.filter((k) => k !== "summary");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <HeroSection model={model} notes={notes} />
      <CoreChartsStrip model={model} />
      {detailKeys.map((key, i) => {
        const def = DETAIL_SECTIONS[key];
        if (!def) return null;
        const { title, Component } = def;
        return (
          <Collapsible key={key} title={title} defaultOpen={i === 0}>
            <Component model={model} notes={notes} />
          </Collapsible>
        );
      })}
    </div>
  );
}
