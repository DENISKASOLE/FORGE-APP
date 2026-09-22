// Plain Canvas 2D bar/line chart rendering, used only to rasterize a PNG
// for the exported PDF - pdf-lib has no native charting, and this app
// already hand-draws its on-screen charts as SVG rather than pulling in a
// charting library, so a small canvas equivalent keeps that same
// dependency-free approach rather than introducing one just for PDFs.
// The on-screen report renders its own SVG version of the same data; this
// file exists purely for the export path.

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

const AXIS_COLOR = "#B9B4A8";
const LABEL_COLOR = "#6B665C";

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
