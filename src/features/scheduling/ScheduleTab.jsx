import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { DAYS } from "../../lib/dateUtils.js";
import { DEFAULT_TIME_SLOTS } from "../../lib/constants.js";
import { timeLabel, upsertSection, makeInviteCode } from "../../lib/clientData.js";
import { updateClientRow } from "../../lib/cache.js";

export function ScheduleTab({ client, updateClient }) {
  const isMobile = useIsMobile(520);
  const [schedule, setSchedule] = useState(client.schedule || []);
  const [form, setForm] = useState({ day: "Mon", time: DEFAULT_TIME_SLOTS[0] });
  async function save(next) { setSchedule(next); await upsertSection(client.id, "sessions", { schedule: next, checkIns: client.legacyCheckIns || [], sessions: client.sessions || 0 }); updateClient({ ...client, schedule: next }); }
  return (
    <Card style={{ padding: isMobile ? 12 : 16 }}>
      <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 12 }}>Recurring Schedule</div>
      <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>These recurring times automatically appear in the main Calendar.</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap: 8 }}>
        <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} style={inputStyle()}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
        <select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle()}>{DEFAULT_TIME_SLOTS.map((t, i) => <option key={`${t}_${i}`} value={t}>{timeLabel(t)}</option>)}</select>
        <Button onClick={() => save([...schedule, { ...form, id: uid() }])}>Add</Button>
      </div>
      <div style={{ marginTop: 12 }}>
        {schedule.length === 0 ? (
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, textAlign: "center", padding: "18px 0" }}>No recurring sessions yet. Add a day and time above.</div>
        ) : schedule.map((s, i) => (
          <div key={s.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}`, padding: "12px 0" }}>
            <span style={{ fontFamily: BRAND.sans, fontWeight: 500, fontSize: 14, color: BRAND.text }}>{s.day} · {timeLabel(s.time)}</span>
            <Button variant="red" onClick={() => save(schedule.filter((_, j) => j !== i))}>x</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
// WhatsApp share link to the client's number (or a plain share sheet).
function waLink(phone, text) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
// Reset codes are 8 characters (invite codes are 6) - the server only
// accepts an 8-character code for a password reset (forge-auth).
function makeResetCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => abc[b % 32]).join("");
}
export function InviteTab({ client, updateClient }) {
  const [code, setCode] = useState(client.inviteCode || makeInviteCode());
  const [resetCode, setResetCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveInvite() { await updateClientRow(client.id, { invite_code: code, invite_status: "sent" }); updateClient({ ...client, inviteCode: code, inviteStatus: "sent" }); }
  async function makeReset() {
    setBusy(true);
    const next = makeResetCode();
    try {
      await updateClientRow(client.id, { invite_code: next });
      updateClient({ ...client, inviteCode: next });
      setResetCode(next);
    } finally { setBusy(false); }
  }
  const origin = window.location.origin;
  const link = `${origin}?invite=${code}`;
  const first = (client.name || "").split(" ")[0] || "there";
  const inviteMsg = `Hi ${first}! Here's your Forge app invite: ${link}\nOpen it, choose a password and you're in.`;
  const resetMsg = `Hi ${first}, here's your Forge password reset code: ${resetCode}\nOpen ${origin}, tap "Forgot Password?", then "I have a code from my coach", and enter your email (${client.email || "your email"}), this code and a new password.`;
  const label = { fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 12 };
  const wa = { display: "block", textAlign: "center", marginTop: 10, padding: "12px 16px", borderRadius: 999, background: "#25D366", color: "#fff", fontFamily: BRAND.sans, fontWeight: 600, fontSize: 15, textDecoration: "none" };
  if (client.client_user_id) {
    return (
      <Card>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 8 }}>Login & password</div>
        <div style={label}>{client.name} has an account{client.email ? <> ({client.email})</> : null}. If they can't log in or the reset email didn't arrive, make a reset code and send it to them. It works once.</div>
        <Button onClick={makeReset} disabled={busy}>{busy ? "…" : resetCode ? "Make a new code" : "Reset password"}</Button>
        {resetCode && (
          <>
            <div style={{ fontFamily: BRAND.display, fontSize: 30, fontWeight: 700, letterSpacing: ".18em", textAlign: "center", color: BRAND.text, margin: "16px 0 4px" }}>{resetCode}</div>
            <div style={{ ...label, textAlign: "center", marginBottom: 0 }}>They enter it under Forgot Password? → I have a code from my coach.</div>
            {client.phone ? <a href={waLink(client.phone, resetMsg)} target="_blank" rel="noreferrer" style={wa}>Send on WhatsApp</a> : null}
          </>
        )}
      </Card>
    );
  }
  return (
    <Card>
      <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 8 }}>Invite Client</div>
      <div style={label}>Client opens this link, picks a password and is straight in - no confirmation email.</div>
      <Field label="Invite Code" value={code} onChange={(v) => setCode(v.toUpperCase())} />
      <Button onClick={saveInvite} style={{ marginTop: 10 }}>Save Invite</Button>
      <div style={{ fontFamily: BRAND.sans, marginTop: 12, color: BRAND.green, fontSize: 13, wordBreak: "break-all" }}>{link}</div>
      {client.phone ? <a href={waLink(client.phone, inviteMsg)} target="_blank" rel="noreferrer" onClick={saveInvite} style={wa}>Send on WhatsApp</a> : null}
    </Card>
  );
}
