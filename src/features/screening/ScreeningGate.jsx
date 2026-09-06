import { useEffect, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { fetchLatestScreening, isCurrentScreening, readCachedScreeningOk, cacheScreeningOk } from "./data.js";
import { ScreeningForm } from "./ScreeningForm.jsx";

function FullScreenMessage({ children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 500, display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ fontFamily: T.sans, color: T.muted, fontWeight: 500, fontSize: 14, lineHeight: 1.6, textAlign: "center" }}>{children}</div>
    </div>
  );
}

export function ScreeningGate({ client, children }) {
  // "loading" | "needs_screening" | "screened" | "error"
  const [status, setStatus] = useState("loading");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchLatestScreening(client.id)
      .then((screening) => {
        if (cancelled) return;
        const ok = isCurrentScreening(screening);
        cacheScreeningOk(client.id, ok);
        setStatus(ok ? "screened" : "needs_screening");
      })
      .catch(() => {
        if (cancelled) return;
        // Fail closed only for a client this device has never confirmed
        // screened before - a genuine "never screened, and we can't check"
        // case shouldn't let them through just because they're offline.
        // A client who already passed this check at least once (the
        // common case - this fetch reruns on every visit to the program
        // tab) stays let in on the same cached result while offline or
        // mid network-hiccup, which is what actually makes the program
        // usable offline instead of getting re-blocked every time.
        setStatus(readCachedScreeningOk(client.id) ? "screened" : "error");
      });
    return () => { cancelled = true; };
  }, [client.id, retryCount]);

  function retry() {
    setStatus("loading");
    setRetryCount((n) => n + 1);
  }

  if (status === "loading") return <FullScreenMessage>Checking your health screening status...</FullScreenMessage>;

  if (status === "error") {
    return (
      <FullScreenMessage>
        <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
          <div style={{ fontFamily: T.sans, fontSize: 14, lineHeight: 1.6 }}>Couldn't check your screening status. Check your connection and try again.</div>
          <Button onClick={retry}>Retry</Button>
        </div>
      </FullScreenMessage>
    );
  }

  if (status === "needs_screening") {
    return <ScreeningForm client={client} onScreened={() => setStatus("screened")} />;
  }

  return children;
}
