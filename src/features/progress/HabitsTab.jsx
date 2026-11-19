// Progress > Habits (Nov 2026). Client: after Check-in in the Progress tab.
// Coach: the "Habits" button next to Measurements / Progress Report.
// Data: steps / sleep / water logged on Home (lib/habitsData.js).
import { useMemo, useState } from "react";
import { HabitSheet } from "../quicklog/QuickLogMenu.jsx";
import { HABITS, goalOf, weekDays, habitRows, summarize, fmtHabit, fmtShort, insightFor, lastWeeks } from "../../lib/habitsData.js";
import { isoDate } from "../../lib/dateUtils.js";

const S = {
  font: { fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", color: "var(--ink)" },
  kick: { fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)" },
  lab: { fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-3)" },
  card: { background: "var(--card)", border: "1px solid var(--line-strong)", borderRadius: 20, padding: 16 },
};
const dayLabel = (iso, today) => (iso === today ? "Today" : new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" }));
const rangeLabel = (days) => {
  const f = (iso, m) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", m ? { day: "numeric", month: "short" } : { day: "numeric" });
  return `${f(days[0], days[0].slice(5, 7) !== days[6].slice(5, 7))}–${f(days[6], true)}`;
};

function Ring({ pct, color }) {
  const r = 28, c = 2 * Math.PI * r;
  return (
    <div style={{ width: 66, height: 66, margin: "0 auto 6px", position: "relative" }}>
      <svg width="66" height="66" aria-hidden="true">
        <circle cx="33" cy="33" r={r} fill="none" stroke="var(--chip)" strokeWidth="7" />
        <circle cx="33" cy="33" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 33 33)" />
      </svg>
      <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700 }}>{Math.round(pct * 100)}%</b>
    </div>
  );
}

