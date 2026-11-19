// Client-facing story for the Progress Report (Nov 19 2026 redesign).
//
// The old report was seven pages of raw tables ("34.8 t", "Target
// attainment 5/12", "No matching check-in scale questions configured")
// that never told the client how they were doing or what to do next.
// This turns the report model (progressReportMath.buildReportModel) into
// the three answers a client actually wants:
//   1. How did I do?        -> headline + four-pillar scorecard
//   2. What went well?       -> up to three wins, in plain words
//   3. What do I do next?    -> up to three specific priorities
// Everything here is plain data so it can be tested and shared by the PDF
// and the on-screen preview. The coach can override the headline and
// priorities in the report builder.

export const STATUS = {
  good: { key: "good", label: "On track", color: "#3A9A68" },
  mid: { key: "mid", label: "Building", color: "#C98A1E" },
  low: { key: "low", label: "Needs focus", color: "#C2412D" },
  none: { key: "none", label: "No data", color: "#8A938F" },
};
const SLEEP_GOAL = 7;

// "V-SQUAT QUADS FOCUS" -> "V-Squat Quads Focus"; keeps short all-caps
// tokens like "DB" and "RDL" as they are.
export function niceName(name = "") {
  return String(name).trim().split(/\s+/).map((w) => {
    if (/\d/.test(w) || /^(DB|BB|KB|EZ|RDL|TRX|SL|SA|1A|DL)$/.test(w.toUpperCase())) return w.toUpperCase();
    return w.split("-").map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p)).join("-");
  }).join(" ");
}
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (a, b) => (b ? a / b : 0);
const rate = (r, hi, lo) => (r >= hi ? STATUS.good : r >= lo ? STATUS.mid : STATUS.low);
const fmt1 = (n) => (Math.round(n * 10) / 10).toString();

