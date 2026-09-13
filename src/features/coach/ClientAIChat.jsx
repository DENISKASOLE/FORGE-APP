import { useEffect, useRef, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { upsertSection } from "../../lib/clientData.js";
import { sendClientChatMessage } from "../../lib/ai.js";

const STARTERS = ["Why am I not progressing?", "What should I eat tonight?", "Give me a high-protein meal using what I have."];

// Open-ended AI chat, grounded in this client's own training/nutrition/
// program data (see sendClientChatMessage). Persisted separately from
// MessagesTab's client.messages so an AI thread never mixes with real
// human coach<->client messages.
export function ClientAIChat({ client, updateClient }) {
  const isMobile = useIsMobile(520);
  const [messages, setMessages] = useState(client.aiChat || []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages, sending]);

  async function persist(next) {
    setMessages(next);
    updateClient({ ...client, aiChat: next });
    const { error } = await upsertSection(client.id, "ai_chat", { list: next });
    if (error) showToast(error.message || "Couldn't save this chat.", "error");
  }

  async function send(overrideText) {
    const value = (overrideText ?? text).trim();
    if (!value || sending) return;
    const userMsg = { id: uid(), role: "user", text: value, at: new Date().toISOString() };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setText("");
    setSending(true);
    try {
      const reply = await sendClientChatMessage(client, messages, value);
      const aiMsg = { id: uid(), role: "model", text: reply, at: new Date().toISOString() };
      await persist([...withUser, aiMsg]);
    } catch (e) {
      showToast(e.message || "The AI coach didn't respond - try again.", "error");
      setMessages(withUser);
    }
    setSending(false);
  }

  return (
    <Card style={{ padding: isMobile ? 12 : 16, display: "flex", flexDirection: "column", height: isMobile ? "70vh" : "72vh" }}>
      <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 4 }}>AI Coach</div>
      <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 12 }}>Ask about your training or nutrition. For injuries or program changes, message your coach directly.</div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
        {messages.length === 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ color: BRAND.muted, fontSize: 14, textAlign: "center", marginBottom: 14 }}>Ask me anything about your training or nutrition.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} style={{ fontFamily: BRAND.sans, textAlign: "left", background: BRAND.card2, color: BRAND.text, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", minWidth: 0 }}>
            <div style={{ fontFamily: BRAND.sans, background: m.role === "user" ? client.color : BRAND.card2, color: m.role === "user" ? "#000" : BRAND.text, borderRadius: 16, padding: "10px 13px", fontWeight: 400, fontSize: 14, lineHeight: 1.5, overflowWrap: "break-word", whiteSpace: "pre-wrap" }}>{m.text}</div>
          </div>
        ))}
        {sending && <div style={{ alignSelf: "flex-start", color: BRAND.muted, fontSize: 13, padding: "0 4px" }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask your AI coach..." disabled={sending} style={inputStyle({ flex: 1, minWidth: 0 })} />
        <Button onClick={() => send()} disabled={sending}>Send</Button>
      </div>
    </Card>
  );
}
