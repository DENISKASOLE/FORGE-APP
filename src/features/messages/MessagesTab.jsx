import { useEffect, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { upsertSection } from "../../lib/clientData.js";

export function MessagesTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [messages, setMessages] = useState(client.messages || []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const unread = messages.filter((m) => (isCoach ? m.from === "client" : m.from === "coach") && !m.read);
    if (unread.length > 0) {
      const marked = messages.map((m) => (unread.some((u) => u.id === m.id) ? { ...m, read: true } : m));
      setMessages(marked);
      upsertSection(client.id, "messages", { list: marked });
      updateClient({ ...client, messages: marked });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const entry = { id: uid(), from: isCoach ? "coach" : "client", text: text.trim(), date: new Date().toISOString(), read: false };
    const next = [...messages, entry];
    setMessages(next);
    setText("");
    await upsertSection(client.id, "messages", { list: next });
    updateClient({ ...client, messages: next });
    setSending(false);
  }
  return (
    <Card style={{ padding: isMobile ? 12 : 16, display: "flex", flexDirection: "column", height: isMobile ? "60vh" : "65vh" }}>
      <div style={{ fontSize: 20, fontWeight: 1000, marginBottom: 10 }}>Messages</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
        {messages.length === 0 && <div style={{ color: BRAND.muted, textAlign: "center", marginTop: 30 }}>No messages yet. Say hello.</div>}
        {messages.map((m) => {
          const mine = (isCoach && m.from === "coach") || (!isCoach && m.from === "client");
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              <div style={{ background: mine ? client.color : BRAND.card2, color: mine ? "#000" : BRAND.text, borderRadius: 16, padding: "8px 12px", fontWeight: mine ? 800 : 600 }}>{m.text}</div>
              <div style={{ color: BRAND.muted, fontSize: 10, marginTop: 2, textAlign: mine ? "right" : "left" }}>{m.from === "coach" ? "Coach" : client.name} &middot; {new Date(m.date).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." style={inputStyle()} />
        <Button onClick={send} disabled={sending}>Send</Button>
      </div>
    </Card>
  );
}
