// Coach -> client -> Nutrition -> "Food log" (Nov 27 2026): everything the
// client logged, day by day - plan meals, swaps, foods they searched or
// scanned, photo/description estimates - with or without a nutrition plan.
// Read-only.
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePhotoUrl } from "../../lib/storage.js";
import { BRAND } from "../../theme/tokens.js";
import { screenCard, screenLabel } from "../../components/ui/screenStyles.js";
import { isoDate } from "../../lib/dateUtils.js";
import { addDaysISO, loggedDayTotals, planVersionForDate } from "./nutritionV2Math.js";
import { MEAL_KEYS, MEAL_NAMES } from "./nutritionV2Model.js";

const SOURCE = { confirm: "From plan", sub: "Swap", search: "Own food", quick: "Quick add", photo: "Photo / description" };
const r = (v) => Math.round(Number(v) || 0);
const fmtDay = (iso, todayISO) => {
  if (iso === todayISO) return "Today";
  if (iso === addDaysISO(todayISO, -1)) return "Yesterday";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};
const navBtn = { width: 40, height: 40, borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, fontSize: 18, cursor: "pointer", display: "grid", placeItems: "center" };

// The client's meal photo: thumbnail in the entry, full screen on tap.
function MealPhoto({ path, alt }) {
  const url = usePhotoUrl(path);
  const [open, setOpen] = useState(false);
  if (!path) return null;
  return (
    <>
      <button onClick={() => url && setOpen(true)} aria-label={`Open photo of ${alt}`}
        style={{ display: "block", marginTop: 8, padding: 0, border: "none", borderRadius: 14, overflow: "hidden", cursor: url ? "zoom-in" : "default", background: BRAND.card2, width: "100%", maxWidth: 260, aspectRatio: "4 / 3" }}>
        {url ? <img src={url} alt={alt} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <span style={{ display: "grid", placeItems: "center", height: "100%", color: BRAND.muted, fontSize: 12 }}>Loading photo…</span>}
      </button>
      {open && createPortal(
        <div onClick={() => setOpen(false)} role="dialog" aria-label="Meal photo"
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,.92)", display: "grid", placeItems: "center", padding: 16, cursor: "zoom-out" }}>
          <img src={url} alt={alt} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} />
          <div style={{ position: "fixed", top: 16, right: 18, color: "#fff", fontSize: 28, lineHeight: 1 }}>×</div>
        </div>, document.body)}
    </>
  );
}

export function CoachFoodLog({ plans, logs }) {
  const todayISO = isoDate();
  // Open on the most recent day with food logged (today if anything's there).
  const lastLogged = useMemo(() => Object.keys(logs || {}).filter((d) => (logs[d] || []).length && d <= todayISO).sort().pop(), [logs, todayISO]);
  const [dateISO, setDateISO] = useState(() => ((logs?.[todayISO] || []).length ? todayISO : lastLogged || todayISO));
  const entries = logs?.[dateISO] || [];
  const totals = loggedDayTotals(entries);
  const target = planVersionForDate(plans, dateISO)?.targets || null;
  const strip = Array.from({ length: 7 }, (_, i) => addDaysISO(dateISO, i - 3)).filter((d) => d <= todayISO);
  const loggedDays14 = Array.from({ length: 14 }, (_, i) => addDaysISO(todayISO, -i)).filter((d) => (logs?.[d] || []).length).length;

  const groups = [...MEAL_KEYS, "other"].map((k) => ({ key: k, items: entries.filter((e) => (MEAL_KEYS.includes(e.meal) ? e.meal : "other") === k) })).filter((g) => g.items.length);
  const sortTime = (a, b) => String(a.time || "").localeCompare(String(b.time || ""));

  const macro = (label, v, t, color) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ color: BRAND.muted, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{r(v)}{label === "Calories" ? "" : " g"}</div>
      {t ? <div style={{ color: BRAND.dim, fontSize: 11 }}>of {r(t)}{label === "Calories" ? "" : " g"}</div> : null}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setDateISO(addDaysISO(dateISO, -1))} aria-label="Previous day" style={navBtn}>‹</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{fmtDay(dateISO, todayISO)}</div>
          <div style={{ color: BRAND.muted, fontSize: 12 }}>Logged on {loggedDays14} of the last 14 days</div>
        </div>
        <button onClick={() => setDateISO(addDaysISO(dateISO, 1))} disabled={dateISO >= todayISO} aria-label="Next day" style={{ ...navBtn, opacity: dateISO >= todayISO ? 0.4 : 1 }}>›</button>
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        {strip.map((d) => {
          const on = d === dateISO, has = (logs?.[d] || []).length > 0;
          return (
            <button key={d} onClick={() => setDateISO(d)} style={{ width: 42, padding: "7px 0", borderRadius: 12, border: "none", cursor: "pointer", background: on ? BRAND.btnBg : BRAND.card2, color: on ? BRAND.btnInk : BRAND.text, fontFamily: BRAND.sans }}>
              <div style={{ fontSize: 10, opacity: 0.8 }}>{new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" })}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{Number(d.slice(8))}</div>
              <div style={{ width: 5, height: 5, borderRadius: 9, margin: "3px auto 0", background: has ? (on ? BRAND.btnInk : "var(--accent)") : "transparent" }} />
            </button>
          );
        })}
      </div>

      <div style={{ ...screenCard, padding: 14, display: "flex", gap: 8 }}>
        {macro("Calories", totals.kcal, target?.kcal)}
        {macro("Protein", totals.protein, target?.protein, "var(--green)")}
        {macro("Carbs", totals.carbs, target?.carbs, "var(--blue)")}
        {macro("Fat", totals.fat, target?.fat, "var(--orange)")}
      </div>
      {!target && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: -4 }}>No nutrition plan on this day - showing what they logged on their own.</div>}

      {groups.length === 0 ? (
        <div style={{ ...screenCard, padding: 20, textAlign: "center", color: BRAND.muted, fontSize: 14 }}>Nothing logged on this day.</div>
      ) : groups.map((g) => {
        const t = loggedDayTotals(g.items);
        return (
          <div key={g.key} style={{ ...screenCard, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{MEAL_NAMES[g.key] || "Other"}</div>
              <div style={{ color: BRAND.muted, fontSize: 13 }}>{r(t.kcal)} kcal · {r(t.protein)}P</div>
            </div>
            {[...g.items].sort(sortTime).map((e) => (
              <div key={e.id} style={{ padding: "10px 0", borderTop: `1px solid ${BRAND.line}`, marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, minWidth: 0 }}>
                    {e.name || "Food"}{e.qty ? <span style={{ color: BRAND.muted, fontWeight: 400 }}> · {e.qty}{e.unit ? ` ${e.unit}` : ""}</span> : null}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>{r(e.macros?.kcal)} kcal</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 3, color: BRAND.muted, fontSize: 12 }}>
                  <span>
                    {[e.time, SOURCE[e.source] || e.source, e.estimate ? "estimate" : null, e.enteredBy === "claude" ? "added by Claude" : null].filter(Boolean).join(" · ")}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>P {r(e.macros?.protein)} · C {r(e.macros?.carbs)} · F {r(e.macros?.fat)}</span>
                </div>
                <MealPhoto path={e.photo} alt={e.name || "meal"} />
                {e.reason ? <div style={{ ...screenLabel, textTransform: "none", letterSpacing: 0, fontSize: 12, marginTop: 4 }}>Note: {e.reason}</div> : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
