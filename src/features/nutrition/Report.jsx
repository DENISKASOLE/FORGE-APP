import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { MacroBar } from "../../components/ui/MacroBar.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";

function ListCard({ label, color, items }) {
  if (!items?.length) return null;
  return (
    <Card style={{ padding: 16 }}>
      <SectionLabel color={color} style={{ marginBottom: 10 }}>{label}</SectionLabel>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color, fontWeight: 500, fontSize: 13, lineHeight: 1.6 }}>{color === T.good ? "✓" : "—"}</span>
            <span style={{ color: T.accent, fontSize: 13, fontWeight: 400, lineHeight: 1.6 }}>{item}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Report({ report, nutrition, onReCheck }) {
  if (!report) {
    return (
      <Card style={{ padding: 20 }}>
        <div style={{ color: T.muted, fontWeight: 400 }}>Your coach hasn't published a report yet. Check back soon.</div>
      </Card>
    );
  }

  const averages = report.averages || {};
  const targets = report.targets || {};

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <SectionLabel>{nutrition?.phase === "maintenance" ? "Maintenance" : "Your report"}</SectionLabel>
        <div style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: T.accent, marginTop: 4, lineHeight: 1.3 }}>{report.verdict}</div>
      </div>

      <Card style={{ padding: 16, display: "grid", gap: 12 }}>
        <SectionLabel color={T.muted}>Daily average vs target</SectionLabel>
        <MacroBar label="Calories" value={averages.calories} target={targets.calories} unit="" color={T.gold} />
        <MacroBar label="Protein" value={averages.protein} target={targets.protein} color={T.good} />
        <MacroBar label="Carbs" value={averages.carbs} target={targets.carbs} color={T.dim} />
        <MacroBar label="Fats" value={averages.fats} target={targets.fats} color={T.dim} />
      </Card>

      <ListCard label="What's working" color={T.good} items={report.working} />
      <ListCard label="Where it's going wrong" color={T.bad} items={report.issues} />

      {report.swaps?.length > 0 && (
        <Card style={{ padding: 16 }}>
          <SectionLabel color={T.muted} style={{ marginBottom: 10 }}>3 swaps to make</SectionLabel>
          <div style={{ display: "grid", gap: 10 }}>
            {report.swaps.map((s, i) => (
              <div key={i} style={{ borderTop: i > 0 ? `var(--hairline) solid ${T.lineSoft}` : "none", paddingTop: i > 0 ? 10 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  <span style={{ color: T.bad, textDecoration: "line-through" }}>{s.from}</span>
                  <span style={{ color: T.muted }}> → </span>
                  <span style={{ color: T.good }}>{s.to}</span>
                </div>
                {s.why && <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>{s.why}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {report.targetDay?.meals?.length > 0 && (
        <Card style={{ padding: 16 }}>
          <SectionLabel color={T.muted} style={{ marginBottom: 10 }}>Target day, meal by meal</SectionLabel>
          <div style={{ display: "grid", gap: 10 }}>
            {report.targetDay.meals.map((m, i) => (
              <div key={i} style={{ borderTop: i > 0 ? `var(--hairline) solid ${T.lineSoft}` : "none", paddingTop: i > 0 ? 10 : 0, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ color: T.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>{m.slot}</div>
                  <div style={{ color: T.accent, fontSize: 13, fontWeight: 400, marginTop: 2 }}>{m.description}</div>
                </div>
                {m.time && <div style={{ color: T.dim, fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{m.time}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {report.supplementReview && (
        <Card style={{ padding: 16 }}>
          <SectionLabel color={T.muted} style={{ marginBottom: 8 }}>Supplement review</SectionLabel>
          <div style={{ color: T.accent, fontSize: 13, fontWeight: 400, lineHeight: 1.6 }}>{report.supplementReview}</div>
        </Card>
      )}

      {report.nextStep && (
        <Card style={{ padding: 16, background: "var(--blue-bg)", border: `var(--hairline) solid var(--blue)` }}>
          <div style={{ color: "var(--blue)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>Next step</div>
          <div style={{ color: T.accent, fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{report.nextStep}</div>
        </Card>
      )}

      {onReCheck && (
        <Button onClick={onReCheck}>Start a re-check week</Button>
      )}
    </div>
  );
}
