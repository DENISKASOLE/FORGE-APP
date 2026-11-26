// Coach "Messages" screen (Nov 26 2026): the day's WhatsApp messages,
// already written. Tap Send -> WhatsApp opens with the text typed -> send ->
// back in Forge the row is marked Sent and won't come back. Free, no API.
// Logic: lib/whatsappQueue.js. Stored in trainer_data section "whatsapp".
import { useEffect, useMemo, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { textareaStyle } from "../../components/ui/Field.jsx";
import { ClientAvatar } from "../client-shell/ClientShellUI.jsx";
import { useWhatsAppState } from "./useWhatsAppState.js";
import { updateClientRow } from "../../lib/cache.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { KINDS, buildQueue, mergedSettings, waLink, waNumber, DEFAULT_TEMPLATES } from "../../lib/whatsappQueue.js";

const WA_GREEN = "#25D366";
const kindLabel = Object.fromEntries(KINDS.map((k) => [k.kind, k.label]));

// Small card for the coach Home screen.
export function WhatsAppHomeCard({ trainerId, clients, onOpen }) {
  const [state] = useWhatsAppState(trainerId);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 5 * 60000); return () => clearInterval(t); }, []);
  const count = state ? buildQueue(clients, state.settings, state.done, now).length : null;
  return (
    <Card onClick={onOpen} style={{ padding: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: WA_GREEN, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z" /></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>Messages</div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 2 }}>
          {count == null ? "…" : count === 0 ? "All caught up" : `${count} WhatsApp message${count === 1 ? "" : "s"} ready`}
        </div>
      </div>
      {count > 0 && <div style={{ minWidth: 28, height: 28, padding: "0 8px", borderRadius: 999, background: WA_GREEN, color: "#fff", fontWeight: 700, fontSize: 13, display: "grid", placeItems: "center" }}>{count}</div>}
    </Card>
  );
}

// Inline "add a phone number" for clients who don't have one (Nov 26 2026).
function AddPhone({ client, updateClient }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    const value = phone.trim();
    if (!waNumber(value)) { showToast("That doesn't look like a phone number. Try e.g. 050 123 4567.", "warn"); return; }
    setBusy(true);
    try {
      await updateClientRow(client.id, { phone: value });
      updateClient?.({ ...client, phone: value });
      showToast(`Saved ${client.name.split(" ")[0]}'s number`, "success");
    } catch (e) {
      showToast(e?.message || "Couldn't save the number", "error");
    } finally { setBusy(false); }
  }
  return (
    <div style={{ display: "flex", gap: 8, flex: 1 }}>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} type="tel" inputMode="tel" placeholder="Add phone number" style={{ ...inputStyle(), flex: 1, minWidth: 0 }} />
      <Button onClick={save} disabled={busy} style={{ padding: "10px 16px" }}>{busy ? "…" : "Save"}</Button>
    </div>
  );
}

function MessageRow({ item, onSent, onSkip, updateClient }) {
  const [text, setText] = useState(item.text);
  const [editing, setEditing] = useState(false);
  const link = waLink(item.phone, text);
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ClientAvatar client={item.client} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.client.name}</div>
          <div style={{ color: BRAND.muted, fontSize: 12 }}>{kindLabel[item.kind]}</div>
        </div>
      </div>
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => setEditing(false)} autoFocus rows={3} style={{ ...textareaStyle(), marginTop: 10, width: "100%", boxSizing: "border-box" }} />
      ) : (
        <div onClick={() => setEditing(true)} title="Tap to edit" style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: BRAND.card2, border: `1px solid ${BRAND.line}`, fontSize: 14, lineHeight: 1.45, cursor: "text", whiteSpace: "pre-wrap" }}>{text}</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" onClick={() => setTimeout(() => onSent(item), 300)}
            style={{ flex: 1, textAlign: "center", padding: "12px 16px", borderRadius: 999, background: WA_GREEN, color: "#fff", fontFamily: BRAND.sans, fontWeight: 600, fontSize: 15, textDecoration: "none" }}>Send on WhatsApp</a>
        ) : (
          <AddPhone client={item.client} updateClient={updateClient} />
        )}
        <Button variant="ghost" onClick={() => onSkip(item)} style={{ padding: "10px 16px" }}>Skip</Button>
      </div>
    </Card>
  );
}

