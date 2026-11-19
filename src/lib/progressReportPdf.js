// Progress Report PDF (redesigned Nov 19 2026 - Denis: "the worst report
// ever designed... make it more meaningful to the client, think like an
// executive").
//
// Two pages, written for the client, not the coach:
//   Page 1 "Your month at a glance": headline verdict, a four-pillar
//          scorecard (training, nutrition, sleep, body weight) with a
//          plain status each, biggest wins, the coach's note and the three
//          things to focus on next.
//   Page 2 "The detail": sessions per week, strength changes and personal
//          bests, calories vs target, measurements, goals.
// Sections with no data are left out instead of printing "Not enough
// data" placeholders. Charts are drawn as vector shapes (crisp, no canvas).
// The story itself (headline, statuses, wins, priorities) comes from
// features/progress-report/reportInsights.js.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { REPORT_COLORS } from "../features/progress-report/progressReportModel.js";
import { buildInsights, niceName, shortDate, weeklySessions } from "../features/progress-report/reportInsights.js";

const W = 595.28, H = 841.89, M = 44, CW = W - M * 2;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const C = {
  ink: hex(REPORT_COLORS.ink), ink2: hex("#3D4F4C"), muted: hex("#6E7A77"), faint: hex("#A3ABA8"),
  teal: hex("#0E5E5A"), tealDeep: hex("#0A4744"), tealSoft: hex("#E3EFEC"), gold: hex("#F6C76B"),
  page: hex("#FFFFFF"), card: hex("#F6F2EB"), line: hex("#E7E1D7"), white: rgb(1, 1, 1),
  carbs: hex(REPORT_COLORS.carbs), green: hex("#3A9A68"),
};

const REPL = [[/[→⇒]/g, "->"], [/[←⇐]/g, "<-"], [/×/g, "x"], [/[‘’]/g, "'"], [/[“”]/g, '"'], [/[–—]/g, "-"], [/…/g, "..."], [/•/g, "-"]];
export function safe(str) {
  let s = String(str ?? "");
  for (const [re, r] of REPL) s = s.replace(re, r);
  return Array.from(s).map((ch) => (ch.codePointAt(0) <= 0xff ? ch : "?")).join("");
}

function makeKit(doc, f) {
  let page = null;
  const T = (txt, x, y, { size = 10, font = f.reg, color = C.ink, align = "left", w = 0 } = {}) => {
    const s = safe(txt);
    const tw = font.widthOfTextAtSize(s, size);
    const dx = align === "right" ? w - tw : align === "center" ? (w - tw) / 2 : 0;
    page.drawText(s, { x: x + dx, y, size, font, color });
    return tw;
  };
  const wrap = (txt, size, w, font = f.reg) => {
    const out = []; let line = "";
    for (const word of safe(txt).split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > w && line) { out.push(line); line = word; } else line = test;
    }
    if (line) out.push(line);
    return out;
  };
  const para = (txt, x, y, w, { size = 10, font = f.reg, color = C.ink, lh = 1.45, max = 99 } = {}) => {
    const lines = wrap(txt, size, w, font).slice(0, max);
    lines.forEach((l, i) => page.drawText(l, { x, y: y - i * size * lh, size, font, color }));
    return lines.length * size * lh;
  };
  const rect = (x, y, w, h, color, opts = {}) => page.drawRectangle({ x, y, width: w, height: h, color, ...opts });
  const round = (x, y, w, h, r, color) => {
    // pdf-lib has no rounded rect primitive; build one from an SVG path.
    const p = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    page.drawSvgPath(p, { x, y: y + h, color, borderWidth: 0 });
  };
  const line = (x1, y1, x2, y2, color = C.line, t = 0.75, dash) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: t, color, dashArray: dash });
  const dot = (x, y, r, color) => page.drawCircle({ x, y, size: r, color });
  return {
    newPage() { page = doc.addPage([W, H]); return page; },
    T, wrap, para, rect, round, line, dot, f,
  };
}

function footer(k, model, n, total) {
  const coach = model.trainerName && model.trainerName !== "Coach" ? `Coach ${model.trainerName}` : "your coach";
  k.line(M, 34, W - M, 34, C.line, 0.75);
  k.T(`Forge Performance  ·  Prepared by ${coach}  ·  ${shortDate(model.generatedAt)} ${new Date(`${model.generatedAt}T00:00:00`).getFullYear()}`, M, 20, { size: 8, color: C.muted });
  k.T(`${n} / ${total}`, M, 20, { size: 8, color: C.muted, align: "right", w: CW });
}
function sectionTitle(k, txt, y) {
  k.T(txt.toUpperCase(), M, y, { size: 9, font: k.f.bold, color: C.teal });
  return y - 16;
}

