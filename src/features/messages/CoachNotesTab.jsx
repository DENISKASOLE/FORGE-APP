import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { uid } from "../../lib/uid.js";
import { upsertSection } from "../../lib/clientData.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";

// Coach-only notes per client (Nov 2026: replaces the coach's Messages tab -
// Denis was using messages as a scratchpad for session notes). Stored in the
// `coach_notes` section; the client app never renders it.
export function CoachNotesTab({ client, updateClient }) {
  const [notes, setNotes] = useState(client.coachNotes || []);
  // Full-screen editor: null when closed, else { id (null = new), text }.
  const [editor, setEditor] = useState(null);

  async function save(next) {
    setNotes(next);
    updateClient({ ...client, coachNotes: next });
    await upsertSection(client.id, "coach_notes", { list: next });
  }
  function commit() {
    const t = editor.text.trim();
    if (!t) { setEditor(null); return; }
    const now = new Date().toISOString();
    save(editor.id
      ? notes.map((n) => (n.id === editor.id ? { ...n, text: t, edited: now } : n))
      : [{ id: uid(), text: t, date: now }, ...notes]);
    setEditor(null);
  }
  async function remove(n) {
    if (!(await confirmDialog("Delete this note?", { danger: true, confirmLabel: "Delete" }))) return;
    save(notes.filter((x) => x.id !== n.id));
  }
  const fmt = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (editor) {
    return (
      <div className="fx-push" style={{ position: "fixed", inset: 0, zIndex: 1200, background: "var(--page)", display: "flex", flexDirection: "column", height: "100dvh",
        paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${BRAND.line}` }}>
          <button onClick={() => setEditor(null)} style={linkBtn(BRAND.muted, 16)}>Cancel</button>
          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.text }}>{editor.id ? "Edit note" : "New note"}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: BRAND.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name} · 🔒 only you</div>
          </div>
          <button onClick={commit} disabled={!editor.text.trim()} style={{ ...linkBtn(BRAND.gold, 16), opacity: editor.text.trim() ? 1 : 0.4 }}>Save</button>
        </div>
        <textarea value={editor.text} onChange={(e) => setEditor({ ...editor, text: e.target.value })} autoFocus
          placeholder="Write your note…"
          style={{ flex: 1, width: "100%", boxSizing: "border-box", resize: "none", border: "none", outline: "none", background: "transparent", color: BRAND.text, padding: "16px 18px", fontSize: 17, lineHeight: 1.55, fontFamily: BRAND.sans }} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: BRAND.text }}>Notes</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.muted }}>🔒 Only you see these</div>
        </div>
        <Button onClick={() => setEditor({ id: null, text: "" })} style={{ width: "100%", fontWeight: 700 }}>+ New note</Button>
      </Card>

      {notes.length === 0 && <div style={{ color: BRAND.muted, fontSize: 14, textAlign: "center", padding: "18px 0" }}>No notes for {client.name} yet.</div>}

      {notes.map((n) => (
        <Card key={n.id} flat style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.gold }}>{fmt(n.date)}{n.edited ? <span style={{ color: BRAND.dim, fontWeight: 500 }}> · edited</span> : null}</div>
            <div style={{ display: "flex", gap: 14 }}>
              <button onClick={() => setEditor({ id: n.id, text: n.text })} style={linkBtn(BRAND.muted)}>Edit</button>
              <button onClick={() => remove(n)} style={linkBtn(BRAND.yellow)}>Delete</button>
            </div>
          </div>
          <button onClick={() => setEditor({ id: n.id, text: n.text })} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 15, lineHeight: 1.5, color: BRAND.text, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{n.text}</button>
        </Card>
      ))}
    </div>
  );
}
function linkBtn(color, size = 13) {
  return { background: "none", border: "none", padding: "6px 2px", color, fontSize: size, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
}
