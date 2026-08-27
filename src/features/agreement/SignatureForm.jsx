import { useEffect, useRef, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { uid } from "../../lib/uid.js";
import { CONTRACT_VERSION, AGREEMENT_TITLE, AGREEMENT_TEXT, CONSENT_ITEMS } from "./agreementText.js";
import { insertSignature } from "./data.js";
import { uploadAgreementFile } from "./storage.js";
import { buildAgreementPdf } from "./pdf.js";

const SCROLL_END_THRESHOLD_PX = 8;

function ConsentCheckbox({ checked, onChange, children }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }} />
      <span style={{ color: T.accent, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{children}</span>
    </label>
  );
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read the signature."))), "image/png");
  });
}

export function SignatureForm({ client, onSigned }) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
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

  function handleScroll(e) {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_END_THRESHOLD_PX) setScrolledToEnd(true);
  }
  function setConsent(key, value) {
    setConsents((c) => ({ ...c, [key]: value }));
  }

  const allConsented = CONSENT_ITEMS.every((c) => consents[c.key]);
  const canSign = scrolledToEnd && allConsented && fullName.trim().length > 1 && hasSignature;

  async function handleSign() {
    setSigning(true);
    setError("");
    try {
      const signedName = fullName.trim();
      const signedAt = new Date().toISOString();
      const signatureId = uid();

      const signatureBlob = await canvasToBlob(canvasRef.current);
      const signaturePngBytes = new Uint8Array(await signatureBlob.arrayBuffer());
      const pdfBlob = await buildAgreementPdf({ signedName, signaturePngBytes, contractVersion: CONTRACT_VERSION, signedAt });

      const signaturePath = await uploadAgreementFile(client.id, signatureId, "signature.png", signatureBlob);
      const pdfPath = await uploadAgreementFile(client.id, signatureId, "agreement.pdf", pdfBlob);

      await insertSignature({
        client_id: client.id,
        contract_version: CONTRACT_VERSION,
        signed_name: signedName,
        signature_path: signaturePath,
        pdf_path: pdfPath,
        consents,
      });

      onSigned();
    } catch (e) {
      setError(e.message || "Could not save your signature. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 500, overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 48px", display: "grid", gap: 16 }}>
        <div>
          <SectionLabel>Step required · Version {CONTRACT_VERSION}</SectionLabel>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.accent, marginTop: 4 }}>{AGREEMENT_TITLE}</div>
          <div style={{ color: T.muted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            Read the full agreement below, then confirm your consent and sign to unlock your program.
          </div>
        </div>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div
            onScroll={handleScroll}
            style={{ maxHeight: 320, overflowY: "auto", padding: 16, color: T.accent, fontSize: 13, fontWeight: 600, lineHeight: 1.6, whiteSpace: "pre-wrap" }}
          >
            {AGREEMENT_TEXT}
          </div>
        </Card>
        {!scrolledToEnd && (
          <div style={{ color: T.warn, fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: -8 }}>
            Scroll to the bottom of the agreement to continue.
          </div>
        )}

        <Card style={{ display: "grid", gap: 12 }}>
          <SectionLabel color={T.muted}>Consent</SectionLabel>
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
            style={{ width: "100%", height: 180, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, touchAction: "none", cursor: "crosshair" }}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            onPointerCancel={endDraw}
          />
          <div style={{ color: T.dim, fontSize: 11, fontWeight: 600 }}>Sign with your mouse, stylus, or finger.</div>
          <Button variant="dark" onClick={clearSignature}>Clear</Button>
        </Card>

        {error && <div style={{ color: T.bad, fontSize: 13, fontWeight: 700 }}>{error}</div>}

        <Button onClick={handleSign} disabled={!canSign || signing} style={{ background: T.gold }}>
          {signing ? "Saving..." : "Sign & continue"}
        </Button>
      </div>
    </div>
  );
}
