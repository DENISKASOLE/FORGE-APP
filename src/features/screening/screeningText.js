// PLACEHOLDER PAR-Q+ WORDING — DO NOT SHIP AS-IS.
// Replace with official PAR-Q+ wording from eparmedx.com — use verbatim,
// do not paraphrase or alter. The PAR-Q+ is a copyrighted, validated
// screening instrument; the 7 slots below exist so the flow can be built
// and tested, not as a substitute for the real questions. Bump
// SCREENING_VERSION whenever the real wording (or the acknowledgment
// text) replaces this placeholder — that's what forces every existing
// client to re-screen.

export const SCREENING_VERSION = "2026-08-27-placeholder-v1";

export const SCREENING_TITLE = "Health Readiness Screening";

export const SCREENING_INTRO = "Before you start, a quick health check. Answer honestly — it keeps your training safe.";

// [PLACEHOLDER] — replace each `text` with the official PAR-Q+ question,
// verbatim, from eparmedx.com. Do not invent or paraphrase medical wording.
export const SCREENING_QUESTIONS = [
  { key: "q1", text: "[PLACEHOLDER PAR-Q+ QUESTION 1 — replace verbatim from eparmedx.com]" },
  { key: "q2", text: "[PLACEHOLDER PAR-Q+ QUESTION 2 — replace verbatim from eparmedx.com]" },
  { key: "q3", text: "[PLACEHOLDER PAR-Q+ QUESTION 3 — replace verbatim from eparmedx.com]" },
  { key: "q4", text: "[PLACEHOLDER PAR-Q+ QUESTION 4 — replace verbatim from eparmedx.com]" },
  { key: "q5", text: "[PLACEHOLDER PAR-Q+ QUESTION 5 — replace verbatim from eparmedx.com]" },
  { key: "q6", text: "[PLACEHOLDER PAR-Q+ QUESTION 6 — replace verbatim from eparmedx.com]" },
  { key: "q7", text: "[PLACEHOLDER PAR-Q+ QUESTION 7 — replace verbatim from eparmedx.com]" },
];

export const CLEARANCE_ADVISORY =
  "Based on your answers, we recommend you get medical clearance from a doctor before starting this program. This isn't a hard stop — your coach will follow up with you about it.";

export const CONSENT_ITEMS = [
  {
    key: "accurate",
    label: "The information I've given above is accurate and complete.",
  },
  {
    key: "dataConsent",
    label: "I consent to my food photos and health data being stored and processed by a third-party AI service for analysis.",
  },
  {
    key: "noGuarantee",
    label: "I understand results are not guaranteed and depend on my own effort.",
  },
  {
    key: "notMedicalAdvice",
    label: "I understand this is not medical advice and I should consult a doctor for medical concerns.",
  },
];
