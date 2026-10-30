import { useEffect, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { fetchLatestScreening } from "./data.js";
import { getSignedScreeningUrl } from "./storage.js";
import { ScreeningForm } from "./ScreeningForm.jsx";

// PAR-Q used to be a hard gate in front of the Training tab
// (ScreeningGate.jsx, removed - DECISIONS.md): every client had to sign
// it before Training would even load. Training now just loads, and this
// lives in Profile instead - something a client signs on their own time,
// not something blocking their first workout.
//
// Only a client who JOINS on or after this date is prompted to sign -
// everyone who already existed in the app when this change shipped is
// never asked for one retroactively. A client who already has a
// screening on file (any date, from the old gated flow) still sees it
// here either way.
const PARQ_IN_PROFILE_SINCE = "2026-10-30";

export function HealthScreeningSection({ client, isCoach }) {
  const [screening, setScreening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLatestScreening(client.id)
      .then((s) => { if (!cancelled) setScreening(s); })
      .catch(() => { if (!cancelled) setFetchFailed(true); })
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
  function onScreened() {
    setSigning(false);
    fetchLatestScreening(client.id).then(setScreening);
  }

  // A transient fetch error stays silent rather than risk showing "please
  // sign" to a client who already has one on file - this is a soft
  // prompt, not a gate, so the safe failure mode is to say nothing.
  if (loading || fetchFailed) return null;

  if (screening) {
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

  // Nothing on file. Only prompt a new client, and only the client
  // themselves - a coach browsing this profile shouldn't see a nag for
  // a document meant to be signed in the client's own hand.
  const isNewClient = client.joinDate >= PARQ_IN_PROFILE_SINCE;
  if (isCoach || !isNewClient) return null;

  return (
    <>
      <Card style={{ padding: 16, display: "grid", gap: 8 }}>
        <SectionLabel color={T.muted}>Health screening</SectionLabel>
        <div style={{ fontFamily: T.sans, color: T.accent, fontSize: 14, fontWeight: 500 }}>Complete your PAR-Q</div>
        <div style={{ fontFamily: T.sans, color: T.muted, fontSize: 12, fontWeight: 400, lineHeight: 1.6 }}>A few health questions and a signature - takes under a minute.</div>
        <Button onClick={() => setSigning(true)} style={{ justifySelf: "start" }}>Complete health screening</Button>
      </Card>
      {signing && <ScreeningForm client={client} onScreened={onScreened} />}
    </>
  );
}
