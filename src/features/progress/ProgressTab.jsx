import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { useIsMobile, isTimedExercise } from "../../lib/browser.js";
import { isoDate } from "../../lib/dateUtils.js";
import { sessionForWorkout, sessionStatsV2, detectSessionPBs } from "../../lib/trainingLogs.js";
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
export function ProgressRing({ label, value, total, unit = "", color = BRAND.gold, size = 132 }) {
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
            <div style={{ fontSize: 26, fontWeight: 800, color: BRAND.text, letterSpacing: -0.5 }}>{value || 0}{unit}</div>
            <div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 600 }}>/{total || 0}{unit}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, color: BRAND.muted, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
      <div style={{ color, fontWeight: 700, fontSize: 13, marginTop: 2 }}>{pct}%</div>
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
  const pbsThisMonth = pbs.filter((pb) => pb.date && pb.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;

  return <div style={{ display: "grid", gap: 14, maxWidth: "100%", overflowX: "hidden" }}>
    <div style={{ fontSize: isMobile ? 26 : 30, fontWeight: 800, letterSpacing: -0.4 }}>Progress</div>

    <div style={{ background: `${BRAND.gold}14`, border: `1px solid ${BRAND.gold}44`, borderRadius: 20, padding: 16 }}>
      <div style={{ color: BRAND.text, fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{insight.text}</div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
      <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: "14px 8px", textAlign: "center", overflow: "hidden" }}><div style={{ color: adherence.total ? BRAND.green : BRAND.dim, fontSize: 22, fontWeight: 900 }}>{adherence.total ? `${adherence.pct}%` : "-"}</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>Adherence</div></div>
      <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: "14px 8px", textAlign: "center", overflow: "hidden" }}><div style={{ color: BRAND.gold, fontSize: 22, fontWeight: 900 }}>{streak}</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>Wk Streak</div></div>
      <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: "14px 8px", textAlign: "center", overflow: "hidden" }}><div style={{ color: BRAND.cyan, fontSize: 22, fontWeight: 900 }}>{pbsThisMonth}</div><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginTop: 4 }}>PBs / mo</div></div>
    </div>

    <div>
      <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>Recent Personal Bests</div>
      <Card style={{ padding: 16 }}>
        {pbs.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13 }}>No PBs yet - complete a few sessions and they'll show up here.</div>}
        {pbs.slice(0, 3).map((pb, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: i === 0 ? "none" : `1px solid ${BRAND.card2}` }}>
            <div><div style={{ color: BRAND.text, fontWeight: 700, fontSize: 14 }}>{pb.name}</div><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{pb.detail} &middot; {pb.date}</div></div>
            <span style={{ background: `${BRAND.green}18`, color: BRAND.green, fontWeight: 800, fontSize: 10, padding: "4px 9px", borderRadius: 999 }}>NEW PB</span>
          </div>
        ))}
      </Card>
    </div>

    <div>
      <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>Weekly Volume</div>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
          {volumeTrend.volumes.map((v, i) => {
            const isLast = i === volumeTrend.volumes.length - 1;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ width: "100%", height: Math.max(4, (v / maxVolume) * 56), background: isLast ? BRAND.gold : BRAND.card2, borderRadius: "3px 3px 0 0" }} />
                <div style={{ color: isLast ? BRAND.gold : BRAND.dim, fontSize: 9, fontWeight: 700 }}>W{i + 1}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>

    <Card style={{ background: BRAND.card2, padding: 14 }}>
      <div style={{ color: BRAND.text, fontWeight: 800, fontSize: 13 }}>Looking for past sessions?</div>
      <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 600, marginTop: 4, lineHeight: 1.5 }}>
        They live on the Program calendar now. Every completed day carries a tick — tap it to see exactly what was lifted, set by set.
      </div>
    </Card>
  </div>;
}

export function ProgressHub({ client, updateClient, isCoach }) {
  const [sub, setSub] = useState("trends");
  const tabs = [["trends", "Trends"], ["photos", "Photos"], ["checkins", "Check-in"]];
  return <div style={{ display: "grid", gap: 14 }}>
    <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>{tabs.map(([k, l]) => <button key={k} onClick={() => setSub(k)} style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", padding: "9px 15px", borderRadius: 999, cursor: "pointer", color: sub === k ? "#000" : BRAND.muted, background: sub === k ? BRAND.gold : BRAND.card2, border: `1px solid ${sub === k ? BRAND.gold : BRAND.line}` }}>{l}</button>)}</div>
    {sub === "trends" && <ProgressTab client={client} />}
    {sub === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
    {sub === "checkins" && <CheckInsTab client={client} updateClient={updateClient} isCoach={isCoach} />}
  </div>;
}
