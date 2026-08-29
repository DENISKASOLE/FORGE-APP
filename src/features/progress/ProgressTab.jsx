import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { useIsMobile, isTimedExercise } from "../../lib/browser.js";
import { isoDate } from "../../lib/dateUtils.js";
import { sessionForWorkout, sessionStatsV2, detectSessionPBs } from "../../lib/trainingLogs.js";
import { MEASUREMENT_FIELDS } from "../../lib/constants.js";
import { CheckInsTab } from "../checkin/CheckInsTab.jsx";
import { TransformPhotos } from "./TransformPhotos.jsx";

export function clampPercent(value, total) {
  const v = Number(value || 0);
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((v / t) * 100)));
}
function parseNumberFromText(value) {
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
function metricDisplay(entry, timed) {
  if (!entry) return "-";
  if (timed) return `${entry.value}s`;
  return `${entry.value}kg${entry.reps ? ` x ${entry.reps}` : ""}`;
}
export function ProgressRing({ label, value, total, unit = "", color = BRAND.green, size = 132 }) {
  const pct = clampPercent(value, total);
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: size + 56 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke={BRAND.card2} strokeWidth={stroke} fill="transparent" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="transparent" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, color: BRAND.text, letterSpacing: "-0.01em" }}>{value || 0}{unit}</div>
            <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 500 }}>/{total || 0}{unit}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, color: BRAND.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>{label}</div>
      <div style={{ color, fontWeight: 500, fontSize: 13, marginTop: 2 }}>{pct}%</div>
    </div>
  );
}