function Chart({ habit, rows, sum, today }) {
  const goal = goalOf(habit.key);
  const max = Math.max(goal * 1.25, ...rows.map((r) => r[habit.key] || 0));
  const H = 96;
  return (
    <div style={{ ...S.card, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{habit.label}</span>
        <span style={{ fontSize: 13, color: "var(--ink-2)" }}>avg {fmtHabit(habit.key, sum.avg)} · goal {fmtHabit(habit.key, goal)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, height: H, alignItems: "end", marginTop: 14, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: (goal / max) * H, borderTop: "1.5px dashed var(--ink-3)", opacity: 0.7 }}>
          <span style={{ position: "absolute", right: 0, top: -16, fontSize: 10, color: "var(--ink-3)" }}>goal</span>
        </div>
        {rows.map((r) => {
          const v = r[habit.key];
          return <i key={r.date} title={fmtHabit(habit.key, v)} style={{ display: "block", height: v ? Math.max(4, (v / max) * H) : 3, borderRadius: "7px 7px 3px 3px", background: !v ? "var(--line)" : v >= goal ? habit.color : `color-mix(in srgb, ${habit.color} 35%, var(--card))` }} />;
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 6, textAlign: "center", fontSize: 11, color: "var(--ink-3)" }}>
        {rows.map((r) => <div key={r.date} style={r.date === today ? { color: "var(--accent)", fontWeight: 700 } : null}>{dayLabel(r.date, today)}</div>)}
      </div>
    </div>
  );
}

export function HabitsTab({ client, updateClient, isCoach }) {
  const [sheet, setSheet] = useState(null);
  const today = isoDate();
  const days = useMemo(() => weekDays(today), [today]);
  const rows = useMemo(() => habitRows(client.nutrition, days), [client.nutrition, days]);
  const sum = useMemo(() => summarize(rows), [rows]);
  const weeks = useMemo(() => (isCoach ? lastWeeks(client.nutrition, today) : []), [isCoach, client.nutrition, today]);

  return (
    <div style={S.font}>
      <div style={S.kick}>Daily habits{isCoach ? " · coach view" : ""}</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", margin: "4px 0 2px" }}>This week</h1>
      <div style={{ fontSize: 14, color: "var(--ink-2)" }}>{rangeLabel(days)} · {sum.daysLogged} of 7 days logged</div>

      {isCoach && (
        <div style={{ background: "linear-gradient(140deg, var(--accent), var(--accent-deep))", color: "#fff", borderRadius: 20, padding: 16, marginTop: 12, fontSize: 14, lineHeight: 1.45 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.8, fontWeight: 600, marginBottom: 4 }}>What stands out</div>
          {insightFor(sum)}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
        {HABITS.map((h) => (
          <div key={h.key} style={{ ...S.card, padding: "12px 8px", textAlign: "center", borderRadius: 18 }}>
            <Ring pct={sum[h.key].pct} color={h.color} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtHabit(h.key, sum[h.key].avg)}</div>
            <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{h.label} avg</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>Goal hit {sum[h.key].hits}/7</div>
          </div>
        ))}
      </div>

      {!isCoach && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...S.lab, marginBottom: 8 }}>Log today</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {HABITS.map((h) => {
              const v = rows[6][h.key];
              return (
                <button key={h.key} type="button" onClick={() => setSheet(h.key)} style={{ height: 50, borderRadius: 999, border: v ? `1.5px solid ${h.color}` : "none", background: v ? "var(--card)" : "var(--accent)", color: v ? "var(--ink)" : "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {v ? `${h.label} ${fmtShort(h.key, v)} ✓` : `+ ${h.label}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {HABITS.map((h) => <Chart key={h.key} habit={h} rows={rows} sum={sum[h.key]} today={today} />)}

      {isCoach && (
        <div style={{ ...S.card, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Last 4 weeks</span>
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>weekly averages</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10, fontSize: 12, textAlign: "center" }}>
            {weeks.map((w, i) => (
              <div key={w.end} style={{ background: i === 3 ? "color-mix(in srgb, var(--accent) 12%, var(--card))" : "var(--chip)", borderRadius: 12, padding: "8px 2px", color: "var(--ink-2)" }}>
                {i === 3 ? "This wk" : `${3 - i} wk${3 - i === 1 ? "" : "s"} ago`}
                <b style={{ display: "block", fontSize: 14, color: "var(--ink)" }}>{fmtShort("steps", w.steps)}</b>
                {fmtShort("sleep", w.sleep)} · {fmtShort("water", w.water)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...S.lab, marginTop: 18 }}>Day by day</div>
      <div style={{ ...S.card, padding: "6px 16px", marginTop: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 1fr 1fr", gap: 6, padding: "10px 0", fontSize: 11, color: "var(--ink-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>
          <span />{HABITS.map((h) => <span key={h.key} style={{ textAlign: "center" }}>{h.label}</span>)}
        </div>
        {[...rows].reverse().map((r) => (
          <div key={r.date} style={{ display: "grid", gridTemplateColumns: "64px 1fr 1fr 1fr", gap: 6, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)", fontSize: 13 }}>
            <span style={{ color: r.date === today ? "var(--accent)" : "var(--ink-2)", fontWeight: r.date === today ? 700 : 500 }}>{r.date === today ? "Today" : new Date(`${r.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</span>
            {HABITS.map((h) => {
              const v = r[h.key];
              const hit = v != null && v >= goalOf(h.key);
              return <span key={h.key} style={{ textAlign: "center", padding: "5px 0", borderRadius: 999, fontWeight: 600, fontSize: 12, color: v == null ? "var(--ink-3)" : hit ? h.color : "var(--ink-2)", background: hit ? `color-mix(in srgb, ${h.color} 12%, var(--card))` : "transparent" }}>{fmtShort(h.key, v)}{hit ? " ✓" : ""}</span>;
            })}
          </div>
        ))}
      </div>

      {sheet && <HabitSheet kind={sheet} client={client} updateClient={updateClient} onClose={() => setSheet(null)} />}
    </div>
  );
}
