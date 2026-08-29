import { useEffect, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { fetchLatestScreening } from "./data.js";
import { getSignedScreeningUrl } from "./storage.js";

export function SignedScreeningView({ client }) {
  const [screening, setScreening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLatestScreening(client.id)
      .then((s) => { if (!cancelled) setScreening(s); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client.id]);

  async function openPdf() {
    if (!screening?.pdf_path) return;
    setOpening(true);
    const url = await getSignedScreeningUrl(screening.pdf_path);
    setOpening(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading) return null;
  if (!screening) return null;

  return (
    <Card style={{ padding: 16, display: "grid", gap: 8 }}>
      <SectionLabel color={T.muted}>Health screening</SectionLabel>
      <div style={{ fontFamily: T.sans, color: T.accent, fontSize: 14, fontWeight: 500 }}>
        Completed {new Date(screening.signed_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
      </div>
      <div style={{ fontFamily: T.sans, color: T.muted, fontSize: 12, fontWeight: 400 }}>Version {screening.screening_version} · {screening.signed_name}</div>
      {screening.needs_clearance && (
        <div style={{ fontFamily: T.sans, color: T.warn, fontSize: 12, fontWeight: 500 }}>Medical clearance was recommended at the time of screening.</div>
      )}
      <Button variant="dark" onClick={openPdf} disabled={opening} style={{ justifySelf: "start" }}>
        {opening ? "Opening..." : "View signed copy (PDF)"}
      </Button>
    </Card>
  );
}
