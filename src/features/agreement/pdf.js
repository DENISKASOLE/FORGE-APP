import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AGREEMENT_TITLE, AGREEMENT_TEXT } from "./agreementText.js";

const PAGE = { width: 595.28, height: 841.89, margin: 50 }; // A4, points

export async function buildAgreementPdf({ signedName, signaturePngBytes, contractVersion, signedAt }) {
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
  function drawParagraphs(text, { size = 10, bold = false, gap = 5, color = rgb(0.12, 0.12, 0.14) } = {}) {
    const f = bold ? boldFont : font;
    for (const paragraph of String(text).split("\n")) {
      if (!paragraph.trim()) { ensureSpace(size + gap); y -= size + gap; continue; }
      for (const l of wrapLine(paragraph, f, size)) {
        ensureSpace(size + gap);
        page.drawText(l, { x: margin, y, size, font: f, color });
        y -= size + gap;
      }
    }
  }

  drawParagraphs(AGREEMENT_TITLE, { size: 18, bold: true, gap: 10 });
  drawParagraphs(`Contract version: ${contractVersion}`, { size: 9, color: rgb(0.45, 0.45, 0.5), gap: 4 });
  drawParagraphs(`Signed at: ${signedAt}`, { size: 9, color: rgb(0.45, 0.45, 0.5), gap: 16 });

  drawParagraphs(AGREEMENT_TEXT, { size: 9.5, gap: 5 });

  ensureSpace(120);
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.75, color: rgb(0.82, 0.82, 0.85) });
  y -= 20;

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