function SettingsPanel({ settings, clients, onChange, updateClient }) {
  const s = mergedSettings(settings);
  const set = (patch) => onChange({ ...settings, ...patch });
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {KINDS.map(({ kind, label, hint }) => (
        <Card key={kind} style={{ padding: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={s.enabled[kind]} onChange={(e) => set({ enabled: { ...s.enabled, [kind]: e.target.checked } })} style={{ width: 20, height: 20, accentColor: WA_GREEN }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
          </label>
          <div style={{ color: BRAND.muted, fontSize: 12, margin: "4px 0 8px 30px" }}>{hint}</div>
          <textarea value={s.templates[kind]} onChange={(e) => set({ templates: { ...s.templates, [kind]: e.target.value } })} rows={2} style={{ ...textareaStyle(), width: "100%", boxSizing: "border-box" }} />
          {s.templates[kind] !== DEFAULT_TEMPLATES[kind] && (
            <button onClick={() => set({ templates: { ...s.templates, [kind]: DEFAULT_TEMPLATES[kind] } })} style={{ marginTop: 6, background: "none", border: "none", padding: 0, color: BRAND.muted, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Reset to default</button>
          )}
        </Card>
      ))}
      <div style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.5 }}>{"{name}"} = first name · {"{time}"} = session time · {"{workout}"} = workout name · {"{date}"} = payment date</div>
      <Card style={{ padding: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Don't message</div>
        {(clients || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((c) => (
          <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", cursor: "pointer" }}>
            <input type="checkbox" checked={s.optOut.includes(c.id)} onChange={(e) => set({ optOut: e.target.checked ? [...s.optOut, c.id] : s.optOut.filter((x) => x !== c.id) })} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 14 }}>{c.name}</span>
            {!c.phone && <span style={{ color: BRAND.muted, fontSize: 12 }}>· no phone</span>}
          </label>
        ))}
      </Card>
      {(clients || []).some((c) => !waNumber(c.phone)) && (
        <Card style={{ padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Missing phone numbers</div>
          <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 10 }}>Add one so their messages get a Send button.</div>
          {(clients || []).filter((c) => !waNumber(c.phone)).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((c) => (
            <div key={c.id} style={{ padding: "8px 0", borderTop: `1px solid ${BRAND.line}` }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{c.name}</div>
              <AddPhone client={c} updateClient={updateClient} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export function WhatsAppMessagesScreen({ trainerId, clients, onBack, updateClient }) {
  const [state, save] = useWhatsAppState(trainerId);
  const [showSettings, setShowSettings] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const queue = useMemo(() => (state ? buildQueue(clients, state.settings, state.done, now) : []), [clients, state, now]);
  const doneToday = state ? Object.entries(state.done).filter(([, v]) => (v?.at || "").slice(0, 10) === now.toISOString().slice(0, 10) && v.how === "sent").length : 0;
  const mark = (item, how) => save({ ...state, done: { ...state.done, [item.key]: { at: new Date().toISOString(), how } } });
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Button variant="ghost" onClick={showSettings ? () => setShowSettings(false) : onBack} style={{ padding: "8px 14px" }}>‹ Back</Button>
        {!showSettings && <Button variant="ghost" onClick={() => setShowSettings(true)} style={{ padding: "8px 14px" }}>Settings</Button>}
      </div>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em" }}>{showSettings ? "Message settings" : "Messages"}</div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 3 }}>
          {showSettings ? "Choose which reminders appear and what they say." : `Tap Send, WhatsApp opens with the message typed - send it and come back.${doneToday ? ` ${doneToday} sent today.` : ""}`}
        </div>
      </div>
      {!state ? <div style={{ color: BRAND.muted, fontSize: 14 }}>Loading…</div>
        : showSettings ? <SettingsPanel settings={state.settings} clients={clients} updateClient={updateClient} onChange={(settings) => save({ ...state, settings })} />
        : queue.length === 0 ? (
          <Card style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>All caught up ✓</div>
            <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>New messages show up here as the day goes on: session reminders, follow-ups, missed workouts, check-ins and payments.</div>
          </Card>
        ) : queue.map((item) => <MessageRow key={item.key} item={item} updateClient={updateClient} onSent={(i) => mark(i, "sent")} onSkip={(i) => mark(i, "skipped")} />)}
    </div>
  );
}
