import { useEffect, useRef, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { uid } from "../../lib/uid.js";
import {
  SCREENING_VERSION, SCREENING_TITLE, SCREENING_INTRO,
  SCREENING_QUESTIONS, CLEARANCE_ADVISORY, CONSENT_ITEMS,
} from "./screeningText.js";
import { insertScreening } from "./data.js";
import { uploadScreeningFile } from "./storage.js";
import { buildScreeningPdf } from "./pdf.js";

function QuestionRow({ index, question, value, onChange }) {
  return (
    <div style={{ borderTop: index > 0 ? `${T.hairline} solid ${T.lineSoft}` : "none", paddingTop: index > 0 ? 12 : 0, marginTop: index > 0 ? 12 : 0, display: "grid", gap: 8 }}>
      <div style={{ fontFamily: T.sans, color: T.accent, fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>{index + 1}. {question.text}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <Chip selected={value === "yes"} onClick={() => onChange("yes")} color={T.bad}>Yes</Chip>
        <Chip selected={value === "no"} onClick={() => onChange("no")} color={T.good}>No</Chip>
      </div>
    </div>
  );
}

function ConsentCheckbox({ checked, onChange, children }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }} />
      <span style={{ fontFamily: T.sans, color: T.accent, fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>{children}</span>
    </label>
  );
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read the signature."))), "image/png");
  });
}

export function ScreeningForm({ client, onScreened }) {
  const [answers, setAnswers] = useState(() => Object.fromEntries(SCREENING_QUESTIONS.map((q) => [q.key, null])));
  const [consents, setConsents] = useState(() => Object.fromEntries(CONSENT_ITEMS.map((c) => [c.key, false])));
  const [fullName, setFullName] = useState("");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [hasSignature, setHasSignature] = useState(false);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = T.accent;
    ctxRef.current = ctx;
  }, []);

  function posFromEvent(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function startDraw(e) {
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    canvasRef.current.setPointerCapture?.(e.pointerId);
    isDrawingRef.current = true;
    const { x, y } = posFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function moveDraw(e) {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const { x, y } = posFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  }
  function endDraw() {
    isDrawingRef.current = false;
  }
  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function setAnswer(key, value) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }
  function setConsent(key, value) {
    setConsents((c) => ({ ...c, [key]: value }));
  }

  const allAnswered = SCREENING_QUESTIONS.every((q) => answers[q.key] === "yes" || answers[q.key] === "no");
  const needsClearance = SCREENING_QUESTIONS.some((q) => answers[q.key] === "yes");
  const allConsented = CONSENT_ITEMS.every((c) => consents[c.key]);
  const canSign = allAnswered && allConsented && fullName.trim().length > 1 && hasSignature;

  async function handleSign() {
    setSigning(true);
    setError("");
    try {
      const signedName = fullName.trim();
      const signedAt = new Date().toISOString();
      const screeningId = uid();

      const signatureBlob = await canvasToBlob(canvasRef.current);
      const signaturePngBytes = new Uint8Array(await signatureBlob.arrayBuffer());
      const pdfBlob = await buildScreeningPdf({
        signedName, signaturePngBytes, screeningVersion: SCREENING_VERSION, signedAt,
        answers, needsClearance, consents,
      });

      const signaturePath = await uploadScreeningFile(client.id, screeningId, "signature.png", signatureBlob);
      const pdfPath = await uploadScreeningFile(client.id, screeningId, "screening.pdf", pdfBlob);

      await insertScreening({
        client_id: client.id,
        screening_version: SCREENING_VERSION,
        answers,
        needs_clearance: needsClearance,
        signed_name: signedName,
        signature_path: signaturePath,
        pdf_path: pdfPath,
        consents,
      });

      onScreened();
    } catch (e) {
      setError(e.message || "Could not save your screening. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 500, overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 48px", display: "grid", gap: 16 }}>
        <div>
          <SectionLabel>Step required · Version {SCREENING_VERSION}</SectionLabel>
          <div style={{ fontFamily: T.display, fontSize: 27, fontWeight: 500, letterSpacing: "-0.01em", color: T.accent, marginTop: 4 }}>{SCREENING_TITLE}</div>
          <div style={{ fontFamily: T.sans, color: T.muted, fontSize: 14, fontWeight: 400, marginTop: 6, lineHeight: 1.6 }}>{SCREENING_INTRO}</div>
        </div>

        <Card style={{ padding: 16 }}>
          <SectionLabel color={T.muted} style={{ marginBottom: 4 }}>Health questions</SectionLabel>
          {SCREENING_QUESTIONS.map((q, i) => (
            <QuestionRow key={q.key} index={i} question={q} value={answers[q.key]} onChange={(v) => setAnswer(q.key, v)} />
          ))}
        </Card>

        {needsClearance && (
          <Card style={{ padding: 16, background: T.warnBg, border: `${T.hairline} solid color-mix(in srgb, ${T.warn} 45%, transparent)` }}>
            <div style={{ fontFamily: T.sans, color: T.warn, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>Recommendation</div>
            <div style={{ fontFamily: T.sans, color: T.accent, fontSize: 13, fontWeight: 500, lineHeight: 1.6 }}>{CLEARANCE_ADVISORY}</div>
          </Card>
        )}

        <Card style={{ display: "grid", gap: 12 }}>
          <SectionLabel color={T.muted}>Acknowledgments</SectionLabel>
          {CONSENT_ITEMS.map((c) => (
            <ConsentCheckbox key={c.key} checked={consents[c.key]} onChange={(v) => setConsent(c.key, v)}>
              {c.label}
            </ConsentCheckbox>
          ))}
        </Card>

        <Card style={{ display: "grid", gap: 12 }}>
          <SectionLabel color={T.muted}>Your name</SectionLabel>
          <Field label="Full legal name" value={fullName} onChange={setFullName} placeholder="Jane Smith" />
        </Card>

        <Card style={{ display: "grid", gap: 10 }}>
          <SectionLabel color={T.muted}>Signature</SectionLabel>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: 180, background: T.card2, border: `${T.hairline} solid ${T.line}`, borderRadius: T.radiusControl, touchAction: "none", cursor: "crosshair" }}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            onPointerCancel={endDraw}
          />
          <div style={{ fontFamily: T.sans, color: T.dim, fontSize: 11, fontWeight: 500 }}>Sign with your mouse, stylus, or finger.</div>
          <Button variant="dark" onClick={clearSignature}>Clear</Button>
        </Card>

        {error && <div style={{ fontFamily: T.sans, color: T.bad, fontSize: 13, fontWeight: 500 }}>{error}</div>}

        <Button onClick={handleSign} disabled={!canSign || signing}>
          {signing ? "Saving..." : "Sign & continue"}
        </Button>
      </div>
    </div>
  );
}
