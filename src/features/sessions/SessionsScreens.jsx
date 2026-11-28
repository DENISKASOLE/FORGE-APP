// Sessions (Nov 28 2026): package balance, upcoming sessions, a calendar of
// when each session was used, and the coach's controls. Nothing is deducted
// automatically - see lib/sessionLedger.js.
import { useMemo, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { screenCard, screenLabel } from "../../components/ui/screenStyles.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { saveSessionState } from "./saveSessionState.js";
import { isoDate } from "../../lib/dateUtils.js";
import {
  ledgerOf, activePackage, packageLeft, upcomingSessions, spendSession, undoUse, cancelSession, decideLateCancel,
  pendingLateCancels, monthMarks, scheduledOn, usedEventFor, cancelEventFor, setWindowHours,
} from "../../lib/sessionLedger.js";

const card = { ...screenCard, padding: 16 };
const btn = (kind) => ({
  padding: "9px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: BRAND.sans, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
  ...(kind === "use" ? { background: "var(--accent)", color: "#fff" } : kind === "danger" ? { background: "color-mix(in srgb, var(--red) 14%, transparent)", color: "var(--red)" } : { background: BRAND.card2, color: BRAND.text }),
});
const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmtWhen = (d) => d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const first = (name) => String(name || "").split(" ")[0] || "Client";

function leftText(client) {
  const p = activePackage(client);
  return p ? `${packageLeft(p)} of ${p.total} left` : "no package";
}

/* --------------- coach: "Use session?" after logging a workout --------------- */
export function UseSessionPrompt({ client, updateClient, date }) {
  const [done, setDone] = useState(null); // "used" | "skipped"
  if (!client || client.clientType === "Online") return null;
  const slot = scheduledOn(client, date)[0];
  const already = usedEventFor(client, date, slot?.time || "");
  const p = activePackage(client);
  if (already || done === "used") return <div style={{ ...card, padding: 12, textAlign: "center", color: "var(--accent)", fontWeight: 600, marginBottom: 12 }}>✓ Session used · {leftText(client)}</div>;
  if (done === "skipped") return null;
  async function use() {
    const { client: next } = spendSession(client, { date, time: slot?.time || "" });
    await saveSessionState(client, next, updateClient);
    setDone("used");
    showToast(`${first(client.name)}: session used · ${leftText(next)}`, "success");
  }
  return (
    <div style={{ ...card, padding: 14, marginBottom: 12, border: "1.5px solid var(--accent)" }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>Use 1 session from {first(client.name)}'s package?</div>
      <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>{p ? `${packageLeft(p)} → ${Math.max(0, packageLeft(p) - 1)} left (${p.name || "package"})` : "No package set up yet - it will still be recorded."}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={use} style={{ ...btn("use"), flex: 1 }}>Use session</button>
        <button onClick={() => setDone("skipped")} style={btn()}>Don't use</button>
      </div>
    </div>
  );
}

/* --------------- coach Home: today's sessions + late cancellations --------------- */
export function CoachSessionsToday({ clients, updateClient }) {
  const today = isoDate(new Date());
  const rows = useMemo(() => (clients || []).filter((c) => c.clientType !== "Online").flatMap((c) => scheduledOn(c, today).map((s) => ({ client: c, ...s })))
    .sort((a, b) => String(a.time).localeCompare(String(b.time))), [clients, today]);
  const pending = (clients || []).flatMap((c) => pendingLateCancels(c).map((e) => ({ client: c, e })));
  if (!rows.length && !pending.length) return null;

  async function use(c, time) {
    const { client: next } = spendSession(c, { date: today, time });
    await saveSessionState(c, next, updateClient);
    showToast(`${first(c.name)}: session used · ${leftText(next)}`, "success");
  }
  async function cancelFree(c, time) {
    if (!(await confirmDialog(`Cancel ${first(c.name)}'s session today at ${time}? No session is used.`, { confirmLabel: "Cancel session" }))) return;
    await saveSessionState(c, cancelSession(c, { date: today, time, by: "coach" }), updateClient);
  }
  async function decide(c, e, decision) {
    await saveSessionState(c, decideLateCancel(c, e.id, decision), updateClient);
    showToast(decision === "used" ? `${first(c.name)}: session used` : "Waived - no session used", "success");
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {pending.map(({ client: c, e }) => (
        <div key={e.id} style={{ ...card, border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)" }}>
          <div style={{ ...screenLabel, color: "var(--red)" }}>Late cancellation</div>
          <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.45 }}><b>{c.name}</b> cancelled {fmtDay(e.date)} {e.time} · {fmtWhen(new Date(e.at))}, inside {ledgerOf(c).windowHours}h. Count it as a session?</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => decide(c, e, "used")} style={btn("danger")}>Use session</button>
            <button onClick={() => decide(c, e, "waived")} style={btn()}>Waive</button>
          </div>
        </div>
      ))}
      {rows.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Sessions today</div>
            <div style={{ color: BRAND.muted, fontSize: 12 }}>nothing is used until you tap</div>
          </div>
          {rows.map(({ client: c, time }) => {
            const used = usedEventFor(c, today, time);
            const cancelled = cancelEventFor(c, today, time);
            const left = packageLeft(activePackage(c));
            return (
              <div key={`${c.id}-${time}`} style={{ padding: "12px 0", borderTop: `1px solid ${BRAND.line}`, marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                    <div style={{ color: BRAND.muted, fontSize: 13 }}>{time} · {leftText(c)}{left === 1 && !used ? " · last session" : ""}</div>
                  </div>
                  {used ? (
                    <button onClick={() => saveSessionState(c, undoUse(c, used.id), updateClient)} title="Undo" style={{ ...btn(), color: "var(--accent)" }}>✓ Used · Undo</button>
                  ) : cancelled ? (
                    <span style={{ color: BRAND.muted, fontSize: 13 }}>{cancelled.late && !cancelled.decision ? "Cancelled late" : "Cancelled"}</span>
                  ) : null}
                </div>
                {!used && !cancelled && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => use(c, time)} style={{ ...btn("use"), flex: 1 }}>Use session</button>
                    <button onClick={() => cancelFree(c, time)} style={btn()}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------- calendar --------------- */
const MARK = {
  used: { background: "var(--accent)", color: "#fff" },
  late: { background: "var(--red)", color: "#fff" },
  cancelled: { background: BRAND.card2, color: BRAND.dim, textDecoration: "line-through" },
  upcoming: { outline: "2px dashed var(--accent)", outlineOffset: -2, color: "var(--accent)" },
};
function SessionCalendar({ client, onPick, picked }) {
  const [month, setMonth] = useState(() => isoDate(new Date()).slice(0, 7));
  const marks = monthMarks(client, month);
  const [y, m] = month.split("-").map(Number);
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, m, 0).getDate();
  const today = isoDate(new Date());
  const shift = (n) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nav = { width: 34, height: 34, borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, cursor: "pointer", fontSize: 16 };
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
        <div style={{ display: "flex", gap: 6 }}><button onClick={() => shift(-1)} style={nav} aria-label="Previous month">‹</button><button onClick={() => shift(1)} style={nav} aria-label="Next month">›</button></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 10, textAlign: "center" }}>
        {"MTWTFSS".split("").map((d, i) => <div key={i} style={{ fontSize: 10, fontWeight: 700, color: BRAND.dim }}>{d}</div>)}
        {Array.from({ length: firstDow }, (_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
          const mk = marks[iso];
          return (
            <button key={iso} onClick={() => onPick(iso)} style={{ aspectRatio: "1", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: BRAND.sans, background: "transparent", color: BRAND.text, padding: 0, ...(MARK[mk] || {}), ...(iso === today && !mk ? { outline: `2px solid ${BRAND.text}`, outlineOffset: -2 } : {}), ...(picked === iso ? { boxShadow: "0 0 0 2px var(--card), 0 0 0 4px var(--ink)" } : {}) }}>{i + 1}</button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: BRAND.muted }}>
        <span><span style={{ color: "var(--accent)" }}>■</span> used</span>
        <span><span style={{ color: "var(--red)" }}>■</span> late cancel</span>
        <span>▢ cancelled (free)</span>
        <span style={{ color: "var(--accent)" }}>⬚ upcoming</span>
      </div>
    </div>
  );
}

function describe(e, windowHours) {
  if (e.type === "used") return { text: e.reason === "late_cancel" ? "Late cancellation · session used" : "Session used", color: e.reason === "late_cancel" ? "var(--red)" : "var(--accent)", minus: true };
  if (e.decision === "waived") return { text: "Cancelled late · waived by coach", color: BRAND.muted };
  if (e.late && !e.decision) return { text: `Cancelled inside ${windowHours}h · coach to decide`, color: "var(--orange)" };
  if (e.late && e.decision === "used") return null; // shown by its "used" event
  return { text: `Cancelled by ${e.by === "coach" ? "coach" : "client"} · free`, color: BRAND.muted };
}

/* --------------- the Sessions screen (coach + client) --------------- */
export function SessionsScreen({ client, updateClient, isCoach }) {
  const [picked, setPicked] = useState(null);
  const ledger = ledgerOf(client);
  const p = activePackage(client);
  const upcoming = upcomingSessions(client, new Date(), 21).slice(0, 6);
  const history = [...ledger.events].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const visible = history.map((e) => ({ e, d: describe(e, ledger.windowHours) })).filter((x) => x.d);
  const dayEvents = picked ? visible.filter((x) => x.e.date === picked) : [];
  const counts = (p ? ledger.events.filter((e) => e.packageId === p.id && e.type === "used") : []);

  async function cancel(s) {
    const late = new Date() >= s.freeUntil;
    const msg = isCoach
      ? `Cancel ${fmtDay(s.date)} at ${s.time}? No session is used.`
      : late
        ? `This is less than ${ledger.windowHours} hours before your session, so your coach may count it as a used session. Cancel ${fmtDay(s.date)} at ${s.time}?`
        : `Cancel ${fmtDay(s.date)} at ${s.time}? It's more than ${ledger.windowHours} hours away, so it's free.`;
    if (!(await confirmDialog(msg, { confirmLabel: "Cancel session", cancelLabel: "Keep it", danger: late && !isCoach }))) return;
    await saveSessionState(client, cancelSession(client, { date: s.date, time: s.time, by: isCoach ? "coach" : "client" }), updateClient);
    showToast(isCoach ? "Session cancelled" : late ? "Cancelled - your coach has been told" : "Cancelled - no session used", "success");
  }
  async function spendOn(date) {
    const slot = scheduledOn(client, date)[0];
    const { client: next } = spendSession(client, { date, time: slot?.time || "", reason: slot ? "session" : "manual" });
    await saveSessionState(client, next, updateClient);
    showToast(`Session used · ${leftText(next)}`, "success");
  }
  async function decide(e, decision) { await saveSessionState(client, decideLateCancel(client, e.id, decision), updateClient); }
  async function undo(e) {
    if (!(await confirmDialog("Give this session back to the package?", { confirmLabel: "Give it back" }))) return;
    await saveSessionState(client, undoUse(client, e.id), updateClient);
  }

  const heroLeft = p ? packageLeft(p) : 0;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontFamily: BRAND.display, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{isCoach ? "Sessions" : "My sessions"}</div>

      <div style={{ borderRadius: 22, padding: 16, color: "#fff", background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000))" }}>
        <div style={{ ...screenLabel, color: "rgba(255,255,255,.78)" }}>{p ? p.name || `${p.total}-session pack` : "No package yet"}</div>
        <div style={{ fontSize: 34, fontWeight: 800, marginTop: 4, lineHeight: 1.1 }}>{heroLeft} <span style={{ fontSize: 15, opacity: 0.8 }}>{p ? `of ${p.total} left` : "sessions"}</span></div>
        {p && <div style={{ height: 8, borderRadius: 9, background: "rgba(255,255,255,.25)", marginTop: 10, overflow: "hidden" }}><div style={{ width: `${p.total ? (heroLeft / p.total) * 100 : 0}%`, height: "100%", background: "#fff" }} /></div>}
        <div style={{ fontSize: 13, opacity: 0.88, marginTop: 8 }}>
          {upcoming[0] ? `Next: ${fmtDay(upcoming[0].date)} · ${upcoming[0].time}` : "No upcoming sessions scheduled"}
          {isCoach && p ? ` · ${counts.length} used in the app` : ""}
        </div>
      </div>

      {isCoach && pendingLateCancels(client).map((e) => (
        <div key={e.id} style={{ ...card, border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)" }}>
          <div style={{ fontSize: 14, lineHeight: 1.45 }}>Cancelled {fmtDay(e.date)} {e.time} late ({fmtWhen(new Date(e.at))}). Count it as a session?</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => decide(e, "used")} style={btn("danger")}>Use session</button>
            <button onClick={() => decide(e, "waived")} style={btn()}>Waive</button>
          </div>
        </div>
      ))}

      <div style={card}>
        <div style={screenLabel}>Upcoming</div>
        {upcoming.length === 0 && <div style={{ color: BRAND.muted, fontSize: 14, marginTop: 8 }}>{isCoach ? "No recurring sessions - set days and times in the Schedule tab." : "Nothing scheduled yet."}</div>}
        {upcoming.map((s) => (
          <div key={`${s.date}-${s.time}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 0", borderTop: `1px solid ${BRAND.line}`, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 15 }}><b>{fmtDay(s.date)}</b> · {s.time}</div>
              <div style={{ color: new Date() >= s.freeUntil ? "var(--orange)" : BRAND.muted, fontSize: 12 }}>{new Date() >= s.freeUntil ? `Inside the ${ledger.windowHours}h cancellation window` : `Free to cancel until ${fmtWhen(s.freeUntil)}`}</div>
            </div>
            <button onClick={() => cancel(s)} style={btn()}>Cancel</button>
          </div>
        ))}
      </div>

      <SessionCalendar client={client} picked={picked} onPick={(d) => setPicked((x) => (x === d ? null : d))} />
      {picked && (
        <div style={card}>
          <div style={{ fontWeight: 700 }}>{fmtDay(picked)}</div>
          {dayEvents.length === 0 && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 6 }}>No sessions used or cancelled on this day.</div>}
          {dayEvents.map(({ e, d }) => (
            <div key={e.id} style={{ fontSize: 13, marginTop: 6, color: d.color }}>{d.text}{e.time ? ` · ${e.time}` : ""} · recorded {fmtWhen(new Date(e.at))}{e.type === "used" ? " by Coach" : ""}</div>
          ))}
          {isCoach && picked <= isoDate(new Date()) && <button onClick={() => spendOn(picked)} style={{ ...btn("use"), marginTop: 10 }}>Use a session on this day</button>}
        </div>
      )}

      {visible.length > 0 && (
        <div style={card}>
          <div style={screenLabel}>History</div>
          {visible.slice(0, 30).map(({ e, d }) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 0", borderTop: `1px solid ${BRAND.line}`, marginTop: 8, fontSize: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div>{fmtDay(e.date)}{e.time ? ` · ${e.time}` : ""}</div>
                <div style={{ color: BRAND.muted, fontSize: 12 }}>recorded {fmtWhen(new Date(e.at))}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: d.color, fontWeight: 700, fontSize: 13, textAlign: "right" }}>{d.text}{d.minus ? " · −1" : ""}</span>
                {isCoach && e.type === "used" && <button onClick={() => undo(e)} aria-label="Give it back" style={{ border: "none", background: "none", color: BRAND.muted, cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}>undo</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {isCoach && (
        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div><div style={{ fontWeight: 600 }}>Cancellation window</div><div style={{ color: BRAND.muted, fontSize: 12 }}>Cancelling later than this asks you whether to use a session.</div></div>
          <select value={ledger.windowHours} onChange={(ev) => saveSessionState(client, setWindowHours(client, ev.target.value), updateClient)}
            style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, fontFamily: BRAND.sans, fontSize: 14 }}>
            {[2, 4, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} hours</option>)}
          </select>
        </div>
      )}
      {isCoach && <div style={{ color: BRAND.muted, fontSize: 12, textAlign: "center" }}>Add or edit packages in the Packages tab.</div>}
    </div>
  );
}
