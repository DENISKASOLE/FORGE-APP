// PDF export for the Progress Report (DECISIONS.md), built with pdf-lib -
// same convention as buildPdfDoc/buildWeeklyReportPDF, not the prototype's
// own window.print() approach (confirmed with Denis). A separate builder
// from both of those, for the same reason buildWeeklyReportPDF is already
// separate from buildPdfDoc: one page per report section, with grids and
// tables neither existing builder was written to share.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { renderBarChartPNG, renderSeriesChartPNG, dataUrlToBytes } from "./reportCharts.js";
import { REPORT_COLORS, REPORT_SECTION_LABELS } from "../features/progress-report/progressReportModel.js";

const PAGE = { width: 595.28, height: 841.89, margin: 40 };

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const INK = hexToRgb(REPORT_COLORS.ink), MUTED = hexToRgb(REPORT_COLORS.muted);

function short(iso) { return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""; }

async function makeDrawer(pdfDoc, font, bold) {
  const { width, height, margin } = PAGE;
  const maxWidth = width - margin * 2;
  let page = null, y = height - margin;

  function newPage(label) {
    page = pdfDoc.addPage([width, height]);
    y = height - margin;
    page.drawText("FORGE", { x: margin, y, size: 9, font: bold, color: MUTED });
    page.drawText(label, { x: width - margin - font.widthOfTextAtSize(label, 9), y, size: 9, font, color: MUTED });
    y -= 20;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.75, color: MUTED });
    y -= 18;
  }
  function wrap(text, f, size, w = maxWidth) {
    const words = String(text ?? "").split(" ");
    const lines = []; let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > w && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  function text(str, { size = 10.5, isBold = false, color = INK, gap = 6, indent = 0, w } = {}) {
    for (const l of wrap(str, isBold ? bold : font, size, w)) {
      if (y < margin + size) return;
      page.drawText(l, { x: margin + indent, y, size, font: isBold ? bold : font, color });
      y -= size + gap;
    }
  }
  function heading(str) { text(str, { size: 15, isBold: true, gap: 10 }); }
  function label(str) { text(str, { size: 9, isBold: true, color: MUTED, gap: 8 }); }
  function statTiles(tiles) {
    if (!tiles.length) return;
    const cols = Math.min(tiles.length, 3), gap = 10, w = (maxWidth - gap * (cols - 1)) / cols, h = 52;
    tiles.forEach((t, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = margin + col * (w + gap), ty = y - row * (h + 8);
      page.drawRectangle({ x, y: ty - h, width: w, height: h, color: rgb(0.949, 0.922, 0.875) });
      page.drawText(String(t.label), { x: x + 8, y: ty - 14, size: 8, font: bold, color: MUTED });
      page.drawText(String(t.value), { x: x + 8, y: ty - 32, size: 15, font: bold, color: INK });
      if (t.sub) page.drawText(String(t.sub).slice(0, 40), { x: x + 8, y: ty - 44, size: 7.5, font, color: MUTED });
    });
    const rows = Math.ceil(tiles.length / cols);
    y -= rows * (h + 8) + 6;
  }
  function table(columns, rows) {
    const colW = columns.map((c) => c.width || maxWidth / columns.length);
    let x = margin;
    columns.forEach((c, i) => { page.drawText(c.label, { x, y, size: 8, font: bold, color: MUTED }); x += colW[i]; });
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.75, color: MUTED });
    y -= 12;
    for (const row of rows) {
      if (y < margin + 14) { text(`+ ${rows.length - rows.indexOf(row)} more rows not shown`, { size: 8.5, color: MUTED }); break; }
      x = margin;
      columns.forEach((c, i) => { page.drawText(String(row[c.key] ?? ""), { x, y, size: 9, font, color: INK }); x += colW[i]; });
      y -= 14;
    }
    y -= 8;
  }
  async function chartImage(dataUrl, h = 140) {
    if (!dataUrl) return;
    const png = await pdfDoc.embedPng(dataUrlToBytes(dataUrl));
    if (y - h < margin) return;
    page.drawImage(png, { x: margin, y: y - h, width: maxWidth, height: h });
    y -= h + 10;
  }
  function footer(pageNum, total) {
    page.drawLine({ start: { x: margin, y: margin - 4 }, end: { x: width - margin, y: margin - 4 }, thickness: 0.5, color: MUTED });
    page.drawText(`Page ${pageNum} of ${total}`, { x: width - margin - 60, y: margin - 16, size: 8, font, color: MUTED });
  }
  return { newPage, text, heading, label, statTiles, table, chartImage, footer, get y() { return y; } };
}

