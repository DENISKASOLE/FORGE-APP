// Plain Canvas 2D chart rendering - pdf-lib has no native charting, and
// this app otherwise hand-draws its on-screen charts as SVG rather than
// pulling in a charting library, so this keeps that same dependency-free
// approach. The Progress Report (DECISIONS.md) goes further and shows
// these same PNGs on screen too (ReportPreview.jsx), not just in the
// exported PDF, so its live preview and its PDF can never visually
// diverge - one rendering path for both surfaces.

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

export const AXIS_COLOR = "#B9B4A8";
export const LABEL_COLOR = "#6B665C";

// Nice round axis ticks for an arbitrary [min, max] - same bucketing idea
// the "Forge Progress Report" prototype's own niceTicks() uses, so the
// report's many small charts (weight, measurements, volume, HR, sleep,
// steps) don't all need their own hand-picked tick spacing.
function niceTicks(min, max, count = 4) {
  if (max <= min) max = min + 1;
  const span = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(span)));
  const e = span / mag;
  const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks, step };
}

// General-purpose multi-series chart for the Progress Report: any mix of
// bars/line/dots/triangles sharing one x (day-index) / y axis, e.g. a
// weight scatter with a rolling-mean line overlay, or two bar series for
// planned-vs-completed sessions per week. renderBarChartPNG/
// renderLineChartPNG above are also reused as-is by the Progress Report
// for its simpler single-series charts. The report's PNGs are shown
// as-is in the live preview (ReportPreview.jsx) AND embedded in the
// exported PDF (progressReportPdf.js), so this is the one place its
// chart visuals are drawn.
export function renderSeriesChartPNG({
  width = 520, height = 220, padTop = 20, padBottom = 30, padLeft = 40, padRight = 12,
  xCount, xLabels = [], yMin = 0, yMax = 1, yCount = 4, zero = false, yFmt, series = [], aria = "",
} = {}) {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (aria) canvas.setAttribute("aria-label", aria);

  const plotW = width - padLeft - padRight, plotH = height - padTop - padBottom;
  const n = Math.max(xCount || 1, 1);
  const nt = niceTicks(zero ? 0 : yMin, yMax, yCount);
  const lo = zero ? 0 : nt.lo, hi = nt.hi;
  const bw = plotW / n;
  const X = (i) => padLeft + (i + 0.5) * bw;
  const Y = (v) => padTop + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  ctx.textAlign = "right";
  ctx.font = "500 9.5px Arial, sans-serif";
  nt.ticks.forEach((v) => {
    if (v < lo - 1e-9) return;
    ctx.strokeStyle = Math.abs(v - lo) < 1e-9 ? AXIS_COLOR : "#ECE4D7";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padLeft, Y(v)); ctx.lineTo(width - padRight, Y(v)); ctx.stroke();
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(yFmt ? yFmt(v) : String(Math.round(v * 10) / 10), padLeft - 6, Y(v) + 3.5);
  });
  ctx.textAlign = "center";
  ctx.font = "500 9.5px Arial, sans-serif";
  xLabels.forEach(({ i, label }) => ctx.fillText(label, X(i), height - 6));

  series.forEach((s) => {
    const color = s.color || "#C9A24B";
    if (s.type === "bars") {
      const frac = s.frac ?? 0.6, off = s.off ?? 0;
      (s.points || []).forEach(({ i, v }) => {
        if (v == null) return;
        const bx = X(i) - (bw * frac) / 2 + off * bw, y = Y(Math.max(v, lo));
        const bh = Math.max(Y(lo) - y, 0), w = Math.max(bw * frac, 1);
        if (s.stroke) { ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.strokeRect(bx, y, w, bh); }
        else { ctx.fillStyle = color; ctx.fillRect(bx, y, w, bh); }
      });
    } else if (s.type === "line") {
      ctx.strokeStyle = color; ctx.lineWidth = s.width || 1.8; ctx.lineJoin = "round"; ctx.lineCap = "round";
      if (s.dash) ctx.setLineDash(s.dash); else ctx.setLineDash([]);
      ctx.beginPath();
      (s.points || []).forEach(({ i, v }, idx) => (idx === 0 ? ctx.moveTo(X(i), Y(v)) : ctx.lineTo(X(i), Y(v))));
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (s.type === "dots" || s.type === "triangles") {
      ctx.fillStyle = color;
      (s.points || []).forEach(({ i, v }) => {
        const x = X(i), y = Y(v);
        ctx.beginPath();
        if (s.type === "triangles") { ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x - 4, y + 3); ctx.closePath(); }
        else ctx.arc(x, y, s.r || 3, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (s.type === "hline") {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(padLeft, Y(s.v)); ctx.lineTo(width - padRight, Y(s.v)); ctx.stroke();
      ctx.setLineDash([]);
    }
  });
  return canvas.toDataURL("image/png");
}

export function renderBarChartPNG(labels, values, { width = 520, height = 220, color = "#C9A24B", suffix = "" } = {}) {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const padTop = 24, padBottom = 34, padSide = 16;
  const plotH = height - padTop - padBottom;
  const plotW = width - padSide * 2;
  const max = Math.max(1, ...values);
  const barW = plotW / values.length;

  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padSide, height - padBottom);
  ctx.lineTo(width - padSide, height - padBottom);
  ctx.stroke();

  values.forEach((v, i) => {
    const barH = max > 0 ? (v / max) * plotH : 0;
    const x = padSide + i * barW + barW * 0.18;
    const w = barW * 0.64;
    const y = height - padBottom - barH;
    ctx.fillStyle = color;
    ctx.beginPath();
    const r = Math.min(6, w / 2);
    ctx.moveTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, height - padBottom);
    ctx.lineTo(x, height - padBottom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#2A2820";
    ctx.font = "600 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(v ? `${v}${suffix}` : "-", x + w / 2, y - 6);

    ctx.fillStyle = LABEL_COLOR;
    ctx.font = "500 10px Arial, sans-serif";
    ctx.fillText(labels[i], x + w / 2, height - padBottom + 16);
  });

  return canvas.toDataURL("image/png");
}

export function renderLineChartPNG(labels, values, { width = 520, height = 220, color = "#5FA37B" } = {}) {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const padTop = 24, padBottom = 34, padSide = 20;
  const plotH = height - padTop - padBottom;
  const plotW = width - padSide * 2;

  if (values.length < 2) {
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = "500 12px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Not enough data points yet", width / 2, height / 2);
    return canvas.toDataURL("image/png");
  }

  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => ({
    x: padSide + (i / (values.length - 1)) * plotW,
    y: padTop + plotH - ((v - min) / span) * plotH,
  }));

  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padSide, height - padBottom);
  ctx.lineTo(width - padSide, height - padBottom);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  coords.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  coords.forEach((p, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === coords.length - 1 ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (i === 0 || i === coords.length - 1 || labels.length <= 6) {
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = "500 10px Arial, sans-serif";
      ctx.textAlign = i === 0 ? "left" : i === coords.length - 1 ? "right" : "center";
      ctx.fillText(labels[i], p.x, height - padBottom + 16);
    }
  });

  return canvas.toDataURL("image/png");
}

export function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
