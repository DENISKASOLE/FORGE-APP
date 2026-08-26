import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
