import { useEffect, useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { fetchLatestSignature, isCurrentSignature } from "./data.js";
import { SignatureForm } from "./SignatureForm.jsx";

function FullScreenMessage({ children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 500, display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ color: T.muted, fontWeight: 700, textAlign: "center" }}>{children}</div>
    </div>
  );
}

export function AgreementGate({ client, children }) {
  // "loading" | "needs_signature" | "signed" | "error"
  const [status, setStatus] = useState("loading");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchLatestSignature(client.id)
      .then((sig) => {
        if (cancelled) return;
        setStatus(isCurrentSignature(sig) ? "signed" : "needs_signature");
      })
      .catch(() => {
        // Fail closed: a network error blocks access rather than silently
        // letting an unsigned client through. The error screen offers Retry.
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [client.id, retryCount]);

  function retry() {
    setStatus("loading");
    setRetryCount((n) => n + 1);
  }

  if (status === "loading") return <FullScreenMessage>Checking your agreement status...</FullScreenMessage>;

  if (status === "error") {
    return (
      <FullScreenMessage>
        <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
          <div>Couldn't check your agreement status. Check your connection and try again.</div>
          <Button onClick={retry}>Retry</Button>
        </div>
      </FullScreenMessage>
    );
  }

  if (status === "needs_signature") {
    return <SignatureForm client={client} onSigned={() => setStatus("signed")} />;
  }

  return children;
}
