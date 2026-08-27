// TODO(next step, after the flow skeleton is reviewed): render the
// completed screening PDF - questions + answers, needs_clearance advisory
// if triggered, the 4 acknowledgment texts, signed name, embedded
// signature PNG, SCREENING_VERSION, and timestamp. The paragraph-wrapping
// approach from the previous agreement PDF (pdf-lib, embedPng) still
// applies - just the content being drawn changes.
export async function buildScreeningPdf() {
  throw new Error("Screening PDF generation isn't wired up yet.");
}
