import { useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { NavIcon } from "../../components/ui/NavIcon.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { useIsMobile } from "../../lib/browser.js";
import { DAYS } from "../../lib/dateUtils.js";
import { timeLabel } from "../../lib/clientData.js";
import { usePhotoUrl } from "../../lib/storage.js";

export function ScheduledView({ clients, selectClient }) {
  const isMobile = useIsMobile(520);
  const scheduled = clients.flatMap((client) => (client.schedule || []).map((s) => ({
    id: `${client.id}_${s.day}_${s.time}`,
    client,
    day: s.day,
    time: s.time,
  })));
  const dayIndex = Object.fromEntries(DAYS.map((d, i) => [d, i]));
  scheduled.sort((a, b) => (dayIndex[a.day] ?? 99) - (dayIndex[b.day] ?? 99) || String(a.time).localeCompare(String(b.time)));
  return (
    <div style={{ display: "grid", gap: isMobile ? 10 : 14, maxWidth: "100%", overflowX: "hidden" }}>
      <Card>
        <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text }}>Scheduled sessions</div>
        <div style={{ color: BRAND.muted, marginTop: 4, fontSize: 14, lineHeight: 1.6 }}>All recurring client sessions from client schedules. Tap a client row to open their profile.</div>
      </Card>
      {scheduled.length === 0 ? (
        <Card><div style={{ color: BRAND.muted }}>No scheduled sessions yet. Open a client, go to Schedule, and add their recurring days and times.</div></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
          {scheduled.map((s) => (
            <Card key={s.id} onClick={() => selectClient(s.client)} style={{ cursor: "pointer", borderColor: s.client.color }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ color: s.client.color, fontSize: 12, fontWeight: 500 }}>{s.day} · {timeLabel(s.time)}</div>
                  <div style={{ fontFamily: BRAND.display, fontSize: 19, fontWeight: 500 }}>{s.client.name}</div>
                  <div style={{ color: BRAND.muted, fontSize: 12 }}>{s.client.goals?.join(" + ") || s.client.goal}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: s.client.color, color: "#000", display: "grid", placeItems: "center", fontWeight: 500 }}>{s.client.avatar}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
export function ClientCard({ client, onClick }) {
  const isCompact = useIsMobile(520);
  const size = isCompact ? 146 : 162;
  const goals = client.goals?.join(" + ") || client.goal || "General Fitness";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: BRAND.sans,
        position: "relative",
        width: "100%",
        maxWidth: size,
        aspectRatio: "1 / 1",
        justifySelf: "center",
        borderRadius: "50%",
        border: `${BRAND.hairline} solid ${BRAND.line}`,
        background: BRAND.card,
        color: BRAND.text,
        cursor: "pointer",
        padding: isCompact ? 10 : 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: client.clientType === "Online" ? BRAND.blue : BRAND.gold,
        color: client.clientType === "Online" ? "#fff" : BRAND.btnInk,
        fontSize: 9,
        fontWeight: 500,
        borderRadius: 999,
        padding: "2px 7px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}>{client.clientType === "Online" ? "Online" : "1:1"}</div>
      <ClientAvatar client={client} size={isCompact ? 46 : 52} />
      <div style={{
        marginTop: 8,
        fontSize: isCompact ? 14 : 16,
        fontWeight: 500,
        lineHeight: 1.05,
        maxWidth: "92%",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>{client.name}</div>
      <div style={{
        color: client.color,
        fontSize: isCompact ? 10 : 11,
        fontWeight: 400,
        marginTop: 5,
        lineHeight: 1.18,
        maxWidth: "86%",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>{goals}</div>
      <div style={{
        color: BRAND.muted,
        fontSize: isCompact ? 11 : 12,
        fontWeight: 400,
        marginTop: 8,
        background: BRAND.card2,
        border: `${BRAND.hairline} solid ${BRAND.line}`,
        borderRadius: 999,
        padding: "5px 9px",
        maxWidth: "92%",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>{client.weight || 0}kg &middot; {client.age || 0} yrs</div>
    </button>
  );
}
export const CLIENT_BOTTOM_NAV = [
  { key: "home", label: "Home", icon: "home", group: ["home", "learn"] },
  { key: "program", label: "Train", icon: "train", group: ["program", "train_hub"] },
  { key: "nutrition", label: "Fuel", icon: "food", group: ["nutrition"] },
  { key: "progress_hub", label: "Progress", icon: "progress", group: ["progress_hub", "progress", "photos", "checkins", "measurements"] },
  { key: "me_hub", label: "Me", icon: "me", group: ["me_hub", "payments", "profile"] },
];
export function ClientBottomNav({ tab, setTab, unreadMessages }) {
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, background: BRAND.panel, borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}`, display: "flex", justifyContent: "space-around", paddingTop: 10, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      {CLIENT_BOTTOM_NAV.map((item) => {
        const active = item.group.includes(tab);
        return (
          <button key={item.key} onClick={() => setTab(item.key)} style={{ fontFamily: BRAND.sans, background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1, minWidth: 0, position: "relative", padding: 0 }}>
            <div style={{ width: 42, height: 28, borderRadius: 999, background: active ? `color-mix(in srgb, ${BRAND.gold} 14%, transparent)` : "transparent", display: "grid", placeItems: "center" }}>
              <NavIcon name={item.icon} size={22} color={active ? BRAND.gold : BRAND.dim} />
              {item.key === "me_hub" && unreadMessages > 0 && <div style={{ position: "absolute", top: -2, right: 6, width: 16, height: 16, borderRadius: "50%", background: BRAND.yellow, color: "#000", fontSize: 9, fontWeight: 500, display: "grid", placeItems: "center", border: `2px solid ${BRAND.panel}` }}>{unreadMessages > 9 ? "9+" : unreadMessages}</div>}
            </div>
            <div style={{ fontSize: 9, fontWeight: active ? 500 : 400, whiteSpace: "nowrap", color: active ? BRAND.gold : BRAND.dim }}>{item.label}</div>
          </button>
        );
      })}
    </div>
  );
}
export function HubScreen({ title, subtitle, cards, onOpen }) {
  return (
    <div>
      <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 2 }}>{title}</div>
      <div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 400, marginBottom: 16 }}>{subtitle}</div>
      {cards.map((c) => (
        <button key={c.key} onClick={() => onOpen(c.key)} style={{ fontFamily: BRAND.sans, width: "100%", textAlign: "left", background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: `color-mix(in srgb, ${c.color} 18%, transparent)`, display: "grid", placeItems: "center", flexShrink: 0 }}><NavIcon name={c.icon} size={24} color={c.color} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: BRAND.text, fontWeight: 500, fontSize: 15 }}>{c.title}</div>
            <div style={{ color: c.alert ? BRAND.yellow : BRAND.muted, fontWeight: 400, fontSize: 12, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.sub}</div>
          </div>
          <NavIcon name="back" size={16} color={BRAND.dim} rotate={180} />
        </button>
      ))}
    </div>
  );
}
export function ClientAvatar({ client, size = 54 }) {
  const photoUrl = usePhotoUrl(client.photo);
  return <div style={{ fontFamily: BRAND.display, width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", background: photoUrl ? BRAND.card2 : client.color, color: "#000", fontWeight: 500, fontSize: size * 0.4, overflow: "hidden", flexShrink: 0, border: `2px solid ${client.color}` }}>{photoUrl ? <img src={photoUrl} alt={client.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (client.avatar || (client.name ? client.name[0] : "?"))}</div>;
}
export function ClientSettingsModal({ client, onClose }) {
  const [changing, setChanging] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  async function updatePassword() {
    if (!newPassword || newPassword.length < 6) { setMessage("Password must be at least 6 characters."); return; }
    setChanging(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setMessage(error ? error.message : "Password updated.");
    setChanging(false);
    setNewPassword("");
  }
  async function logout() {
    await supabase.auth.signOut();
    onClose();
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: BRAND.display, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>Settings</div>
            <div style={{ color: BRAND.muted, fontSize: 14 }}>{client.name}</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <Field label="New password" value={newPassword} onChange={setNewPassword} type="password" placeholder="At least 6 characters" />
        {message && <div style={{ color: message.includes("updated") ? BRAND.green : BRAND.yellow, fontWeight: 500, marginTop: 10, fontSize: 13 }}>{message}</div>}
        <Button disabled={changing} onClick={updatePassword} style={{ marginTop: 12, width: "100%" }}>{changing ? "Updating..." : "Update password"}</Button>
        <div style={{ borderTop: `${BRAND.hairline} solid ${BRAND.line}`, marginTop: 18, paddingTop: 16 }}>
          <Button variant="red" onClick={logout} style={{ width: "100%" }}>Log out</Button>
        </div>
      </Card>
    </div>
  );
}
