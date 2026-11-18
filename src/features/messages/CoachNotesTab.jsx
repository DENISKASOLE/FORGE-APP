import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { uid } from "../../lib/uid.js";
import { upsertSection } from "../../lib/clientData.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";

// Coach-only notes per client (Nov 2026: replaces the coach's Messages tab -
// Denis was using messages as a scratchpad for session notes). Stored in the
// `coach_notes` section; the client app never renders it.
export function CoachNotesTab({ client, updateClient }) {
  const [notes, setNotes] = useState(client.coachNotes || []);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  async function save(next) {
    setNotes(next);
    updateClient({ ...client, coachNotes: next });
    await upsertSection(client.id, "coach_notes", { list: next });
  }
  function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    save([{ id: uid(), text: t, date: new Date().toISOString() }, ...notes]);
  }
  function saveEdit() {
    const t = editText.trim();
    if (!t) return;
    save(notes.map((n) => (n.id === editId ? { ...n, text: t, edited: new Date().toISOString() } : n)));
    setEditId(null);
  }
  async function remove(n) {
    if (!(await confirmDialog("Delete this note?", { danger: true, confirmLabel: "Delete" }))) return;
    save(notes.filter((x) => x.id !== n.id));
  }
  const fmt = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const area = (v, set, auto) => (
    <textarea value={v} onChange={(e) => set(e.target.value)} autoFocus={auto} rows={3} placeholder="e.g. A1 split squat 2x12 @ 16kg, left knee caving - cue it next session"
      style={inputStyle({ width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 84, fontSize: 16, lineHeight: 1.45, fontFamily: BRAND.sans })} />
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: BRAND.text }}>Notes</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.muted }}>🔒 Only you see these</div>
        </div>
        {area(text, setText, false)}
        <Button onClick={add} disabled={!text.trim()} style={{ width: "100%", marginTop: 8, fontWeight: 700 }}>Save note</Button>
      </Card>

      {notes.length === 0 && <div style={{ color: BRAND.muted, fontSize: 14, textAlign: "center", padding: "18px 0" }}>No notes for {client.name} yet.</div>}

      {notes.map((n) => (
        <Card key={n.id} flat style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.gold }}>{fmt(n.date)}{n.edited ? <span style={{ color: BRAND.dim, fontWeight: 500 }}> · edited</span> : null}</div>
            {editId !== n.id && (
              <div style={{ display: "flex", gap: 14 }}>
                <button onClick={() => { setEditId(n.id); setEditText(n.text); }} style={linkBtn(BRAND.muted)}>Edit</button>
                <button onClick={() => remove(n)} style={linkBtn(BRAND.yellow)}>Delete</button>
              </div>
            )}
          </div>
          {editId === n.id ? (
            <>
              {area(editText, setEditText, true)}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button variant="dark" onClick={() => setEditId(null)} style={{ flex: 1 }}>Cancel</Button>
                <Button onClick={saveEdit} disabled={!editText.trim()} style={{ flex: 1, fontWeight: 700 }}>Save</Button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 15, lineHeight: 1.5, color: BRAND.text, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{n.text}</div>
          )}
        </Card>
      ))}
    </div>
  );
}
function linkBtn(color) {
  return { background: "none", border: "none", padding: 0, color, fontSize: 13, fontWeight: 700, cursor: "pointer" };
}
