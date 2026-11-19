import { useEffect, useRef, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { buildProgressReportPDF } from "../../lib/progressReportPdf.js";

// The report preview IS the exported PDF (Nov 19 2026 redesign): the same
// builder makes the file, and pdf.js draws its pages here, so the coach
// can never see something different from what the client receives.
// pdf.js is loaded only when this preview opens. Rebuilds 400 ms after
// the last change to the notes or period.
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

export function ReportPreview({ model, notes }) {
  const boxRef = useRef(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const [lib, blob] = await Promise.all([loadPdfjs(), buildProgressReportPDF(model, notes)]);
        const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled || !boxRef.current) return;
        const box = boxRef.current;
        const width = box.clientWidth || 360;
        const canvases = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * Math.min(2, window.devicePixelRatio || 1);
          const vp = page.getViewport({ scale });
          const c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          c.style.cssText = `width:100%;height:auto;display:block;border-radius:6px;box-shadow:0 1px 6px rgba(0,0,0,.15);margin-bottom:14px;background:#fff`;
          await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
          canvases.push(c);
        }
        if (cancelled) return;
        box.replaceChildren(...canvases);
        setState("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setState("error");
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [model, notes]);
  return (
    <div>
      {state === "loading" && <div style={{ fontFamily: BRAND.sans, fontSize: 12, color: BRAND.muted, padding: "8px 0" }}>Drawing the report…</div>}
      {state === "error" && <div style={{ fontFamily: BRAND.sans, fontSize: 12, color: BRAND.red, padding: "8px 0" }}>Couldn't draw the preview. Export still works.</div>}
      <div ref={boxRef} />
    </div>
  );
}
