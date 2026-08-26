import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { Chip } from "../../components/ui/Chip.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { uid } from "../../lib/uid.js";
import { SUPPLEMENT_PRESETS, SUPPLEMENT_TIMINGS } from "../../lib/nutrition.js";

export function SupplementStack({ nutrition, onSave, onContinue }) {
  const [stack, setStack] = useState(nutrition.supplement_stack || []);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [timing, setTiming] = useState("any");
  const [saving, setSaving] = useState(false);

  const addedNames = new Set(stack.map((s) => s.name.toLowerCase()));

  function addItem(item) {
    setStack((s) => [...s, { id: uid(), ...item }]);
  }
  function addPreset(preset) {
    if (addedNames.has(preset.name.toLowerCase())) return;
    addItem(preset);
  }
  function addCustom() {
    if (!name.trim()) return;
    addItem({ name: name.trim(), dose: dose.trim(), timing });
    setName(""); setDose(""); setTiming("any");
  }
  function removeItem(id) {
    setStack((s) => s.filter((x) => x.id !== id));
  }
  async function save() {
    setSaving(true);
    await onSave(stack);
    setSaving(false);
    onContinue?.();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <SectionLabel>Setup · Step 1 of 2</SectionLabel>
        <div style={{ fontSize: 26, fontWeight: 800, color: T.accent, marginTop: 4 }}>Your supplement stack</div>
        <div style={{ color: T.muted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Log what you're already taking so your coach can factor it into your plan. Protein powder goes in your meals, not here.
        </div>
      </div>

      <Card style={{ display: "grid", gap: 10 }}>
        <SectionLabel color={T.muted}>Quick add</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUPPLEMENT_PRESETS.map((p) => (
            <Chip key={p.name} selected={addedNames.has(p.name.toLowerCase())} onClick={() => addPreset(p)}>
              {p.name}
            </Chip>
          ))}
        </div>
      </Card>

      <Card style={{ display: "grid", gap: 12 }}>
        <SectionLabel color={T.muted}>Add your own</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <Field label="Name" value={name} onChange={setName} placeholder="e.g. Ashwagandha" />
          <Field label="Dose" value={dose} onChange={setDose} placeholder="e.g. 600mg" />
        </div>
        <div>
          <div style={{ color: T.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>Timing</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUPPLEMENT_TIMINGS.map((t) => (
              <Chip key={t.key} selected={timing === t.key} onClick={() => setTiming(t.key)}>{t.label}</Chip>
            ))}
          </div>
        </div>
        <Button variant="dark" onClick={addCustom}>+ Add to stack</Button>
      </Card>

      {stack.length > 0 && (
        <Card style={{ display: "grid", gap: 8 }}>
          <SectionLabel color={T.muted}>Your stack ({stack.length})</SectionLabel>
          {stack.map((item) => {
            const timingLabel = SUPPLEMENT_TIMINGS.find((t) => t.key === item.timing)?.label || item.timing;
            return (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${T.line}`, paddingTop: 8 }}>
                <div>
                  <div style={{ color: T.accent, fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                  <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>{item.dose}{item.dose ? " · " : ""}{timingLabel}</div>
                </div>
                <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: T.bad, fontWeight: 800, fontSize: 18, cursor: "pointer" }}>×</button>
              </div>
            );
          })}
        </Card>
      )}

      <Button onClick={save} disabled={saving} style={{ background: T.gold }}>
        {saving ? "Saving..." : stack.length ? "Continue" : "I don't take anything — continue"}
      </Button>
    </div>
  );
}
