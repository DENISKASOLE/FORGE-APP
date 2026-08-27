import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SCREENING_TITLE, SCREENING_QUESTIONS, CLEARANCE_ADVISORY, CONSENT_ITEMS } from "./screeningText.js";

const PAGE = { width: 595.28, height: 841.89, margin: 50 }; // A4, points

export async function buildScreeningPdf({ signedName, signaturePngBytes, screeningVersion, signedAt, answers, needsClearance, consents }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height, margin } = PAGE;
  const maxWidth = width - margin * 2;
  let page = pdfDoc.addPage([width, height]);
  let y = height - margin;

  function ensureSpace(needed) {
    if (y - needed < margin) { page = pdfDoc.addPage([width, height]); y = height - margin; }
  }
  function wrapLine(text, f, size) {
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
  function drawParagraphs(text, { size = 10, bold = false, gap = 5, indent = 0, color = rgb(0.12, 0.12, 0.14) } = {}) {
    const f = bold ? boldFont : font;
    for (const paragraph of String(text).split("\n")) {
      if (!paragraph.trim()) { ensureSpace(size + gap); y -= size + gap; continue; }
      for (const l of wrapLine(paragraph, f, size)) {
        ensureSpace(size + gap);
        page.drawText(l, { x: margin + indent, y, size, font: f, color });
        y -= size + gap;
      }
    }
  }
  function rule() {
    ensureSpace(14);
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.75, color: rgb(0.82, 0.82, 0.85) });
    y -= 12;
  }

  drawParagraphs(SCREENING_TITLE, { size: 18, bold: true, gap: 10 });
  drawParagraphs(`Screening version: ${screeningVersion}`, { size: 9, color: rgb(0.45, 0.45, 0.5), gap: 4 });
  drawParagraphs(`Signed at: ${signedAt}`, { size: 9, color: rgb(0.45, 0.45, 0.5), gap: 16 });

  drawParagraphs("Health questions", { size: 12, bold: true, gap: 8 });
  SCREENING_QUESTIONS.forEach((q, i) => {
    const answer = answers?.[q.key] === "yes" ? "YES" : answers?.[q.key] === "no" ? "NO" : "(not answered)";
    drawParagraphs(`${i + 1}. ${q.text}`, { size: 9.5, gap: 3 });
    drawParagraphs(`Answer: ${answer}`, { size: 9.5, bold: true, gap: 10, indent: 12, color: answer === "YES" ? rgb(0.6, 0.15, 0.15) : rgb(0.12, 0.12, 0.14) });
  });

  if (needsClearance) {
    rule();
    drawParagraphs("Medical clearance recommended", { size: 11, bold: true, gap: 6, color: rgb(0.55, 0.4, 0.05) });
    drawParagraphs(CLEARANCE_ADVISORY, { size: 9.5, gap: 5 });
  }

  rule();
  drawParagraphs("Acknowledgments", { size: 12, bold: true, gap: 8 });
  CONSENT_ITEMS.forEach((c) => {
    const checked = consents?.[c.key] ? "[x]" : "[ ]";
    drawParagraphs(`${checked} ${c.label}`, { size: 9.5, gap: 8 });
  });

  rule();
  drawParagraphs(`Signed by: ${signedName}`, { size: 11, bold: true, gap: 8 });

  if (signaturePngBytes) {
    const sigImage = await pdfDoc.embedPng(signaturePngBytes);
    const sigWidth = 220;
    const sigHeight = (sigImage.height / sigImage.width) * sigWidth;
    ensureSpace(sigHeight + 10);
    page.drawImage(sigImage, { x: margin, y: y - sigHeight, width: sigWidth, height: sigHeight });
    y -= sigHeight + 10;
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
