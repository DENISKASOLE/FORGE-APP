import { useEffect, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { PROVIDER_META, getHealthStatus, startHealthConnect, syncHealth, disconnectHealth } from "../../lib/health.js";

function timeAgo(iso) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ConnectedDevices({ client, refresh }) {
  const isMobile = useIsMobile(520);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setStatus(await getHealthStatus(client.id));
      setError("");
    } catch (e) {
      setError(e.message || "Couldn't load connected devices.");
    }
  }

  useEffect(() => {
    load();
    // The edge function bounces back here with ?health=... after the OAuth
    // round trip, so report the outcome and then strip it from the URL so a
    // refresh doesn't replay the message.
    const params = new URLSearchParams(window.location.search);
    const result = params.get("health");
    if (result) {
      const messages = {
        connected: ["Device connected — pulling your recent data.", "success"],
        cancelled: ["Connection cancelled.", "warn"],
        expired: ["That link expired — try connecting again.", "warn"],
        unsupported: ["That device isn't supported yet.", "warn"],
      };
      const [msg, tone] = messages[result] || ["Couldn't finish connecting.", "error"];
      showToast(msg, tone);
      params.delete("health");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  async function connect(provider) {
    setBusy(provider);
    try {
      const url = await startHealthConnect(client.id, provider, window.location.href.split("?")[0]);
      window.location.href = url;
    } catch (e) {
      showToast(e.message || "Couldn't start that connection.", "error");
      setBusy("");
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const { results } = await syncHealth(client.id, 14);
      const failed = (results || []).filter((r) => r.error);
      if (failed.length) showToast(failed[0].error, "error");
      else {
        const total = (results || []).reduce((n, r) => n + (r.days || 0), 0);
        showToast(total ? `Synced ${total} day${total === 1 ? "" : "s"}.` : "Already up to date.", "success");
      }
      await load();
      refresh?.();
    } catch (e) {
      showToast(e.message || "Couldn't sync.", "error");
    } finally {
      setBusy("");
    }
  }

  async function disconnect(provider) {
    const label = PROVIDER_META[provider]?.label || provider;
    if (!await confirmDialog(`Disconnect ${label}? Steps and sleep already synced are kept — new days just stop arriving.`, { danger: true, confirmLabel: "Disconnect" })) return;
    setBusy(provider);
    try {
      await disconnectHealth(client.id, provider);
      await load();
      showToast(`${label} disconnected.`, "success");
    } catch (e) {
      showToast(e.message || "Couldn't disconnect.", "error");
    } finally {
      setBusy("");
    }
  }

  const connected = status?.connections || [];
  const available = (status?.available || []).filter((p) => !connected.some((c) => c.provider === p));

  return (
    <div style={{ display: "grid", gap: isMobile ? 10 : 14 }}>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}>Connected devices</div>
        <div style={{ color: BRAND.muted, fontSize: 14, marginTop: 2 }}>
          Link a tracker and your steps and sleep fill in automatically, instead of typing them each day.
        </div>
      </div>

      {error && <Card><div style={{ color: BRAND.yellow, fontSize: 13 }}>{error}</div></Card>}

      {connected.map((c) => {
        const meta = PROVIDER_META[c.provider] || { label: c.provider };
        return (
          <Card key={c.provider} style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.last_sync_error ? BRAND.yellow : BRAND.green, flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, fontSize: 15, color: BRAND.text }}>{meta.label}</span>
                </div>
                <div style={{ color: BRAND.dim, fontSize: 12, marginTop: 3 }}>Last synced {timeAgo(c.last_synced_at)}</div>
              </div>
              <Button variant="dark" disabled={!!busy} onClick={() => disconnect(c.provider)} style={{ fontSize: 12 }}>Disconnect</Button>
            </div>
            {c.last_sync_error && (
              <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.yellow}`, borderRadius: 12, padding: 10, color: BRAND.muted, fontSize: 12, lineHeight: 1.5 }}>
                Last sync failed: {c.last_sync_error}
              </div>
            )}
          </Card>
        );
      })}

      {connected.length > 0 && (
        <Button onClick={sync} disabled={!!busy}>{busy === "sync" ? "Syncing..." : "Sync now"}</Button>
      )}

      {available.map((p) => {
        const meta = PROVIDER_META[p] || { label: p };
        return (
          <Card key={p} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 15, color: BRAND.text }}>{meta.label}</div>
              {meta.blurb && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>{meta.blurb}</div>}
            </div>
            <Button disabled={!!busy} onClick={() => connect(p)}>{busy === p ? "Opening..." : "Connect"}</Button>
          </Card>
        );
      })}

      {status && connected.length === 0 && available.length === 0 && (
        <Card><div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.6 }}>
          No device integrations are set up yet. Your coach needs to add the provider keys before trackers can be linked.
        </div></Card>
      )}

      <Card style={{ background: BRAND.card2 }}>
        <div style={{ color: BRAND.dim, fontSize: 12, lineHeight: 1.6 }}>
          Apple Health and Google Health Connect keep their data on the phone itself and can't be linked to a web app —
          if your steps only live there, keep entering them by hand.
        </div>
      </Card>
    </div>
  );
}