export function trainingPillar(t) {
  const due = (t.completedCount || 0) + (t.missed || 0);
  if (!due) return { key: "training", title: "Training", status: STATUS.none, value: "-", line: "No sessions were due in this period.", bar: null };
  const r = pct(t.completedCount, due);
  return {
    key: "training", title: "Training", status: rate(r, 0.8, 0.5),
    value: `${t.completedCount} of ${due}`, unit: "sessions",
    line: r >= 0.8 ? "Great consistency - this is what drives results." : `${due - t.completedCount} planned ${due - t.completedCount === 1 ? "session was" : "sessions were"} missed.`,
    bar: r,
  };
}
export function nutritionPillar(n) {
  if (!n.totalDays) return { key: "nutrition", title: "Nutrition", status: STATUS.none, value: "-", line: "No nutrition plan in this period.", bar: null };
  const r = pct(n.loggedCount, n.totalDays);
  const onTarget = n.kcalWithinTarget || 0;
  return {
    key: "nutrition", title: "Nutrition", status: rate(r, 0.8, 0.5),
    value: `${n.loggedCount} of ${n.totalDays}`, unit: "days logged",
    line: n.loggedCount ? `Calories on target on ${onTarget} of the ${n.loggedCount} days you logged.` : "No food was logged this period.",
    bar: r,
  };
}
export function recoveryPillar(rec) {
  const sleep = (rec.sleep || []).map((s) => Number(s.value)).filter((v) => v > 0);
  if (sleep.length < 2) return { key: "recovery", title: "Sleep", status: STATUS.none, value: "-", line: "Log your sleep so we can see how you recover.", bar: null };
  const a = avg(sleep);
  return {
    key: "recovery", title: "Sleep", status: a >= SLEEP_GOAL ? STATUS.good : a >= 6 ? STATUS.mid : STATUS.low,
    value: `${fmt1(a)} h`, unit: "average a night",
    line: a >= SLEEP_GOAL ? "Good recovery - keep protecting your sleep." : `${fmt1(SLEEP_GOAL - a)} h short of the 7 h your body needs to recover.`,
    bar: Math.min(1, a / 8),
  };
}
export function bodyPillar(body) {
  const w = body.weight || [];
  if (w.length >= 2) {
    const ch = w[w.length - 1].value - w[0].value;
    return {
      key: "body", title: "Body weight", status: STATUS.good, neutral: true,
      value: `${fmt1(w[w.length - 1].value)} kg`, unit: "",
      line: `${ch === 0 ? "No change" : `${ch > 0 ? "+" : ""}${fmt1(ch)} kg`} since ${shortDate(w[0].date)} (${w.length} weigh-ins).`,
      bar: null,
    };
  }
  const latest = body.measurements?.latest?.weight ?? (w[0]?.value ?? null);
  return {
    key: "body", title: "Body weight", status: STATUS.none,
    value: latest != null ? `${fmt1(Number(latest))} kg` : "-", unit: "",
    line: "Weigh in weekly so we can see your trend.",
    bar: null,
  };
}
export function shortDate(iso) {
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
}
export function periodLabel(from, to) {
  const f = new Date(`${from}T00:00:00`), t = new Date(`${to}T00:00:00`);
  const sameYear = f.getFullYear() === t.getFullYear();
  return `${f.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })} - ${t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

// Up to three wins, biggest first. Each has a big number and a sentence.
export function winsFor(model) {
  const out = [];
  const gains = (model.training.progression || []).filter((p) => p.hasData && p.change > 0).sort((a, b) => b.change - a.change);
  gains.slice(0, 2).forEach((p) => out.push({
    big: `+${fmt1(p.change)} kg`, title: niceName(p.name),
    line: `from ${p.first.load} kg to ${p.last.load} kg`,
  }));
  const pbs = model.training.pbs || [];
  if (pbs.length) out.push({ big: String(pbs.length), title: pbs.length === 1 ? "Personal best" : "Personal bests", line: niceName(pbs[0].name) + (pbs.length > 1 ? ` and ${pbs.length - 1} more` : "") });
  const t = trainingPillar(model.training);
  if (t.bar != null && t.bar >= 0.85) out.unshift({ big: `${Math.round(t.bar * 100)}%`, title: "Sessions completed", line: `${t.value} planned sessions` });
  const m = model.body.measurements || {};
  if (m.latest?.waist != null && m.prev?.waist != null && m.latest.waist < m.prev.waist) out.push({ big: `${fmt1(m.latest.waist - m.prev.waist)} cm`, title: "Waist", line: `since ${shortDate(m.prev.date)}` });
  const n = model.nutrition;
  if (n.totalDays && n.loggedCount / n.totalDays >= 0.8) out.push({ big: `${n.loggedCount}/${n.totalDays}`, title: "Days of food logged", line: "Excellent tracking" });
  return out.slice(0, 3);
}

// What to do next: the coach's own priorities if written, otherwise the
// weakest pillars turned into one specific action each.
export function prioritiesFor(model, notes = {}) {
  const typed = (notes.prios || []).map((p) => (p || "").trim()).filter(Boolean);
  if (typed.length) return typed.slice(0, 3).map((p) => ({ title: p, line: "" }));
  const out = [];
  const t = trainingPillar(model.training), n = nutritionPillar(model.nutrition), r = recoveryPillar(model.recovery), b = bodyPillar(model.body);
  const weeks = Math.max(1, Math.round((model.period.days || 28) / 7));
  const perWeek = Math.max(1, Math.round((model.training.planned || 0) / weeks));
  const rank = { low: 0, mid: 1, none: 2, good: 3 };
  const cand = [];
  if (t.status.key !== "good" && t.bar != null) cand.push({ s: t.status.key, title: `Train ${perWeek} times a week, every week`, line: `You completed ${t.value} sessions. Book them in like meetings.` });
  if (n.status.key !== "good" && n.bar != null) cand.push({ s: n.status.key, title: "Log your food every day", line: `${n.value} days logged. Even a quick photo helps - we can only coach what we can see.` });
  if (r.status.key === "low" || r.status.key === "mid") cand.push({ s: r.status.key, title: "Get 7 or more hours of sleep", line: `You averaged ${r.value}. Same bedtime every night, phone out of the bedroom.` });
  if (b.status.key === "none") cand.push({ s: "none", title: "Weigh in once a week", line: "Same day, first thing in the morning, after the bathroom." });
  cand.sort((a, c) => rank[a.s] - rank[c.s]).forEach((c) => out.push({ title: c.title, line: c.line }));
  if (!out.length) out.push({ title: "Keep doing exactly what you're doing", line: "Every pillar is on track - we'll raise the targets next block." });
  return out.slice(0, 3);
}

export function headlineFor(model, notes = {}) {
  if ((notes.headline || "").trim()) return notes.headline.trim();
  const t = trainingPillar(model.training), n = nutritionPillar(model.nutrition);
  const gains = (model.training.progression || []).some((p) => p.hasData && p.change > 0) || (model.training.pbs || []).length > 0;
  const pills = [t, n, recoveryPillar(model.recovery)].filter((p) => p.status.key !== "none");
  if (pills.length && pills.every((p) => p.status.key === "good")) return "An excellent month. You're on track.";
  if (gains && (t.status.key === "low" || n.status.key === "low")) return "You're getting stronger. Showing up more often is the next step.";
  if (gains) return "Real strength gains this month. Let's build on them.";
  if (t.status.key === "low") return "This month was about getting back on track.";
  return "Steady progress. Here's how to speed it up.";
}

// Sessions done vs due, per calendar week of the period (for the chart).
export function weeklySessions(model) {
  const weeks = model.training.weeklyVolume || [];
  const done = new Map();
  (model.training.sessions || []).forEach((s) => {
    const wk = weeks.find((w, i) => s.date >= w.start && (i === weeks.length - 1 || s.date < weeks[i + 1].start));
    if (wk) done.set(wk.start, (done.get(wk.start) || 0) + 1);
  });
  return weeks.map((w) => ({ start: w.start, done: done.get(w.start) || 0 }));
}

export function buildInsights(model, notes = {}) {
  return {
    headline: headlineFor(model, notes),
    pillars: [trainingPillar(model.training), nutritionPillar(model.nutrition), recoveryPillar(model.recovery), bodyPillar(model.body)],
    wins: winsFor(model),
    priorities: prioritiesFor(model, notes),
    period: periodLabel(model.period.from, model.period.to),
  };
}
