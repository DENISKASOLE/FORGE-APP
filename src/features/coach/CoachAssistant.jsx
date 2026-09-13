import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { generateProgramFromAI, suggestProgramSwaps, applyProgramSwaps } from "../../lib/ai.js";

const sectionLabel = { color: BRAND.gold, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 };
const boxStyle = { background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 12, marginTop: 12 };

// Neither AI call here writes anything - generateProgramFromAI returns a
// hydrated program object, suggestProgramSwaps returns a reviewable list.
// onApply hands the result to ProgramTab, which opens it in ProgramBuilder -
// the coach's own "Save Program" click is the only thing that ever persists
// it, same as building one by hand.
export function CoachAssistantModal({ client, program, onClose, onApply }) {
  const isMobile = useIsMobile(520);
  const hasProgram = !!(program?.weeks?.some((w) => w.workouts?.length));

  const [createText, setCreateText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  const [editText, setEditText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [editResult, setEditResult] = useState(null);
  const [checked, setChecked] = useState({});

  async function runCreate() {
    if (!createText.trim()) return;
    setCreating(true);
    setCreateResult(null);
    try {
      const result = await generateProgramFromAI(client, createText.trim());
      setCreateResult(result);
    } catch (e) {
      showToast(e.message || "Couldn't generate a program.", "error");
    }
    setCreating(false);
  }

  async function runSuggest() {
    if (!editText.trim()) return;
    setSuggesting(true);
    setEditResult(null);
    try {
      const result = await suggestProgramSwaps(client, program, editText.trim());
      setEditResult(result);
      const initial = {};
      result.swaps.forEach((_, i) => { initial[i] = true; });
      setChecked(initial);
    } catch (e) {
      showToast(e.message || "Couldn't get suggestions.", "error");
    }
    setSuggesting(false);
  }

  function applySwaps() {
    const accepted = editResult.swaps.filter((_, i) => checked[i]);
    if (!accepted.length) { showToast("Nothing selected to apply.", "warn"); return; }
    onApply(applyProgramSwaps(program, accepted));
  }

  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto", padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 500, color: BRAND.gold }}>Coach Assistant</div>
            <div style={{ color: BRAND.muted }}>Ask in plain language. Nothing saves until you review it in Program Builder.</div>
          </div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>

        <div style={boxStyle}>
          <div style={sectionLabel}>Create a new program</div>
          <textarea value={createText} onChange={(e) => setCreateText(e.target.value)} placeholder='e.g. "Create a 3-day full body program for hypertrophy, avoid overhead pressing"' rows={2} style={inputStyle({ resize: "vertical" })} />
          <Button onClick={runCreate} disabled={creating} style={{ marginTop: 8 }}>{creating ? "Thinking..." : "Generate Program"}</Button>
          {createResult && (
            <div style={{ marginTop: 12, background: BRAND.panel, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 10 }}>
              <div style={{ color: BRAND.text, fontSize: 13, marginBottom: 8 }}>{createResult.summary}</div>
              <div style={{ color: BRAND.dim, fontSize: 12, marginBottom: 10 }}>
                {createResult.program.name} · {createResult.program.weeks.length} weeks
                {createResult.program.weeks[0] && ` · ${createResult.program.weeks[0].workouts.length} workouts/week`}
              </div>
              <Button onClick={() => onApply(createResult.program)}>Open in Program Builder</Button>
            </div>
          )}
        </div>

        {hasProgram && (
          <div style={boxStyle}>
            <div style={sectionLabel}>Suggest changes to the current program</div>
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} placeholder='e.g. "Modify this workout because of knee pain"' rows={2} style={inputStyle({ resize: "vertical" })} />
            <Button onClick={runSuggest} disabled={suggesting} style={{ marginTop: 8 }}>{suggesting ? "Thinking..." : "Suggest Swaps"}</Button>
            {editResult && (
              <div style={{ marginTop: 12, background: BRAND.panel, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 10 }}>
                <div style={{ color: BRAND.text, fontSize: 13, marginBottom: 8 }}>{editResult.note}</div>
                {editResult.swaps.length === 0 ? (
                  <div style={{ color: BRAND.muted, fontSize: 13 }}>No changes suggested.</div>
                ) : (
                  <>
                    {editResult.swaps.map((s, i) => (
                      <label key={i} style={{ display: "flex", gap: 8, alignItems: "start", padding: "6px 0", borderTop: i ? `${BRAND.hairline} solid ${BRAND.line}` : "none" }}>
                        <input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked((prev) => ({ ...prev, [i]: e.target.checked }))} style={{ marginTop: 3 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: BRAND.text }}>
                            <span style={{ color: BRAND.dim }}>{s.workoutName}:</span> {s.exerciseName} <span style={{ color: BRAND.dim }}>→</span> {s.suggestedReplacement}
                          </div>
                          <div style={{ fontSize: 12, color: BRAND.muted }}>{s.reason}</div>
                        </div>
                      </label>
                    ))}
                    <Button onClick={applySwaps} style={{ marginTop: 10 }}>Apply selected & open in Builder</Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
