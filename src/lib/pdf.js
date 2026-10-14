import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { renderBarChartPNG, renderLineChartPNG, dataUrlToBytes } from "./reportCharts.js";

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
