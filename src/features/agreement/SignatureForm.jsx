import { useRef, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { CONTRACT_VERSION, AGREEMENT_TITLE, AGREEMENT_TEXT, CONSENT_ITEMS } from "./agreementText.js";

const SCROLL_END_THRESHOLD_PX = 8;

function ConsentCheckbox({ checked, onChange, children }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, width: 18, height: 18 }} />
      <span style={{ color: T.accent, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{children}</span>
    </label>
  );
}

// `client` and `onSigned` are consumed by handleSign's TODO block below,
// which isn't wired up yet - the signature-capture/PDF/upload/insert step
// intentionally left for after this skeleton is reviewed.
// eslint-disable-next-line no-unused-vars
export function SignatureForm({ client, onSigned }) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [consents, setConsents] = useState(() => Object.fromEntries(CONSENT_ITEMS.map((c) => [c.key, false])));
  const [fullName, setFullName] = useState("");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef(null);
  // TODO(next step): populate from real pointer-drawing on the canvas below.
  const [hasSignature, setHasSignature] = useState(false);

  function handleScroll(e) {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_END_THRESHOLD_PX) setScrolledToEnd(true);
  }
  function setConsent(key, value) {
    setConsents((c) => ({ ...c, [key]: value }));
  }
  function clearSignature() {
    // TODO(next step): clear the canvas bitmap too, once drawing is wired up.
    setHasSignature(false);
  }

  const allConsented = CONSENT_ITEMS.every((c) => consents[c.key]);
  const canSign = scrolledToEnd && allConsented && fullName.trim().length > 1 && hasSignature;

  async function handleSign() {
    setSigning(true);
    setError("");
    try {
      // TODO(next step):
      //  1. Export the canvas to a PNG blob.
      //  2. Render AGREEMENT_TEXT + fullName + signature PNG + CONTRACT_VERSION
      //     + timestamp into a PDF (pdf-lib, already a dependency).
      //  3. Upload both to the agreement-documents storage bucket under
      //     `${client.id}/${signatureId}/signature.png` and `.../agreement.pdf`.
      //  4. insertSignature({ client_id, contract_version, signed_name,
      //     signature_path, pdf_path, consents, signed_at }).
      //  5. onSigned() to close the gate.
      throw new Error("Signature capture and PDF generation aren't wired up yet.");
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
            width={560}
            height={180}
            style={{ width: "100%", height: 180, background: T.card2, border: `1px solid ${T.line}`, borderRadius: 12, touchAction: "none" }}
          />
          <div style={{ color: T.dim, fontSize: 11, fontWeight: 600 }}>
            Drawing isn't wired up yet — this is the layout placeholder for the next step.
          </div>
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
