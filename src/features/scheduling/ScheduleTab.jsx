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
export function InviteTab({ client, updateClient }) {
  const [code, setCode] = useState(client.inviteCode || makeInviteCode());
  async function saveInvite() { await updateClientRow(client.id, { invite_code: code, invite_status: "sent" }); updateClient({ ...client, inviteCode: code, inviteStatus: "sent" }); }
  const link = `${window.location.origin}?invite=${code}`;
  return (
    <Card>
      <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 8 }}>Invite Client</div>
      <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>Client uses this code to claim the profile you created.</div>
      <Field label="Invite Code" value={code} onChange={(v) => setCode(v.toUpperCase())} />
      <Button onClick={saveInvite} style={{ marginTop: 10 }}>Save Invite</Button>
      <div style={{ fontFamily: BRAND.sans, marginTop: 12, color: BRAND.green, fontSize: 13, wordBreak: "break-all" }}>{link}</div>
    </Card>
  );
}