// ---------------- page 1 ----------------
function pageOne(k, model, ins, notes) {
  const { f } = k;
  // Header band
  k.rect(0, H - 168, W, 168, C.teal);
  k.rect(0, H - 168, W, 3, C.gold);
  k.T("FORGE PERFORMANCE", M, H - 48, { size: 9, font: f.bold, color: C.gold });
  k.T("Progress report", M, H - 48, { size: 9, color: C.white, align: "right", w: CW });
  k.T(niceName(model.client.name), M, H - 92, { size: 30, font: f.bold, color: C.white });
  k.T(`${ins.period}  ·  ${model.period.days} days`, M, H - 116, { size: 11, color: hex("#CFE3DF") });
  k.para(ins.headline, M, H - 146, CW, { size: 15, font: f.bold, color: C.white, max: 1 });

  let y = H - 200;
  // Coach note
  if (notes.summary?.trim()) {
    const lines = k.wrap(notes.summary.trim(), 10.5, CW - 28, f.ital).slice(0, 5);
    const h = 26 + lines.length * 15;
    k.round(M, y - h, CW, h, 10, C.card);
    k.rect(M, y - h, 3, h, C.gold);
    k.T("FROM YOUR COACH", M + 16, y - 16, { size: 8, font: f.bold, color: C.muted });
    lines.forEach((l, i) => k.T(l, M + 16, y - 32 - i * 15, { size: 10.5, font: f.ital, color: C.ink }));
    y -= h + 20;
  }

  // Scorecard
  y = sectionTitle(k, "How you did", y);
  const gap = 10, cw = (CW - gap) / 2, ch = 92;
  ins.pillars.forEach((p, i) => {
    const x = M + (i % 2) * (cw + gap), top = y - Math.floor(i / 2) * (ch + gap);
    k.round(x, top - ch, cw, ch, 10, C.card);
    k.T(p.title, x + 14, top - 20, { size: 10, font: f.bold, color: C.ink2 });
    // status pill
    const st = p.status, label = st.label, pw = f.bold.widthOfTextAtSize(label, 7.5) + 14;
    const col = p.neutral ? C.teal : hex(st.color);
    k.round(x + cw - 14 - pw, top - 25, pw, 14, 7, col);
    k.T(label, x + cw - 14 - pw, top - 21, { size: 7.5, font: f.bold, color: C.white, align: "center", w: pw });
    const vw = k.T(p.value, x + 14, top - 48, { size: 20, font: f.bold, color: C.ink });
    if (p.unit) k.T(p.unit, x + 14 + vw + 6, top - 48, { size: 9, color: C.muted });
    if (p.bar != null) {
      k.round(x + 14, top - 60, cw - 28, 5, 2.5, C.line);
      k.round(x + 14, top - 60, Math.max(5, (cw - 28) * Math.min(1, p.bar)), 5, 2.5, col);
    }
    k.para(p.line, x + 14, top - 76, cw - 28, { size: 8.5, color: C.muted, max: 2, lh: 1.3 });
  });
  y -= 2 * ch + gap + 26;

  // Wins
  if (ins.wins.length) {
    y = sectionTitle(k, "Your biggest wins", y);
    const n = ins.wins.length, wg = 10, ww = (CW - wg * (n - 1)) / n, wh = 76;
    ins.wins.forEach((w, i) => {
      const x = M + i * (ww + wg);
      k.round(x, y - wh, ww, wh, 10, C.tealSoft);
      k.T(w.big, x + 14, y - 32, { size: 22, font: f.bold, color: C.teal });
      k.T(w.title, x + 14, y - 50, { size: 9.5, font: f.bold, color: C.ink, w: ww - 28 });
      k.para(w.line, x + 14, y - 63, ww - 28, { size: 8.5, color: C.muted, max: 1 });
    });
    y -= wh + 26;
  }

  // Next steps
  y = sectionTitle(k, "Your focus for the next 4 weeks", y);
  ins.priorities.forEach((p, i) => {
    k.dot(M + 11, y - 6, 11, C.teal);
    k.T(String(i + 1), M, y - 10, { size: 11, font: f.bold, color: C.white, align: "center", w: 22 });
    k.T(p.title, M + 34, y - 4, { size: 11.5, font: f.bold, color: C.ink });
    const h = p.line ? k.para(p.line, M + 34, y - 19, CW - 34, { size: 9.5, color: C.muted, max: 2, lh: 1.35 }) : 0;
    y -= 28 + Math.max(0, h - 10);
  });
}

