import { useEffect, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { fetchLatestSignature } from "./data.js";
import { getSignedAgreementUrl } from "./storage.js";

export function SignedAgreementView({ client }) {
  const [signature, setSignature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLatestSignature(client.id)
      .then((sig) => { if (!cancelled) setSignature(sig); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client.id]);

  async function openPdf() {
    if (!signature?.pdf_path) return;
    setOpening(true);
    const url = await getSignedAgreementUrl(signature.pdf_path);
    setOpening(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading) return null;
  if (!signature) return null;

  return (
    <Card style={{ padding: 16, display: "grid", gap: 8 }}>
      <SectionLabel color={T.muted}>Signed agreement</SectionLabel>
      <div style={{ color: T.accent, fontSize: 14, fontWeight: 700 }}>
        Signed {new Date(signature.signed_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
      </div>
      <div style={{ color: T.muted, fontSize: 12 }}>Version {signature.contract_version} · {signature.signed_name}</div>
      <Button variant="dark" onClick={openPdf} disabled={opening} style={{ justifySelf: "start" }}>
        {opening ? "Opening..." : "View signed copy (PDF)"}
      </Button>
    </Card>
  );
}