function summaryPage(d, model, notes) {
  d.heading("Client Progress Report");
  d.text(`${model.client.name} · ${short(model.period.from)} - ${short(model.period.to)}`, { color: MUTED, gap: 14 });
  const tiles = [];
  const { body, training, nutrition } = model;
  if (body.weight.length) { const ch = body.weight[body.weight.length - 1].value - body.weight[0].value; tiles.push({ label: "Weight change", value: `${ch > 0 ? "+" : ""}${ch.toFixed(1)} kg`, sub: `${body.weight.length} readings` }); }
  if (training.planned) tiles.push({ label: "Sessions completed", value: `${training.completedCount}/${training.planned}`, sub: `${Math.round(training.completionRate * 100)}% of planned` });
  if (training.planned) tiles.push({ label: "Training volume", value: `${(training.totalVolume / 1000).toFixed(1)} t`, sub: `${training.sessions.length} workouts` });
  if (nutrition.totalDays) tiles.push({ label: "Nutrition logging", value: `${nutrition.loggedCount}/${nutrition.totalDays}`, sub: "days logged" });
  d.statTiles(tiles);
  d.label("PERIOD HIGHLIGHTS");
  model.wins.forEach((w, i) => d.text(`${i + 1}. ${notes.wins[i] ?? w.text}`, { size: 10, gap: 8 }));
  d.label("FROM YOUR COACH");
  d.text(notes.summary || "No summary written yet.", { size: 10.5, gap: 6 });
}
async function bodyPage(d, model) {
  d.heading("Body metrics");
  const chart = model.body.weight.length >= 2 ? renderSeriesChartPNG({
    width: 520, height: 160,
    yMin: Math.min(...model.body.weight.map((p) => p.value)) - 0.3, yMax: Math.max(...model.body.weight.map((p) => p.value)) + 0.3, yCount: 4,
    xCount: Math.max(model.body.weight.length, 2),
    series: [{ type: "dots", points: model.body.weight.map((p, i) => ({ i, v: p.value })), color: REPORT_COLORS.kcal }],
  }) : null;
  d.label("BODY WEIGHT");
  if (chart) await d.chartImage(chart); else d.text("Not enough weight readings in this period.", { color: MUTED });
  const latest = model.body.measurements.latest, prev = model.body.measurements.prev;
  d.label("MEASUREMENTS");
  if (latest) {
    const fields = Object.keys(latest).filter((k) => k !== "id" && k !== "date" && !isNaN(parseFloat(latest[k])));
    d.table([{ key: "f", label: "Site", width: 220 }, { key: "v", label: "Latest", width: 150 }, { key: "d", label: "vs previous", width: 150 }],
      fields.map((k) => ({ f: k, v: latest[k], d: prev?.[k] != null ? `${(latest[k] - prev[k]).toFixed(1)}` : "-" })));
  } else d.text("No measurements recorded this period.", { color: MUTED });
}
async function trainingPage(d, model) {
  d.heading("Training performance");
  d.statTiles([
    { label: "Planned", value: model.training.planned },
    { label: "Completed", value: model.training.completedCount, sub: `${Math.round(model.training.completionRate * 100)}%` },
    { label: "Missed", value: model.training.missed },
  ]);
  d.label("COMPLETED VOLUME PER WEEK");
  if (model.training.weeklyVolume.length) {
    const chart = renderBarChartPNG(model.training.weeklyVolume.map((w) => short(w.start)), model.training.weeklyVolume.map((w) => Math.round(w.volume / 100) / 10), { color: REPORT_COLORS.kcal, suffix: "t" });
    await d.chartImage(chart);
  } else d.text("No completed sessions with set data in this period.", { color: MUTED });
  const prog = model.training.progression.filter((p) => p.hasData);
  d.label("STRENGTH PROGRESSION");
  if (prog.length) {
    d.table([{ key: "n", label: "Exercise", width: 180 }, { key: "f", label: "First", width: 130 }, { key: "l", label: "Latest", width: 130 }, { key: "c", label: "Change", width: 80 }],
      prog.map((p) => ({ n: p.name, f: `${p.first.load}kg x ${p.first.reps}`, l: `${p.last.load}kg x ${p.last.reps}`, c: `${p.change > 0 ? "+" : ""}${p.change}kg` })));
  } else d.text("Not enough repeated sets to show progression.", { color: MUTED });
  d.label("PERSONAL BESTS");
  if (model.training.pbs.length) model.training.pbs.forEach((pb) => d.text(`${short(pb.date)} - ${pb.name}: ${pb.detail}`, { size: 9.5, gap: 6 }));
  else d.text("No personal bests set this period.", { color: MUTED });
}
async function nutritionPage(d, model) {
  d.heading("Nutrition performance");
  const { nutrition } = model;
  d.statTiles([
    { label: "Logging consistency", value: `${nutrition.loggedCount}/${nutrition.totalDays}` },
    { label: "Meal adherence", value: nutrition.adherence != null ? `${Math.round(nutrition.adherence * 100)}%` : "N/A" },
    { label: "Target attainment", value: nutrition.loggedCount ? `${nutrition.kcalWithinTarget}/${nutrition.loggedCount}` : "-" },
  ]);
  d.label("LOGGED CALORIES PER DAY");
  const logged = nutrition.days.filter((x) => x.has);
  if (logged.length) await d.chartImage(renderBarChartPNG(logged.map((x) => short(x.date)), logged.map((x) => x.totals.kcal), { color: REPORT_COLORS.kcal }));
  else d.text("No logged days in this period.", { color: MUTED });
}
async function heartPage(d, model) {
  d.heading("Heart rate & workout energy");
  d.label("WORKOUT HEART RATE");
  if (model.heart.hasHr) {
    const pts = model.heart.hr;
    const vals = pts.flatMap((p) => [p.avg, p.max]).filter((v) => v != null);
    await d.chartImage(renderSeriesChartPNG({
      width: 520, height: 150, yMin: Math.min(...vals) - 8, yMax: Math.max(...vals) + 6, xCount: Math.max(pts.length, 2),
      series: [{ type: "triangles", points: pts.filter((p) => p.max != null).map((p, i) => ({ i, v: p.max })), color: REPORT_COLORS.ink }, { type: "dots", points: pts.filter((p) => p.avg != null).map((p, i) => ({ i, v: p.avg })), color: REPORT_COLORS.kcal }],
    }));
  } else d.text("No heart-rate data logged for sessions this period.", { color: MUTED });
  d.label("ESTIMATED CALORIES BURNED");
  if (model.heart.hasKcal) d.table([{ key: "d", label: "Date", width: 200 }, { key: "k", label: "Est. kcal", width: 200 }], model.heart.kcal.map((k) => ({ d: short(k.date), k: k.value })));
  else d.text("Not recorded for sessions this period.", { color: MUTED });
}
async function recoveryPage(d, model) {
  d.heading("Recovery & behaviour");
  const { recovery } = model;
  d.label("SLEEP, HOURS");
  if (recovery.sleep.length >= 2) await d.chartImage(renderBarChartPNG(recovery.sleep.map((s) => short(s.date)), recovery.sleep.map((s) => s.value), { color: REPORT_COLORS.fat, suffix: "h" }), 110);
  else d.text("Not enough sleep entries this period.", { color: MUTED });
  d.label("STEPS");
  if (recovery.steps.length >= 2) await d.chartImage(renderBarChartPNG(recovery.steps.map((s) => short(s.date)), recovery.steps.map((s) => s.value), { color: REPORT_COLORS.muted }), 110);
  else d.text("Not enough step entries this period.", { color: MUTED });
  d.label("WEEKLY CHECK-INS");
  if (recovery.checkins.hasCheck) {
    d.table([{ key: "d", label: "Date", width: 150 }, { key: "e", label: "Energy", width: 120 }, { key: "s", label: "Soreness", width: 120 }, { key: "st", label: "Stress", width: 120 }],
      recovery.checkins.checks.map((c) => ({ d: short(c.date), e: c.energy ?? "-", s: c.soreness ?? "-", st: c.stress ?? "-" })));
  } else d.text("No matching check-in scale questions configured.", { color: MUTED });
}
function reviewPage(d, model, notes) {
  d.heading("Coach review & next period");
  d.text(notes.summary || "No summary written yet.", { size: 10.5, gap: 10 });
  d.label("TOP WINS");
  model.wins.forEach((w, i) => d.text(`${i + 1}. ${notes.wins[i] ?? w.text}`, { size: 10, gap: 7 }));
  d.label("MAIN CHALLENGE");
  d.text(notes.challenge || model.challenge, { size: 10, gap: 10 });
  d.label("PRIORITIES");
  notes.prios.filter((p) => p && p.trim()).forEach((p, i) => d.text(`${i + 1}. ${p}`, { size: 10.5, gap: 7 }));
  const goals = notes.goals.filter((g) => g[0] || g[1]);
  if (goals.length) { d.label("GOALS"); d.table([{ key: "g", label: "Goal", width: 220 }, { key: "m", label: "Measure and target", width: 280 }], goals.map((g) => ({ g: g[0] || "-", m: g[1] || "-" }))); }
  if (notes.reflOn && notes.refl?.trim()) { d.label("CLIENT REFLECTION"); d.text(`"${notes.refl}"`, { size: 10.5 }); }
}

const PAGE_BUILDERS = { summary: summaryPage, body: bodyPage, training: trainingPage, nutrition: nutritionPage, heart: heartPage, recovery: recoveryPage, review: reviewPage };

export async function buildProgressReportPDF(model, notes) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const d = await makeDrawer(pdfDoc, font, bold);
  const keys = model.includedSections;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    d.newPage(REPORT_SECTION_LABELS[key] || key);
    await PAGE_BUILDERS[key](d, model, notes);
    d.footer(i + 1, keys.length);
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