// ---------------- page 2 ----------------
function barChart(k, x, y, w, h, bars, { color, target, labelFmt = (v) => String(v), maxV } = {}) {
  const { f } = k;
  const top = Math.max(maxV || 0, target || 0, ...bars.map((b) => b.v), 1) * 1.12;
  const bw = Math.min(46, (w / bars.length) * 0.62), step = w / bars.length;
  k.line(x, y, x + w, y, C.line, 0.75);
  bars.forEach((b, i) => {
    const bh = (b.v / top) * h, bx = x + i * step + (step - bw) / 2;
    if (b.ghost) k.round(bx, y, bw, (b.ghost / top) * h, 4, C.line);
    if (bh > 0) k.round(bx, y, bw, Math.max(bh, 3), 4, b.color || color);
    if (b.v > 0 || b.ghost) k.T(labelFmt(b.v), bx - 10, y + Math.max(bh, b.ghost ? (b.ghost / top) * h : 0) + 4, { size: 7.5, font: f.bold, color: C.ink2, align: "center", w: bw + 20 });
    k.T(b.label, bx - 14, y - 12, { size: 7.5, color: C.muted, align: "center", w: bw + 28 });
  });
  if (target) {
    const ty = y + (target / top) * h;
    k.line(x, ty, x + w, ty, C.ink2, 0.8, [3, 3]);
    k.T(`Target ${Math.round(target).toLocaleString("en-GB")}`, x, ty + 4, { size: 7.5, color: C.ink2, align: "right", w });
  }
}

