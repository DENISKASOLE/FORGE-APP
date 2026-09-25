import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { renderBarChartPNG, renderLineChartPNG, dataUrlToBytes } from "./reportCharts.js";
import { getSignedPhotoUrl } from "./storage.js";
import { mealTotals, dayTotals, buildGroceryList } from "../features/nutrition-plan/planMath.js";

const PDF_PAGE = { width: 595.28, height: 841.89, margin: 50 }; // A4, points

export async function buildPdfDoc(title, subtitle, sections) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height, margin } = PDF_PAGE;
  const maxWidth = width - margin * 2;
  let page = pdfDoc.addPage([width, height]);
  let y = height - margin;

  function ensureSpace(needed) {
    if (y - needed < margin) { page = pdfDoc.addPage([width, height]); y = height - margin; }
  }
  function wrap(text, f, size) {
    const words = String(text ?? "").split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  function drawText(text, { size = 10.5, bold = false, color = rgb(0.12, 0.12, 0.14), gap = 6, indent = 0 } = {}) {
    const f = bold ? boldFont : font;
    for (const l of wrap(text, f, size)) {
      ensureSpace(size + gap);
      page.drawText(l, { x: margin + indent, y, size, font: f, color });
      y -= size + gap;
    }
  }
  function rule() { ensureSpace(14); y -= 4; page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.75, color: rgb(0.82, 0.82, 0.85) }); y -= 12; }

  drawText(title, { size: 21, bold: true, gap: 4 });
  if (subtitle) drawText(subtitle, { size: 10.5, color: rgb(0.45, 0.45, 0.5), gap: 16 });
  rule();

  for (const sec of sections) {
    ensureSpace(28);
    drawText(sec.heading, { size: 13.5, bold: true, gap: 8, color: rgb(0.55, 0.43, 0.08) });
    for (const l of sec.lines || []) drawText(l.label ? `${l.label}: ${l.value ?? "-"}` : l, { size: 10, gap: 7, indent: 2 });
    for (const row of sec.table || []) {
      ensureSpace(13);
      const tagW = 26, nameW = 150;
      page.drawText(row[0] || "", { x: margin, y, size: 9.5, font: boldFont, color: rgb(0.55, 0.43, 0.08) });
      page.drawText(row[1] || "", { x: margin + tagW, y, size: 9.5, font: boldFont, color: rgb(0.12, 0.12, 0.14) });
      const rest = wrap(row.slice(2).filter(Boolean).join("  ·  "), font, 9);
      page.drawText(rest[0] || "", { x: margin + tagW + nameW, y, size: 9, font, color: rgb(0.35, 0.35, 0.4) });
      y -= 15;
    }
    y -= 12;
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
// A separate builder from buildPdfDoc rather than extending it - that one
// is text/table-only and already backs the Program PDF, and image support
// (embedding a chart) changes its page-break math enough that bolting it
// on risked regressing a feature this doesn't need to touch. Charts are
// rasterized to PNG via reportCharts.js (plain canvas - see that file for
// why) and embedded with pdf-lib's embedPng.
export async function buildWeeklyReportPDF(client, report) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height, margin } = PDF_PAGE;
  const maxWidth = width - margin * 2;
  let page = pdfDoc.addPage([width, height]);
  let y = height - margin;

  function ensureSpace(needed) {
    if (y - needed < margin) { page = pdfDoc.addPage([width, height]); y = height - margin; }
  }
  function text(str, { size = 10.5, bold = false, color = rgb(0.12, 0.12, 0.14), gap = 6, indent = 0 } = {}) {
    ensureSpace(size + gap);
    page.drawText(String(str ?? ""), { x: margin + indent, y, size, font: bold ? boldFont : font, color });
    y -= size + gap;
  }
  function rule() { ensureSpace(14); y -= 4; page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.75, color: rgb(0.82, 0.82, 0.85) }); y -= 12; }
  async function chart(heading, dataUrl, imgHeight = 150) {
    ensureSpace(28 + imgHeight);
    text(heading, { size: 12.5, bold: true, gap: 10, color: rgb(0.55, 0.43, 0.08) });
    const png = await pdfDoc.embedPng(dataUrlToBytes(dataUrl));
    const imgWidth = maxWidth;
    page.drawImage(png, { x: margin, y: y - imgHeight, width: imgWidth, height: imgHeight });
    y -= imgHeight + 16;
  }

  text(`${client.name || "Client"}'s Progress Report`, { size: 21, bold: true, gap: 4 });
  text(`${report.windowStart} to ${report.windowEnd}  ·  Generated ${report.generatedAt}`, { size: 10.5, color: rgb(0.45, 0.45, 0.5), gap: 16 });
  rule();

  // Headline numbers first - the "serious business" summary a coach can
  // read out loud before the client even sees a chart.
  text("At a glance", { size: 13.5, bold: true, gap: 10, color: rgb(0.55, 0.43, 0.08) });
  const headline = [
    `${report.totalSessions} sessions completed, ${report.totalVolume.toLocaleString()}kg total volume`,
    report.volumeTrendPct != null ? `Volume trend: ${report.volumeTrendPct > 0 ? "+" : ""}${report.volumeTrendPct}% vs the first half of this period` : null,
    report.weightChange != null ? `Bodyweight: ${report.weightChange > 0 ? "+" : ""}${report.weightChange}kg over the period` : null,
    report.pbs.length ? `${report.pbs.length} personal best${report.pbs.length === 1 ? "" : "s"} set this period` : null,
  ].filter(Boolean);
  headline.forEach((line) => text(`•  ${line}`, { size: 11, gap: 8 }));
  y -= 6;

  const weekLabels = report.weeks.map((w) => w.label);
  await chart("Training volume per week (kg)", renderBarChartPNG(weekLabels, report.weeks.map((w) => w.volume), { color: "#C9A24B" }));
  await chart("Sessions completed per week", renderBarChartPNG(weekLabels, report.weeks.map((w) => w.sessionsCompleted), { color: "#5B8FD6" }));
  await chart(
    report.macrosOnly ? "Macro tracking: days logged per week (of 7)" : "Nutrition: days logged per week (of 7)",
    renderBarChartPNG(weekLabels, report.weeks.map((w) => w.nutritionDaysLogged), { color: "#5FA37B" })
  );
  if (report.weightPoints.length >= 2) {
    await chart("Bodyweight trend (kg)", renderLineChartPNG(report.weightPoints.map((p) => p.date.slice(5)), report.weightPoints.map((p) => p.value), { color: "#9B7BE0" }));
  }

  const numericWeeks = report.weeks.filter((w) => w.hasNumericNutrition);
  if (numericWeeks.length) {
    ensureSpace(28);
    text("Average daily macros (tracked days)", { size: 12.5, bold: true, gap: 10, color: rgb(0.55, 0.43, 0.08) });
    numericWeeks.forEach((w) => text(`${w.label}: ${w.avgCalories}kcal · ${w.avgProtein}p / ${w.avgCarbs}c / ${w.avgFats}f`, { size: 10.5, gap: 7, indent: 2 }));
    y -= 6;
  }

  if (report.pbs.length) {
    ensureSpace(28);
    text("Personal bests this period", { size: 12.5, bold: true, gap: 10, color: rgb(0.55, 0.43, 0.08) });
    report.pbs.forEach((pb) => text(`${pb.date} — ${pb.name}: ${pb.detail}`, { size: 10.5, gap: 7, indent: 2 }));
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
// ==================== Nutrition plan PDF (NUTRITION_SPEC.md §7) ====================
// pdf-lib + StandardFonts, same as the builders above - not
// @react-pdf/renderer and not a bundled custom font (see
// docs/nutrition-recon.md), which also means no "ask Denis to approve a
// font" gate since no new font ships. Black background per the approved
// mockups (PdfPage1/2.dc.html). Content flows across as many pages as a
// plan needs rather than forcing exactly two - the spec itself says
// multi-day plans "just flow onto more pages."
const NP_PDF = {
  bg: rgb(0, 0, 0), card: rgb(0.051, 0.051, 0.051), card2: rgb(0.09, 0.09, 0.09),
  line: rgb(0.149, 0.149, 0.149), lineDashed: rgb(0.2, 0.2, 0.2),
  text: rgb(0.929, 0.929, 0.929), muted: rgb(0.631, 0.631, 0.631), dim: rgb(0.431, 0.431, 0.431),
  red: rgb(0.929, 0, 0.039),
  kcal: rgb(0.133, 0.827, 0.933), protein: rgb(0.239, 0.839, 0.549), carbs: rgb(1, 0.663, 0.302), fat: rgb(0.655, 0.545, 0.980),
};
const GROUP_COLOR = { PROTEIN: NP_PDF.protein, CARBS: NP_PDF.carbs, FRUIT: NP_PDF.muted, "VEG & OTHER": NP_PDF.muted };

export async function buildNutritionPlanPDF(client, signedPlan, options = {}) {
  const { guidelines = [], coachName = "Denis" } = options;
  const doc = signedPlan.doc;
  const pdfDoc = await PDFDocument.create();
  const baseFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height, margin } = PDF_PAGE;
  const maxWidth = width - margin * 2;
  const pages = [];
  let page, y;

  function newPage() {
    page = pdfDoc.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: NP_PDF.bg });
    y = height - margin;
    pages.push(page);
  }
  newPage();
  function ensureSpace(needed) { if (y - needed < margin + 20) newPage(); }
  function text(str, x, { size = 10, bold = false, color = NP_PDF.text } = {}) {
    page.drawText(String(str ?? ""), { x, y, size, font: bold ? boldFont : baseFont, color });
  }
  function lineAt(yPos, color = NP_PDF.line) { page.drawLine({ start: { x: margin, y: yPos }, end: { x: width - margin, y: yPos }, thickness: 0.75, color }); }
  function card(x, yTop, w, h, { dashed = false } = {}) {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: NP_PDF.card, borderColor: dashed ? NP_PDF.lineDashed : NP_PDF.line, borderWidth: 1 });
  }

  function header(compact = false) {
    text("FORGE", margin, { size: compact ? 13 : 16, bold: true, color: NP_PDF.text });
    if (!compact) text("PERFORMANCE", margin, { size: 8, bold: true, color: NP_PDF.red });
    const right = compact ? `${(client.name || "").toUpperCase()} · ${doc.goal || doc.name}` : "NUTRITION PLAN";
    const rw = boldFont.widthOfTextAtSize(right, 10);
    page.drawText(right, { x: width - margin - rw, y: y - (compact ? 0 : 4), size: compact ? 9 : 11, font: boldFont, color: compact ? NP_PDF.muted : NP_PDF.text });
    y -= compact ? 18 : 26;
    lineAt(y); y -= 20;
  }

  header(false);
  text("PREPARED FOR", margin, { size: 8, color: NP_PDF.dim });
  y -= 14;
  text((client.name || "Client").toUpperCase(), margin, { size: 26, bold: true });
  y -= 20;
  text(`${(doc.goal || doc.name).toUpperCase()} · FROM ${signedPlan.startDate}`, margin, { size: 10, color: NP_PDF.muted });
  const coachLabel = "COACH", coachLabelW = boldFont.widthOfTextAtSize(coachLabel, 8);
  page.drawText(coachLabel, { x: width - margin - Math.max(coachLabelW, boldFont.widthOfTextAtSize(coachName.toUpperCase(), 10)), y: y + 12, size: 8, font: boldFont, color: NP_PDF.dim });
  page.drawText(coachName.toUpperCase(), { x: width - margin - boldFont.widthOfTextAtSize(coachName.toUpperCase(), 10), y, size: 10, font: boldFont, color: NP_PDF.text });
  y -= 30;

  // 4 target tiles - uses the FIRST day's targets as the plan-level headline
  // figure (matches the mockup, which shows one set of targets up top even
  // though each day can differ - per-day totals still show per day below).
  const headlineTargets = doc.days[0]?.targets || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const tiles = [["CALORIES", Math.round(headlineTargets.kcal || 0), "", NP_PDF.kcal], ["PROTEIN", Math.round(headlineTargets.protein || 0), "G", NP_PDF.protein], ["CARBS", Math.round(headlineTargets.carbs || 0), "G", NP_PDF.carbs], ["FAT", Math.round(headlineTargets.fat || 0), "G", NP_PDF.fat]];
  const tileW = (maxWidth - 30) / 4;
  ensureSpace(70);
  tiles.forEach(([label, val, unit, color], i) => {
    const x = margin + i * (tileW + 10);
    card(x, y, tileW, 60);
    page.drawText(label, { x: x + 12, y: y - 20, size: 8, font: boldFont, color: NP_PDF.muted });
    page.drawText(`${val.toLocaleString()}${unit ? ` ${unit}` : ""}`, { x: x + 12, y: y - 40, size: 18, font: boldFont, color: NP_PDF.text });
    page.drawRectangle({ x: x + 12, y: y - 48, width: tileW - 24, height: 3, color });
  });
  y -= 78;

  doc.days.forEach((day) => {
    ensureSpace(50);
    const dt = dayTotals(day);
    text(`${day.name.toUpperCase()} · ${day.type.toUpperCase()} DAY`, margin, { size: 13, bold: true });
    const dtStr = `${Math.round(dt.kcal).toLocaleString()} KCAL · ${Math.round(dt.protein)}P · ${Math.round(dt.carbs)}C · ${Math.round(dt.fat)}F`;
    const dtW = baseFont.widthOfTextAtSize(dtStr, 9);
    page.drawText(dtStr, { x: width - margin - dtW, y, size: 9, color: NP_PDF.muted });
    y -= 22;

    (day.blocks || []).filter((b) => b.type === "meal").forEach((meal) => {
      const mt = mealTotals(meal);
      const rowH = 22 + meal.items.length * 15 + 10;
      ensureSpace(rowH + 6);
      const top = y;
      card(margin, top, maxWidth, rowH);
      page.drawRectangle({ x: margin, y: top - 22, width: maxWidth, height: 22, color: NP_PDF.card2 });
      page.drawText(meal.time, { x: margin + 12, y: top - 15, size: 9, color: NP_PDF.muted });
      page.drawText(meal.name.toUpperCase(), { x: margin + 60, y: top - 15, size: 10, font: boldFont, color: NP_PDF.text });
      const mtStr = `${Math.round(mt.kcal)} KCAL · ${Math.round(mt.protein)}P · ${Math.round(mt.carbs)}C · ${Math.round(mt.fat)}F`;
      const mtW = baseFont.widthOfTextAtSize(mtStr, 8.5);
      page.drawText(mtStr, { x: margin + maxWidth - 12 - mtW, y: top - 15, size: 8.5, color: NP_PDF.muted });
      let ry = top - 22 - 14;
      meal.items.forEach((it) => {
        const label = it.swaps.length > 0 ? `${it.food.name} · swaps on next page` : it.food.name;
        page.drawText(label, { x: margin + 70, y: ry, size: 9.5, color: NP_PDF.text });
        const amt = `${it.amount}${it.food.unit === "piece" ? "" : it.food.unit}`;
        const amtW = baseFont.widthOfTextAtSize(amt, 9.5);
        page.drawText(amt, { x: margin + maxWidth - 12 - amtW, y: ry, size: 9.5, color: NP_PDF.muted });
        ry -= 15;
      });
      y = top - rowH - 10;
    });

    if (day === doc.days[doc.days.length - 1] && signedPlan.coachNote) {
      ensureSpace(50);
      const lines = wrapPlain(signedPlan.coachNote, baseFont, 10.5, maxWidth - 36);
      const h = 34 + lines.length * 15;
      page.drawRectangle({ x: margin, y: y - h, width: maxWidth, height: h, borderColor: NP_PDF.text, borderWidth: 1 });
      page.drawText("FROM YOUR COACH", { x: margin + 16, y: y - 18, size: 8, font: boldFont, color: NP_PDF.muted });
      let ny = y - 34;
      lines.forEach((l) => { page.drawText(l, { x: margin + 16, y: ny, size: 10.5, color: NP_PDF.text }); ny -= 15; });
      y -= h + 12;
    }
  });

  // Flexible swaps table (one row per category present)
  const swapRows = new Map(); // category -> [{name, amount, unit}] incl. original as first entry
  doc.days.forEach((day) => (day.blocks || []).filter((b) => b.type === "meal").forEach((meal) => meal.items.forEach((it) => {
    if (!it.swaps.length) return;
    const cat = it.food.category.toUpperCase();
    if (!swapRows.has(cat)) swapRows.set(cat, []);
    swapRows.get(cat).push([{ name: it.food.name, amount: it.amount, unit: it.food.unit }, ...it.swaps.map((s) => ({ name: s.food.name, amount: s.amount, unit: s.food.unit }))]);
  })));
  if (swapRows.size > 0) {
    ensureSpace(40);
    text("FLEXIBLE SWAPS", margin, { size: 13, bold: true });
    y -= 20;
    [...swapRows.entries()].forEach(([cat, rows]) => {
      rows.forEach((options) => {
        ensureSpace(34);
        const top = y;
        card(margin, top, maxWidth, 30);
        page.drawText(cat, { x: margin + 12, y: top - 18, size: 8, font: boldFont, color: GROUP_COLOR[cat] || NP_PDF.text });
        const colW = (maxWidth - 100) / Math.max(1, options.length - 1 + 1);
        options.slice(0, 5).forEach((o, i) => {
          const x = margin + 100 + i * colW;
          page.drawText(o.name, { x, y: top - 12, size: 9, color: NP_PDF.text });
          page.drawText(`${o.amount}${o.unit === "piece" ? "" : o.unit}`, { x, y: top - 24, size: 8.5, color: NP_PDF.muted });
        });
        y -= 36;
      });
    });
    y -= 6;
  }

  // Hydration & supplements + Guidelines, side by side
  const hydrationBlock = doc.days.flatMap((d) => d.blocks || []).find((b) => b.type === "hydration");
  const supplementBlock = doc.days.flatMap((d) => d.blocks || []).find((b) => b.type === "supplement");
  if (hydrationBlock || supplementBlock || (doc.settings.showGuidelines && guidelines.length)) {
    const colW = (maxWidth - 12) / 2;
    const leftLines = [];
    if (hydrationBlock) leftLines.push(`Water — ${hydrationBlock.litres}L${hydrationBlock.trainingExtraLitres ? ` · +${hydrationBlock.trainingExtraLitres}L training` : ""}`);
    (supplementBlock?.items || []).forEach((s) => leftLines.push(`${s.name} — ${s.dose}${s.timing ? ` · ${s.timing}` : ""}`));
    const rightLines = doc.settings.showGuidelines ? guidelines : [];
    const rows = Math.max(leftLines.length, rightLines.length, 1);
    const h = 40 + rows * 16;
    ensureSpace(h + 10);
    const top = y;
    if (leftLines.length) {
      card(margin, top, colW, h);
      page.drawText("HYDRATION & SUPPLEMENTS", { x: margin + 14, y: top - 20, size: 9, font: boldFont, color: NP_PDF.text });
      let ly = top - 38;
      leftLines.forEach((l) => { page.drawText(l, { x: margin + 14, y: ly, size: 9.5, color: NP_PDF.text }); ly -= 15; });
    }
    if (rightLines.length) {
      card(margin + colW + 12, top, colW, h);
      page.drawText("GUIDELINES", { x: margin + colW + 12 + 14, y: top - 20, size: 9, font: boldFont, color: NP_PDF.text });
      let gy = top - 38;
      rightLines.forEach((g, i) => { page.drawText(`${i + 1}. ${g}`, { x: margin + colW + 12 + 14, y: gy, size: 9, color: NP_PDF.text }); gy -= 15; });
    }
    y -= h + 14;
  }

  // Grocery list, 3 columns (§4.5 grouping)
  if (doc.settings.showGrocery) {
    const groups = buildGroceryList(doc.days, signedPlan.schedule);
    ensureSpace(40);
    text("GROCERY LIST", margin, { size: 13, bold: true });
    y -= 20;
    const gColW = (maxWidth - 24) / 3;
    const maxRows = Math.max(...Object.values(groups).map((g) => g.length), 1);
    const h = 32 + maxRows * 15;
    ensureSpace(h);
    const top = y;
    Object.entries(groups).forEach(([label, items], i) => {
      const x = margin + i * (gColW + 12);
      card(x, top, gColW, h);
      page.drawText(label, { x: x + 12, y: top - 20, size: 8, font: boldFont, color: GROUP_COLOR[label] || NP_PDF.text });
      let iy = top - 36;
      items.forEach((it) => {
        page.drawText(it.label, { x: x + 12, y: iy, size: 9, color: NP_PDF.text });
        const dw = baseFont.widthOfTextAtSize(String(it.display), 8.5);
        page.drawText(String(it.display), { x: x + gColW - 12 - dw, y: iy, size: 8.5, color: NP_PDF.muted });
        iy -= 15;
      });
    });
    y -= h + 14;
  }

  // Starting point - the client's most recent check-in photo if there is
  // one, else the same dashed placeholder the spec uses for "missing".
  // Real check-ins store one photo, not separate front/side/back poses
  // (see docs/nutrition-recon.md), so this shows what's actually there
  // rather than inventing a 3-pose layout with no real data behind it.
  ensureSpace(210);
  text("STARTING POINT", margin, { size: 13, bold: true });
  y -= 20;
  const firstPhoto = [...(client.transformPhotos || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
  const boxH = 190;
  if (firstPhoto) {
    try {
      const url = await getSignedPhotoUrl(firstPhoto.image);
      const bytes = await (await fetch(url)).arrayBuffer();
      const img = firstPhoto.image.toLowerCase().endsWith(".png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const boxW = 160;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      card(margin, y, boxW, boxH);
      page.drawImage(img, { x: margin + (boxW - iw) / 2, y: y - boxH + (boxH - ih) / 2, width: iw, height: ih });
    } catch {
      card(margin, y, 160, boxH, { dashed: true });
      page.drawText("PROGRESS", { x: margin + 12, y: y - boxH + 14, size: 8, color: NP_PDF.dim });
    }
  } else {
    ["FRONT", "SIDE", "BACK"].forEach((label, i) => {
      const boxW = (maxWidth - 24) / 3;
      const x = margin + i * (boxW + 12);
      card(x, y, boxW, boxH, { dashed: true });
      page.drawText(label, { x: x + 12, y: y - boxH + 14, size: 8, color: NP_PDF.dim });
    });
  }
  y -= boxH + 14;

  // Footer on every page, drawn last so page numbers are known.
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: margin, y: margin - 6 }, end: { x: width - margin, y: margin - 6 }, thickness: 0.75, color: NP_PDF.line });
    p.drawText("THE FORGE METHOD · +971 567 088 638", { x: margin, y: margin - 20, size: 7.5, font: baseFont, color: NP_PDF.dim });
    const pageLabel = `${i + 1} / ${pages.length}`;
    const plw = baseFont.widthOfTextAtSize(pageLabel, 7.5);
    p.drawText(pageLabel, { x: width - margin - plw, y: margin - 20, size: 7.5, font: baseFont, color: NP_PDF.dim });
  });

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

function wrapPlain(text, font, size, maxWidth) {
  const words = String(text ?? "").split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export async function sharePdfBlob(blob, filename, shareTitle) {
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: shareTitle });
      return "shared";
    }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled"; // user closed the share sheet - not an error
  }
  downloadBlob(blob, filename);
  return "downloaded";
}
export function safeFilename(name) { return String(name || "file").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60); }
