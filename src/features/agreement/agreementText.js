// PLACEHOLDER LEGAL TEXT — DO NOT SHIP AS-IS.
// This is filler copy so the signing flow can be built and tested end to
// end. The real liability waiver and data/AI-processing consent language
// must be drafted (or reviewed) by a lawyer before this gates real clients.
// Swap the text below and bump CONTRACT_VERSION when the real copy lands -
// bumping the version is what forces every existing client to re-sign.

export const CONTRACT_VERSION = "2026-08-26-placeholder-v1";

export const AGREEMENT_TITLE = "Coaching Agreement & Liability Waiver";

export const AGREEMENT_TEXT = `
[PLACEHOLDER — REPLACE WITH LAWYER-REVIEWED TEXT]

1. ASSUMPTION OF RISK
Participation in personal training, strength and conditioning, and any
physical activity recommended by your coach carries inherent risk of
injury, including but not limited to muscular strain, joint injury, and
in rare cases more serious harm. By signing this agreement you
acknowledge that you understand these risks and voluntarily assume them.

2. LIABILITY WAIVER
[Placeholder clause: to what extent the coach/business is released from
liability for injury arising from ordinary participation, excluding
gross negligence or willful misconduct — exact scope and enforceability
depends on your jurisdiction and must be drafted by a lawyer.]

3. HEALTH DISCLOSURE & MEDICAL CLEARANCE
You confirm that you have disclosed any known medical conditions,
injuries, or physical limitations to your coach prior to beginning any
program. You understand that where a condition warrants it, your coach
may require written medical clearance before continuing.

4. DATA, PHOTOS & THIRD-PARTY AI PROCESSING
As part of your coaching program you may submit photos of meals, and
health, nutrition, and training data. You consent to this data being:
  (a) stored securely by the app on your coach's behalf;
  (b) reviewed by your coach for the purpose of coaching you;
  (c) processed by third-party AI services (for example, to help analyze
      nutrition photos or logs) as part of preparing your coaching
      feedback.
[Placeholder: exact processors, retention period, and opt-out mechanics
to be specified once finalized.]

5. GENERAL
[Placeholder: governing law, term, termination, entire-agreement clause,
and any other boilerplate your lawyer recommends.]

By signing below, you confirm you have read this agreement in full,
understand it, and agree to its terms.
`.trim();

export const CONSENT_ITEMS = [
  {
    key: "liability",
    label: "I have read and accept the liability waiver and assumption of risk above.",
  },
  {
    key: "health",
    label: "I have disclosed my current health status and understand medical clearance may be required.",
  },
  {
    key: "dataConsent",
    label: "I consent to my food photos and health data being stored and processed by third-party AI services for analysis, as described above.",
  },
];