function pageTwo(k, model, notes) {
  const { f } = k;
  k.T("The detail", M, H - 64, { size: 22, font: f.bold, color: C.ink });
  k.T(`${niceName(model.client.name)}  ·  ${shortDate(model.period.from)} - ${shortDate(model.period.to)}`, M, H - 82, { size: 10, color: C.muted });
  let y = H - 116;

  // Training
  const t = model.training;
  const wk = weeklySessions(model);
  const perWeek = Math.max(1, Math.round((t.planned || 0) / Math.max(1, wk.length || Math.round(model.period.days / 7))));
  if (t.planned) {
    y = sectionTitle(k, "Training - sessions per week", y);
    barChart(k, M, y - 96, CW, 80, wk.map((w) => ({ label: `w/c ${shortDate(w.start)}`, v: w.done, ghost: perWeek, color: w.done >= perWeek ? C.green : C.teal })), { maxV: perWeek, labelFmt: (v) => `${v} / ${perWeek}` });
    k.T(`Grey = planned (${perWeek} a week)   Teal = done   Green = full week`, M, y - 124, { size: 7.5, color: C.muted });
    y -= 146;

    const prog = (t.progression || []).filter((p) => p.hasData && p.change !== 0).sort((a, b) => b.change - a.change).slice(0, 6);
    const pbs = t.pbs || [];
    if (prog.length || pbs.length) {
      y = sectionTitle(k, "Strength", y);
      const colX = [M, M + 250, M + 340, M + 430];
      ["Exercise", "Start", "Now", "Change"].forEach((h, i) => k.T(h, colX[i], y, { size: 8, font: f.bold, color: C.muted }));
      y -= 8; k.line(M, y, W - M, y); y -= 14;
      prog.forEach((p) => {
        k.T(niceName(p.name), colX[0], y, { size: 9.5, color: C.ink });
        k.T(`${p.first.load} kg x ${p.first.reps}`, colX[1], y, { size: 9.5, color: C.ink2 });
        k.T(`${p.last.load} kg x ${p.last.reps}`, colX[2], y, { size: 9.5, color: C.ink2 });
        k.T(`${p.change > 0 ? "+" : ""}${p.change} kg`, colX[3], y, { size: 9.5, font: f.bold, color: p.change > 0 ? C.green : hex("#C2412D") });
        y -= 17;
      });
      if (pbs.length) {
        y -= 4;
        k.T(`Personal bests (${pbs.length})`, M, y, { size: 9, font: f.bold, color: C.ink2 }); y -= 15;
        pbs.slice(0, 6).forEach((pb) => { k.dot(M + 3, y + 3, 2, C.gold); k.T(`${niceName(pb.name)}  -  ${pb.detail}  (${shortDate(pb.date)})`, M + 12, y, { size: 9, color: C.ink }); y -= 14; });
      }
      y -= 16;
    }
  }

  // Nutrition
  const n = model.nutrition;
  const logged = (n.days || []).filter((d) => d.has);
  if (logged.length) {
    const target = logged.map((d) => d.target?.kcal).filter(Boolean)[0] || 0;
    y = sectionTitle(k, "Nutrition - calories on the days you logged", y);
    const bars = logged.slice(-14).map((d) => {
      const v = Math.round(d.totals.kcal || 0);
      const within = target && Math.abs(v - target) <= target * 0.1;
      return { label: shortDate(d.date), v, color: within ? C.green : C.carbs };
    });
    barChart(k, M, y - 96, CW, 76, bars, { target, labelFmt: (v) => v.toLocaleString("en-GB") });
    y -= 120;
    const avgK = Math.round(logged.reduce((s, d) => s + (d.totals.kcal || 0), 0) / logged.length);
    const avgP = Math.round(logged.reduce((s, d) => s + (d.totals.protein || 0), 0) / logged.length);
    const tP = logged.map((d) => d.target?.protein).filter(Boolean)[0];
    k.T(`Average ${avgK.toLocaleString("en-GB")} kcal${target ? ` (target ${Math.round(target).toLocaleString("en-GB")})` : ""}   ·   protein ${avgP} g a day${tP ? ` (target ${Math.round(tP)} g)` : ""}   ·   green = within 10% of target`, M, y, { size: 8, color: C.muted });
    y -= 30;
  }

  // Measurements
  const m = model.body.measurements || {};
  const latest = m.latest, prev = m.prev;
  const fields = latest ? Object.keys(latest).filter((key) => !["id", "date", "weight"].includes(key) && !isNaN(parseFloat(latest[key]))) : [];
  if (fields.length && y > 160) {
    y = sectionTitle(k, "Measurements", y);
    fields.slice(0, 8).forEach((key, i) => {
      const x = M + (i % 4) * (CW / 4), yy = y - Math.floor(i / 4) * 42;
      k.T(niceName(key.replace(/([A-Z])/g, " $1")), x, yy, { size: 8, color: C.muted });
      k.T(`${latest[key]} cm`, x, yy - 15, { size: 13, font: f.bold, color: C.ink });
      if (prev?.[key] != null) { const d = latest[key] - prev[key]; k.T(`${d > 0 ? "+" : ""}${d.toFixed(1)}`, x + 62, yy - 15, { size: 9, font: f.bold, color: d < 0 ? C.green : C.muted }); }
    });
    y -= Math.ceil(Math.min(fields.length, 8) / 4) * 42 + 14;
  }

  // Goals + reflection
  const goals = (notes.goals || []).filter((g) => g[0] || g[1]);
  if (goals.length && y > 120) {
    y = sectionTitle(k, "Goals", y);
    goals.forEach((g) => { k.T(g[0] || "-", M, y, { size: 10, font: f.bold, color: C.ink }); k.T(g[1] || "", M + 200, y, { size: 10, color: C.ink2 }); y -= 17; });
    y -= 12;
  }
  if (notes.reflOn && notes.refl?.trim() && y > 100) {
    y = sectionTitle(k, "In your words", y);
    k.para(`"${notes.refl.trim()}"`, M, y, CW, { size: 10.5, font: f.ital, color: C.ink2, max: 4 });
  }
}

function hasDetail(model, notes) {
  return model.training.planned || (model.nutrition.days || []).some((d) => d.has) || model.body.measurements?.latest || (notes.goals || []).some((g) => g[0] || g[1]);
}

export async function buildProgressReportPDF(model, notes = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${model.client.name} - progress report`);
  const f = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    ital: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const k = makeKit(doc, f);
  const ins = buildInsights(model, notes);
  const total = hasDetail(model, notes) ? 2 : 1;
  k.newPage(); pageOne(k, model, ins, notes); footer(k, model, 1, total);
  if (total === 2) { k.newPage(); pageTwo(k, model, notes); footer(k, model, 2, total); }
  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