function sessionEntriesV2(logs) {
  const entries = [];
  (logs?.sessions || []).forEach((s) => {
    if (s.status !== "completed") return;
    (s.entries || []).forEach((e) => {
      const name = e.substitutedName || e.name;
      const timed = isTimedExercise(name);
      (e.sets || []).forEach((set, si) => {
        const value = timed ? parseNumberFromText(set.duration || set.reps) : Number(set.load || 0);
        if (!value) return;
        entries.push({ week: s.weekNum, date: s.date || "", exercise: name, timed, value, weight: set.load, reps: set.reps, duration: set.duration, rpe: set.rpe, set: si + 1 });
      });
    });
  });
  return entries;
}
function computePerformanceMetrics(logs) {
  const wanted = ["Dead Hang", "Plank", "Bench Press", "Squat", "Deadlift"];
  const aliases = {
    "Dead Hang": ["dead hang", "dead hung"], "Plank": ["plank"],
    "Bench Press": ["bench press", "flat barbell bench press", "barbell bench press"],
    "Squat": ["squat", "back squat", "barbell squat"], "Deadlift": ["deadlift", "barbell deadlift"],
  };
  const entries = sessionEntriesV2(logs);
  return wanted.map((name) => {
    const keys = aliases[name];
    const data = entries.filter((e) => keys.includes(e.exercise.toLowerCase()));
    const timed = ["Dead Hang", "Plank"].includes(name);
    const sorted = [...data].sort((a, b) => a.value - b.value);
    const best = sorted[sorted.length - 1];
    const recent = data[data.length - 1];
    const first = data[0];
    const trend = first && recent ? recent.value - first.value : 0;
    return { name, timed, best, recent, trend };
  });
}
export function recentPBsAcrossHistory(logs, limit = 5) {
  const completed = [...(logs?.sessions || [])].filter((s) => s.status === "completed" && s.date).sort((a, b) => a.date.localeCompare(b.date));
  const found = [];
  for (let i = 0; i < completed.length; i++) {
    const before = { ...logs, sessions: completed.slice(0, i) };
    const pbs = detectSessionPBs(completed[i], before);
    pbs.forEach((pb) => { if (!pb.detail.includes("first log")) found.push({ ...pb, date: completed[i].date }); });
  }
  return found.slice(-limit).reverse();
}
function currentStreakWeeks(logs) {
  const completed = (logs?.sessions || []).filter((s) => s.status === "completed" && s.date);
  if (!completed.length) return 0;
  const isoWeek = (dateStr) => {
    const d = new Date(dateStr);
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const diff = target - firstThursday;
    return `${target.getFullYear()}-W${1 + Math.round(diff / (7 * 24 * 3600 * 1000))}`;
  };
  const weeksWithSessions = new Set(completed.map((s) => isoWeek(s.date)));
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const wk = isoWeek(isoDate(cursor));
    if (weeksWithSessions.has(wk)) { streak += 1; cursor.setDate(cursor.getDate() - 7); }
    else break;
  }
  return streak;
}
function weightHistoryFromCheckins(checkIns) {
  const points = [];
  (checkIns || []).forEach((c) => {
    const ans = (c.answers || []).find((a) => /weight/i.test(a.question));
    const val = ans ? parseFloat(String(ans.answer).replace(/[^0-9.]/g, "")) : NaN;
    if (!isNaN(val) && val > 0) points.push({ date: c.date, value: val });
  });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
function WeightSparkline({ points, color = BRAND.green }) {
  const w = 300, h = 60, pad = 6;
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1][0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`;
  const last = coords[coords.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
    </svg>
  );
}
export function overallAdherence(program, logs) {
  if (!program?.weeks?.length) return { done: 0, total: 0, pct: 0 };
  let done = 0, total = 0;
  program.weeks.forEach((week) => {
    (week.workouts || []).forEach((wo) => {
      total += 1;
      if (sessionForWorkout(logs, week.id, wo.id)?.status === "completed") done += 1;
    });
  });
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
function weeklyVolumeTrend(logs, weeksBack = 4) {
  const completed = (logs?.sessions || []).filter((s) => s.status === "completed" && s.date);
  const now = new Date();
  const labels = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i * 7);
    labels.push(isoDate(d));
  }
  const volumes = Array(weeksBack).fill(0);
  completed.forEach((s) => {
    const d = new Date(s.date);
    let idx = -1;
    for (let i = 0; i < labels.length; i++) {
      const end = new Date(labels[i]);
      const start = new Date(end); start.setDate(start.getDate() - 6);
      if (d >= start && d <= end) idx = i;
    }
    if (idx < 0) return;
    idx >= 0 && (volumes[idx] += sessionStatsV2(s).volume);
  });
  return { labels, volumes };
}
function buildProgressInsight(streak, volumeTrend, pbs) {
  const parts = [];
  if (streak >= 2) parts.push(`${streak}-week streak${streak >= 4 ? ", your longest yet" : ""}`);
  const v = volumeTrend.volumes;
  if (v.length >= 2 && v[v.length - 2] > 0) {
    const change = Math.round(((v[v.length - 1] - v[v.length - 2]) / v[v.length - 2]) * 100);
    if (change >= 10) parts.push(`volume up ${change}% this week`);
  }
  if (parts.length === 0 && pbs.length > 0) parts.push(`new PB on ${pbs[0].name}`);
  if (parts.length === 0) return { text: "Keep logging sessions to start seeing trends here." };
  return { text: parts.join(" — ") };
}
export function ProgressTab({ client }) {
  const isMobile = useIsMobile(520);
  const logs = client.trainingLogs;
  const streak = currentStreakWeeks(logs);
  const volumeTrend = weeklyVolumeTrend(logs, 4);
  const pbs = recentPBsAcrossHistory(logs, 5);
  const adherence = overallAdherence(client.program, logs);
  const insight = buildProgressInsight(streak, volumeTrend, pbs);
  const maxVolume = Math.max(1, ...volumeTrend.volumes);
  const weightHistory = weightHistoryFromCheckins(client.checkIns);
  const latestWeight = weightHistory[weightHistory.length - 1]?.value ?? client.weight ?? null;
  const prevWeight = weightHistory.length >= 2 ? weightHistory[weightHistory.length - 2].value : null;
  const weightDelta = latestWeight != null && prevWeight != null ? +(latestWeight - prevWeight).toFixed(1) : null;
  const measurementEntries = MEASUREMENT_FIELDS.filter(([k]) => client.measurements?.[k]).slice(0, 3);

  return <div style={{ display: "grid", gap: 12, maxWidth: "100%", overflowX: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <div style={{ fontFamily: BRAND.sans, fontSize: 9, fontWeight: 400, color: BRAND.muted, letterSpacing: "0.1em", marginBottom: 4 }}>PROGRESS</div>
        <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 24 : 28, fontWeight: 800, letterSpacing: "-0.5px", color: BRAND.text }}>Progress</div>
      </div>
    </div>

    <div style={{ background: "color-mix(in srgb, var(--card) 70%, transparent)", backdropFilter: "blur(20px)", border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 20, overflow: "hidden" }}>
      <div style={{ padding: "15px 17px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: BRAND.sans, fontSize: 8, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Body Weight</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontFamily: BRAND.display, fontSize: 34, fontWeight: 800, color: BRAND.text, letterSpacing: "-1px" }}>{latestWeight != null ? latestWeight : "–"}</span>
              <span style={{ fontFamily: BRAND.sans, fontSize: 11, color: BRAND.muted }}>kg</span>
            </div>
            {weightDelta != null && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: weightDelta <= 0 ? BRAND.greenBg : "rgba(220,80,70,0.12)", border: `1px solid ${weightDelta <= 0 ? "rgba(102,199,155,0.2)" : "rgba(220,80,70,0.2)"}`, borderRadius: 100, padding: "3px 8px" }}>
                  <span style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 9, color: weightDelta <= 0 ? BRAND.green : BRAND.red }}>{weightDelta > 0 ? "+" : ""}{weightDelta} kg</span>
                </span>
                <span style={{ fontFamily: BRAND.sans, fontSize: 9, color: BRAND.muted }}>since last check-in</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 10px 12px" }}>
        {weightHistory.length >= 2 ? <WeightSparkline points={weightHistory} /> : (
          <div style={{ padding: "14px 4px 4px", fontFamily: BRAND.sans, fontSize: 11, color: BRAND.dim }}>Log your weight in weekly check-ins to see a trend here.</div>
        )}
      </div>
    </div>

    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ flex: 1, background: "rgba(242,133,61,0.08)", border: "1px solid rgba(242,133,61,0.15)", borderRadius: 14, padding: "11px 13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontFamily: BRAND.sans, fontSize: 8, color: BRAND.muted, letterSpacing: "0.1em", marginBottom: 4 }}>STREAK</div><div style={{ fontFamily: BRAND.display, fontWeight: 800, fontSize: 20, color: BRAND.gold }}>{streak} <span style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 10, color: BRAND.muted }}>wks</span></div></div>
      </div>
      <div style={{ flex: 1, background: BRAND.greenBg, border: "1px solid rgba(102,199,155,0.13)", borderRadius: 14, padding: "11px 13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontFamily: BRAND.sans, fontSize: 8, color: BRAND.muted, letterSpacing: "0.1em", marginBottom: 4 }}>ADHERENCE</div><div style={{ fontFamily: BRAND.display, fontWeight: 800, fontSize: 20, color: BRAND.green }}>{adherence.total ? `${adherence.pct}%` : "–"}</div></div>
      </div>
    </div>

    <div>
      <div style={{ fontFamily: BRAND.sans, fontSize: 8, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 7 }}>Personal Records</div>
      <div style={{ background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 16, padding: 14 }}>
        {pbs.length === 0 && <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13 }}>No PBs yet - complete a few sessions and they'll show up here.</div>}
        {pbs.slice(0, 3).map((pb, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i === 0 ? "none" : `${BRAND.hairline} solid ${BRAND.lineSoft}` }}>
            <span style={{ fontFamily: BRAND.sans, fontWeight: 500, fontSize: 11, color: BRAND.text }}>{pb.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 12, color: BRAND.gold }}>{pb.detail}</span>
              <span style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 9, color: BRAND.green }}>↑ new</span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {measurementEntries.length > 0 && (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <div style={{ fontFamily: BRAND.sans, fontSize: 8, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.14em", textTransform: "uppercase" }}>Measurements</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${measurementEntries.length}, minmax(0,1fr))`, gap: 8 }}>
          {measurementEntries.map(([key, label]) => (
            <div key={key} style={{ background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 10, padding: 9, textAlign: "center" }}>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 700, fontSize: 14, color: BRAND.text }}>{client.measurements[key]}</div>
              <div style={{ fontFamily: BRAND.sans, fontWeight: 400, fontSize: 8, color: BRAND.muted, marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    )}

    <div>
      <div style={{ fontFamily: BRAND.sans, fontSize: 8, fontWeight: 500, color: BRAND.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 7 }}>Weekly Training Volume</div>
      <div style={{ background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
          {volumeTrend.volumes.map((v, i) => {
            const isLast = i === volumeTrend.volumes.length - 1;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ width: "100%", height: Math.max(4, (v / maxVolume) * 56), background: isLast ? BRAND.gold : BRAND.card2, borderRadius: "3px 3px 0 0" }} />
                <div style={{ color: isLast ? BRAND.gold : BRAND.dim, fontSize: 9, fontWeight: 500 }}>W{i + 1}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    <div style={{ background: "rgba(242,133,61,0.06)", border: "1px solid rgba(242,133,61,0.14)", borderRadius: 16, padding: 14 }}>
      <div style={{ fontFamily: BRAND.sans, color: BRAND.text, fontWeight: 600, fontSize: 13 }}>{insight.text}</div>
      <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 11, fontWeight: 400, marginTop: 6, lineHeight: 1.6 }}>
        Past sessions live on the Program calendar — every completed day carries a tick, tap it to see exactly what was lifted, set by set.
      </div>
    </div>
  </div>;
}

export function ProgressHub({ client, updateClient, isCoach }) {
  const [sub, setSub] = useState("trends");
  const tabs = [["trends", "Trends"], ["photos", "Photos"], ["checkins", "Check-in"]];
  return <div style={{ display: "grid", gap: 14 }}>
    <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>{tabs.map(([k, l]) => <button key={k} onClick={() => setSub(k)} style={{ fontFamily: BRAND.sans, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", whiteSpace: "nowrap", padding: "9px 15px", borderRadius: 999, cursor: "pointer", color: sub === k ? BRAND.btnInk : BRAND.muted, background: sub === k ? BRAND.gold : BRAND.card2, border: `${BRAND.hairline} solid ${sub === k ? "transparent" : BRAND.line}` }}>{l}</button>)}</div>
    {sub === "trends" && <ProgressTab client={client} />}
    {sub === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
    {sub === "checkins" && <CheckInsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
  </div>;
}
