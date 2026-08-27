// Official PAR-Q+ questions (Physical Activity Readiness Questionnaire).
// Bump SCREENING_VERSION whenever this wording (or the acknowledgment
// text) changes; that's what forces every existing client to screen again.

export const SCREENING_VERSION = "2026-08-27-parq-v1";

export const SCREENING_TITLE = "Health Readiness Screening";

export const SCREENING_INTRO = "Before you start, a quick health check. Answer honestly, it keeps your training safe.";

export const SCREENING_QUESTIONS = [
  { key: "q1", text: "Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?" },
  { key: "q2", text: "Do you feel pain in your chest when you do physical activity?" },
  { key: "q3", text: "In the past month, have you had chest pain when you were not doing physical activity?" },
  { key: "q4", text: "Do you lose your balance because of dizziness or do you ever lose consciousness?" },
  { key: "q5", text: "Do you have a bone or joint problem (for example, back, knee, or hip) that could be made worse by a change in your physical activity?" },
  { key: "q6", text: "Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?" },
  { key: "q7", text: "Do you know of any other reason why you should not do physical activity?" },
];

export const CLEARANCE_ADVISORY =
  "Based on your answers, we recommend you get medical clearance from a doctor before starting this program. This isn't a hard stop; your coach will follow up with you about it.";

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
