import { useState } from "react";
import { T } from "../../theme/tokens.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { SectionLabel } from "../../components/ui/SectionLabel.jsx";
import { dayTotals, roundMacros } from "./planMath.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { buildNutritionPlanPDF, sharePdfBlob, safeFilename } from "../../lib/pdf.js";

const DOW_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ScheduleStrip({ schedule, days }) {
  const nameById = Object.fromEntries(days.map((d) => [d.id, d]));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
      {DOW_KEYS.map((k, i) => {
        const d = nameById[schedule?.[k]];
        return (
          <div key={k} style={{ textAlign: "center" }}>
            <div style={{ color: T.dim, fontSize: 10, fontWeight: 600 }}>{DOW_LABELS[i]}</div>
            <div style={{ color: d?.type === "training" ? T.accent : T.muted, fontSize: 10, fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d ? d.name : "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

function PlanDayReadout({ day }) {
  const totals = roundMacros(dayTotals(day));
  const meals = (day.blocks || []).filter((b) => b.type === "meal");
  return (
    <div style={{ display: "grid", gap: 8, paddingTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted }}>
        <span>{day.name} · {day.type}</span>
        <span>{totals.kcal} kcal · {totals.protein}P / {totals.carbs}C / {totals.fat}F</span>
      </div>
      {meals.map((meal) => (
        <div key={meal.id} style={{ borderTop: `${T.hairline} solid ${T.line}`, paddingTop: 8 }}>
          <div style={{ color: T.accent, fontSize: 12, fontWeight: 600 }}>{meal.time} · {meal.name}</div>
          <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
            {meal.items.map((it) => `${it.food.name} ${it.amount}${it.food.unit === "piece" ? "" : it.food.unit}`).join(" · ") || "No foods yet"}
          </div>
        </div>
      ))}
    </div>
  );
}

function SignedPlanCard({ client, plan, active }) {
  const [viewing, setViewing] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const blob = await buildNutritionPlanPDF(client, plan);
      await sharePdfBlob(blob, `Forge-Nutrition-Plan-${safeFilename(client.name)}-v${plan.version}.pdf`, plan.doc.name);
    } catch (e) {
      showToast(e.message || "Couldn't build the PDF.", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card style={{ padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{plan.doc.name} <span style={{ color: T.dim, fontWeight: 500, fontSize: 12 }}>· V{plan.version}</span></div>
          <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{active ? "Active" : "Archived"} · signed {fmtDate(plan.signedAt)} · starts {fmtDate(plan.startDate)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="dark" onClick={downloadPdf} disabled={downloading}>{downloading ? "Building..." : "PDF"}</Button>
          <Button variant="dark" onClick={() => setViewing((v) => !v)}>{viewing ? "Hide" : "View"}</Button>
        </div>
      </div>
      {plan.coachNote && <div style={{ color: T.muted, fontSize: 12, fontStyle: "italic" }}>"{plan.coachNote}"</div>}
      {viewing && (
        <div style={{ display: "grid", gap: 10 }}>
          <ScheduleStrip schedule={plan.schedule} days={plan.doc.days} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {plan.doc.days.map((d, i) => (
              <button key={d.id} onClick={() => setDayIdx(i)} style={{ padding: "5px 10px", borderRadius: 999, border: `${T.hairline} solid ${i === dayIdx ? T.accent : T.line}`, background: i === dayIdx ? T.card2 : "transparent", color: i === dayIdx ? T.accent : T.muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{d.name}</button>
            ))}
          </div>
          <PlanDayReadout day={plan.doc.days[Math.min(dayIdx, plan.doc.days.length - 1)]} />
        </div>
      )}
    </Card>
  );
}

// Coach-facing view for tracking_mode === "prescribed_plan" (spec §5.6).
// Phase 5 scope is deliberately just the plan card + read-only history -
// the adherence strip / day-by-day log detail need real log data, which
// only starts flowing once the client Fuel UI (Phase 6) ships, so building
// that chrome now would just show empty state forever.
export function CoachPlanView({ client }) {
  const plan = client.nutritionPlan;
  const active = plan?.active;
  const history = plan?.history || [];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SectionLabel color={T.muted}>Nutrition plan</SectionLabel>
      {!active ? (
        <Card style={{ padding: 14, color: T.muted, fontSize: 13 }}>No plan signed yet. Build one in Tools → Nutrition Plans, then Assign to Client.</Card>
      ) : (
        <SignedPlanCard client={client} plan={active} active />
      )}
      {history.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <SectionLabel color={T.muted}>Plan history</SectionLabel>
          {[...history].reverse().map((p) => <SignedPlanCard key={p.version} client={client} plan={p} active={false} />)}
        </div>
      )}
    </div>
  );
}
