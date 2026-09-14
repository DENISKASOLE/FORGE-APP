// SiliconFlow's vision models read images, never PDFs (Gemini used to read
// the PDF directly), so an uploaded body-analysis report has to be
// rasterized here before it goes anywhere. pdfjs is imported lazily - it's
// a big library, and most sessions never upload a report at all, so it
// stays out of the main bundle until someone actually picks a PDF.

// Body analysis reports are 1-2 pages. Capping keeps the request small and
// stops someone accidentally uploading a 60-page document.
const MAX_PAGES = 4;
// Wide enough for the small print on an InBody sheet to survive OCR.
const TARGET_WIDTH = 1400;

let pdfjsPromise = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

// Returns an array of JPEG data URLs, one per page - or the image itself,
// already a data URL, when the upload wasn't a PDF to begin with.
export async function fileToImageDataUrls(file) {
  if (file.type !== "application/pdf") return [await fileToDataUrl(file)];

  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const images = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const canvasContext = canvas.getContext("2d");
    // PDFs have no background of their own - without this, transparent
    // areas render black and the text becomes unreadable.
    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext, viewport, canvas }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.85));
  }

  if (!images.length) throw new Error("That PDF appears to be empty.");
  return images;
}
