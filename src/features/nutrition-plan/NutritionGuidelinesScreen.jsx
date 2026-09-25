import { useEffect, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { loadStudioSettings, saveStudioSettings } from "../../lib/nutritionPlan.js";
import { seedGuidelines } from "./seedData.js";

// Ordered list, add/edit/delete/reorder (up/down buttons, same pattern
// ProgramBuilder already uses for block reordering rather than pulling in
// a drag-and-drop library for one short list - see docs/nutrition-recon.md
// on the @dnd-kit decision). Copied into every plan at sign time
// (PlanDoc.guidelines, spec §3/§5.3) - editing here never touches an
// already-signed plan.
export function NutritionGuidelinesScreen({ trainerId, onBack }) {
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await loadStudioSettings(trainerId);
      if (cancelled) return;
      if (!settings.guidelines || settings.guidelines.length === 0) {
        const seeded = seedGuidelines();
        await saveStudioSettings(trainerId, { guidelines: seeded });
        if (!cancelled) setGuidelines(seeded);
      } else {
        setGuidelines(settings.guidelines);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [trainerId]);

  async function persist(next) {
    setGuidelines(next);
    await saveStudioSettings(trainerId, { guidelines: next });
  }
  function add() {
    if (!draft.trim()) return;
    persist([...guidelines, draft.trim()]);
    setDraft("");
  }
  function saveEdit(i) {
    if (!editingText.trim()) return;
    persist(guidelines.map((g, gi) => (gi === i ? editingText.trim() : g)));
    setEditingIndex(null);
  }
  async function remove(i) {
    if (!await confirmDialog("Remove this guideline?", { danger: true, confirmLabel: "Remove" })) return;
    persist(guidelines.filter((_, gi) => gi !== i));
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= guidelines.length) return;
    const next = [...guidelines];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text }}>Nutrition guidelines</div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 2 }}>House rules, added to every plan automatically when it's signed.</div>
      </div>

      {loading ? (
        <Card><div style={{ color: BRAND.muted }}>Loading…</div></Card>
      ) : (
        <Card style={{ display: "grid", gap: 2 }}>
          {guidelines.length === 0 && <div style={{ color: BRAND.muted, padding: "8px 0" }}>No guidelines yet. Add your first one below.</div>}
          {guidelines.map((g, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: i ? `${BRAND.hairline} solid ${BRAND.line}` : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" style={{ background: "none", border: "none", color: i === 0 ? BRAND.dim : BRAND.muted, cursor: i === 0 ? "default" : "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>▲</button>
                <button onClick={() => move(i, 1)} disabled={i === guidelines.length - 1} aria-label="Move down" style={{ background: "none", border: "none", color: i === guidelines.length - 1 ? BRAND.dim : BRAND.muted, cursor: i === guidelines.length - 1 ? "default" : "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>▼</button>
              </div>
              {editingIndex === i ? (
                <>
                  <input value={editingText} onChange={(e) => setEditingText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit(i)} style={{ ...inputStyle(), flex: 1 }} autoFocus />
                  <Button onClick={() => saveEdit(i)} style={{ flexShrink: 0 }}>Save</Button>
                </>
              ) : (
                <>
                  <div onClick={() => { setEditingIndex(i); setEditingText(g); }} style={{ flex: 1, minWidth: 0, color: BRAND.text, fontSize: 13, cursor: "pointer", lineHeight: 1.5 }}>{g}</div>
                  <button onClick={() => remove(i)} aria-label="Remove" style={{ background: "none", border: "none", color: BRAND.red, fontSize: 18, cursor: "pointer", flexShrink: 0, padding: "0 4px" }}>×</button>
                </>
              )}
            </div>
          ))}
        </Card>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a guideline..." style={{ ...inputStyle(), flex: 1 }} />
        <Button onClick={add} style={{ flexShrink: 0 }}>Add</Button>
      </div>
    </div>
  );
}
