// Challenges (Nov 26 2026) - client Home card + challenge screen (calendar +
// set logging), and the coach's Tools -> Challenges screen (create, assign,
// running now). Logic: lib/challenges.js. Stored per client in client_data
// section "challenges" ({ items }).
import { useMemo, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { screenCard, screenLabel } from "../../components/ui/screenStyles.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { upsertSection } from "../../lib/clientData.js";
import { isoDate } from "../../lib/dateUtils.js";
import {
  UNITS, newChallenge, challengeList, challengeStats, challengeStatus, featuredChallenge, dayState, dateForDay,
  dayTotal, targetFor, addSet, removeSet, replaceChallenge, fmtAmount, endDate,
} from "../../lib/challenges.js";

const card = { ...screenCard, padding: 16 };
const pill = (on) => ({ padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: BRAND.sans, fontSize: 13, fontWeight: 600, background: on ? BRAND.btnBg : BRAND.card2, color: on ? BRAND.btnInk : BRAND.text });
const field = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, fontFamily: BRAND.sans, fontSize: 15, outline: "none" };
const primaryBtn = { padding: "13px 18px", borderRadius: 999, border: "none", cursor: "pointer", background: BRAND.btnBg, color: BRAND.btnInk, fontFamily: BRAND.sans, fontWeight: 600, fontSize: 15 };
const prettyDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

async function saveList(client, updateClient, list) {
  updateClient?.({ ...client, challenges: list });
  try { await upsertSection(client.id, "challenges", { items: list }); }
  catch { showToast("Saved on this device - will sync when you're online", "info"); }
}

/* ----------------------------- client side ----------------------------- */

export function ChallengeHomeCard({ client, onOpen }) {
  const todayISO = isoDate(new Date());
  const ch = featuredChallenge(client, todayISO);
  if (!ch) return null;
  const s = challengeStats(ch, todayISO);
  const pct = s.status === "active" && s.todayTarget ? Math.min(1, s.today / s.todayTarget) : s.status === "finished" ? 1 : 0;
  return (
    <div onClick={() => onOpen?.(ch.id)} role="button"
      style={{ borderRadius: 22, padding: 16, color: "#fff", cursor: "pointer", background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000))" }}>
      <div style={{ ...screenLabel, color: "rgba(255,255,255,.78)" }}>
        Challenge · {s.status === "upcoming" ? `starts ${prettyDate(ch.startDate)}` : s.status === "finished" ? "complete 🏆" : `Day ${s.dayNow} / ${ch.days}`}
      </div>
      <div style={{ fontFamily: BRAND.display, fontSize: 21, fontWeight: 800, marginTop: 6, lineHeight: 1.15 }}>{ch.name}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginTop: 12 }}>
        <div>
          {s.status === "active" ? (
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{s.today.toLocaleString("en-US")}<span style={{ fontSize: 15, opacity: 0.78 }}> {s.todayTarget ? `/ ${s.todayTarget.toLocaleString("en-US")} today` : "today"}</span></div>
          ) : (
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{fmtAmount(s.total, ch.unit)} <span style={{ fontSize: 15, opacity: 0.78 }}>{ch.exercise.toLowerCase()}</span></div>
          )}
          <div style={{ fontSize: 13, opacity: 0.88, marginTop: 5 }}>{s.streak > 0 ? `🔥 ${s.streak}-day streak · ` : ""}{fmtAmount(s.total, ch.unit)} total</div>
        </div>
        {s.status === "active" && <div style={{ background: "#fff", color: "var(--accent)", borderRadius: 999, padding: "10px 16px", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>+ Log set</div>}
      </div>
      {s.status !== "upcoming" && <div style={{ height: 8, borderRadius: 9, background: "rgba(255,255,255,.25)", marginTop: 14, overflow: "hidden" }}><div style={{ width: `${pct * 100}%`, height: "100%", background: "#fff", borderRadius: 9 }} /></div>}
    </div>
  );
}

const CELL = {
  hit: { background: "var(--accent)", color: "#fff" },
  part: { background: "color-mix(in srgb, var(--accent) 28%, transparent)", color: "var(--ink)" },
  miss: { background: "color-mix(in srgb, var(--red) 85%, transparent)", color: "#fff" },
  today: { background: "var(--card)", color: "var(--ink)", outline: "2.5px solid var(--ink)", outlineOffset: 1 },
  future: { background: "var(--chip)", color: "var(--ink-3)" },
};

function SetsCard({ ch, iso, n, todayISO, editable, onChange }) {
  const [amount, setAmount] = useState("");
  const sets = ch.logs?.[iso] || [];
  const total = dayTotal(ch, iso);
  const target = targetFor(ch, n);
  function add() {
    const v = Number(String(amount).replace(",", "."));
    if (!(v > 0)) { showToast("Enter how many", "warn"); return; }
    onChange(addSet(ch, iso, v));
    setAmount("");
  }
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{iso === todayISO ? "Today" : `Day ${n} · ${prettyDate(iso)}`}</div>
        <div style={{ color: BRAND.muted, fontSize: 13 }}>{fmtAmount(total, ch.unit)}{target ? ` / ${fmtAmount(target, ch.unit)}` : ""}</div>
      </div>
      {target > 0 && <div style={{ height: 10, borderRadius: 9, background: BRAND.card2, overflow: "hidden", marginTop: 10 }}><div style={{ width: `${Math.min(100, (total / target) * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 9 }} /></div>}
      <div style={{ marginTop: 6 }}>
        {sets.length === 0 && <div style={{ color: BRAND.muted, fontSize: 14, padding: "10px 0" }}>{editable ? "No sets yet - add your first one." : "Nothing logged."}</div>}
        {sets.map((v, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderTop: `1px solid ${BRAND.line}`, fontSize: 15 }}>
            <span>Set {i + 1}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <b>{fmtAmount(v, ch.unit)}</b>
              {editable && <button onClick={() => onChange(removeSet(ch, iso, i))} aria-label={`Remove set ${i + 1}`} style={{ border: "none", background: "none", color: BRAND.muted, fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>}
            </span>
          </div>
        ))}
      </div>
      {editable && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} inputMode="decimal" placeholder="How many?" style={{ ...field, flex: 1, minWidth: 0 }} />
          <button onClick={add} style={primaryBtn}>+ Add set</button>
        </div>
      )}
    </div>
  );
}

// Full challenge screen. Clients log; the coach (isCoach) can look and remove.
export function ChallengeScreen({ client, updateClient, challengeId, onBack, isCoach = false }) {
  const todayISO = isoDate(new Date());
  const list = challengeList(client);
  const ch = list.find((c) => c.id === challengeId) || featuredChallenge(client, todayISO);
  const s = ch ? challengeStats(ch, todayISO) : null;
  const [picked, setPicked] = useState(null); // day number
  if (!ch) return <div style={{ ...card, color: BRAND.muted }}>No challenge yet. Your coach will set one for you.</div>;
  const dayN = picked || (s.status === "active" ? s.dayNow : s.status === "finished" ? ch.days : 1);
  const dayISO = dateForDay(ch, dayN);
  const editable = !isCoach && dayISO <= todayISO && s.status !== "upcoming";
  const change = (next) => saveList(client, updateClient, replaceChallenge(list, next));
  async function remove() {
    if (!(await confirmDialog(`Remove "${ch.name}" from ${client.name}? Their logged sets for it are deleted too.`, { confirmLabel: "Remove", danger: true }))) return;
    await saveList(client, updateClient, list.filter((c) => c.id !== ch.id));
    onBack?.();
  }
  const stat = (label, value) => (
    <div style={{ flex: 1, background: BRAND.card2, borderRadius: 16, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ color: BRAND.muted, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
  const t = ch.target || {};
  const targetText = t.mode === "fixed" ? `${fmtAmount(t.value, ch.unit)} a day` : t.mode === "ramp" ? `from ${fmtAmount(t.start, ch.unit)}, +${t.step} a day` : "as many as you can";
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {onBack && <button onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px", borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, fontFamily: BRAND.sans, fontSize: 14, cursor: "pointer" }}>‹ Back</button>}
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{ch.name}</div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>{ch.exercise} · {ch.days} days · {targetText}{ch.coachName ? ` · set by ${ch.coachName}` : ""}</div>
      </div>
      {s.status === "finished" && <div style={{ ...card, textAlign: "center", fontWeight: 700 }}>Challenge complete 🏆 · {s.hit} of {ch.days} days hit</div>}
      {s.status === "upcoming" && <div style={{ ...card, textAlign: "center", color: BRAND.muted }}>Starts {prettyDate(ch.startDate)}. Get ready!</div>}
      <div style={{ display: "flex", gap: 8 }}>
        {stat("Day", `${s.dayNow}/${ch.days}`)}
        {stat("Streak", `🔥 ${s.streak}`)}
        {stat("Total", fmtAmount(s.total, ch.unit))}
      </div>
      {s.status !== "upcoming" && <SetsCard key={dayISO} ch={ch} iso={dayISO} n={dayN} todayISO={todayISO} editable={editable} onChange={change} />}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{ch.days} days</div>
          <div style={{ color: BRAND.muted, fontSize: 12 }}>tap a day to see{isCoach ? "" : " or fix"} it</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 5, marginTop: 12 }}>
          {Array.from({ length: ch.days }, (_, i) => {
            const n = i + 1;
            const st = dayState(ch, n, todayISO);
            const on = n === dayN;
            return (
              <button key={n} disabled={st === "future"} onClick={() => setPicked(n)} aria-label={`Day ${n}`}
                style={{ ...CELL[st], aspectRatio: "1", borderRadius: 7, border: "none", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, fontFamily: BRAND.sans, cursor: st === "future" ? "default" : "pointer", padding: 0, boxShadow: on && st !== "today" ? "0 0 0 2px var(--card), 0 0 0 4px var(--ink)" : "none" }}>{n}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: BRAND.muted }}>
          <span><span style={{ color: "var(--accent)" }}>■</span> target hit</span>
          <span><span style={{ color: "color-mix(in srgb, var(--accent) 35%, transparent)" }}>■</span> partly</span>
          <span><span style={{ color: "var(--red)" }}>■</span> missed</span>
          <span>□ today</span>
        </div>
        {s.best > 0 && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 8 }}>Best day: {fmtAmount(s.best, ch.unit)} · ends {prettyDate(endDate(ch))}</div>}
      </div>
      {isCoach && <button onClick={remove} style={{ ...primaryBtn, background: "transparent", color: BRAND.red, border: `1px solid ${BRAND.line}` }}>Remove challenge</button>}
    </div>
  );
}

/* ------------------------------ coach side ------------------------------ */

const nextMonday = () => {
  const d = new Date(); const add = ((8 - d.getDay()) % 7) || 7;
  return isoDate(new Date(d.getTime() + add * 86400000));
};

export function CoachChallengesScreen({ clients, updateClient, coachName = "", onBack }) {
  const todayISO = isoDate(new Date());
  const weekAgo = isoDate(new Date(new Date(`${todayISO}T12:00:00`).getTime() - 7 * 86400000));
  const [form, setForm] = useState({ name: "", exercise: "Push-ups", unit: "reps", days: 30, customDays: "", mode: "fixed", value: 50, start: 20, step: 2, startDate: nextMonday() });
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // { clientId, challengeId }
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const days = form.days === "custom" ? Math.round(Number(form.customDays) || 0) : form.days;
  const sortedClients = useMemo(() => [...(clients || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")), [clients]);
  const running = useMemo(() => (clients || []).flatMap((c) => challengeList(c)
    .filter((ch) => challengeStatus(ch, todayISO) !== "finished" || endDate(ch) >= weekAgo)
    .map((ch) => ({ client: c, ch, s: challengeStats(ch, todayISO) })))
    .sort((a, b) => (a.ch.name || "").localeCompare(b.ch.name || "") || (a.client.name || "").localeCompare(b.client.name || "")), [clients, todayISO, weekAgo]);

  const openClient = open && (clients || []).find((c) => c.id === open.clientId);
  if (openClient) return <ChallengeScreen client={openClient} updateClient={updateClient} challengeId={open.challengeId} isCoach onBack={() => setOpen(null)} />;

  async function assign() {
    if (!form.exercise.trim()) { showToast("Add the exercise", "warn"); return; }
    if (!(days >= 1 && days <= 365)) { showToast("Pick a length between 1 and 365 days", "warn"); return; }
    if (!picked.length) { showToast("Pick at least one client", "warn"); return; }
    setBusy(true);
    const groupId = `g${Date.now().toString(36)}`;
    const target = form.mode === "fixed" ? { mode: "fixed", value: form.value } : form.mode === "ramp" ? { mode: "ramp", start: form.start, step: form.step } : { mode: "none" };
    try {
      for (const id of picked) {
        const c = (clients || []).find((x) => x.id === id);
        if (!c) continue;
        const ch = newChallenge({ name: form.name, exercise: form.exercise, unit: form.unit, days, startDate: form.startDate, target, coachName, groupId });
        await saveList(c, updateClient, [...challengeList(c), ch]);
      }
      showToast(`Challenge assigned to ${picked.length} client${picked.length === 1 ? "" : "s"}`, "success");
      setPicked([]);
    } finally { setBusy(false); }
  }

  const lbl = { ...screenLabel, marginTop: 14, marginBottom: 6, display: "block" };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {onBack && <button onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px", borderRadius: 999, border: `1px solid ${BRAND.line}`, background: BRAND.card2, color: BRAND.text, fontFamily: BRAND.sans, fontSize: 14, cursor: "pointer" }}>‹ Back</button>}
      <div style={{ fontFamily: BRAND.display, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Challenges</div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>New challenge</div>
        <span style={lbl}>Name</span>
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={`${days || 30}-Day ${form.exercise || "Push-up"} Challenge`} style={field} />
        <span style={lbl}>Exercise</span>
        <input value={form.exercise} onChange={(e) => set({ exercise: e.target.value })} placeholder="Push-ups, squats, plank…" style={field} />
        <span style={lbl}>Length</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[30, 60, 90].map((d) => <button key={d} onClick={() => set({ days: d })} style={pill(form.days === d)}>{d} days</button>)}
          <button onClick={() => set({ days: "custom" })} style={pill(form.days === "custom")}>Custom</button>
        </div>
        {form.days === "custom" && <input value={form.customDays} onChange={(e) => set({ customDays: e.target.value })} inputMode="numeric" placeholder="Number of days" style={{ ...field, marginTop: 8 }} />}
        <span style={lbl}>Daily target</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["none", "None"], ["fixed", "Same every day"], ["ramp", "Builds up"]].map(([k, l]) => <button key={k} onClick={() => set({ mode: k })} style={pill(form.mode === k)}>{l}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {form.mode === "fixed" && <input value={form.value} onChange={(e) => set({ value: e.target.value })} inputMode="decimal" aria-label="Target per day" style={{ ...field, flex: 1 }} />}
          {form.mode === "ramp" && <>
            <input value={form.start} onChange={(e) => set({ start: e.target.value })} inputMode="decimal" aria-label="Day 1 target" placeholder="Day 1" style={{ ...field, flex: 1 }} />
            <input value={form.step} onChange={(e) => set({ step: e.target.value })} inputMode="decimal" aria-label="Add per day" placeholder="+ per day" style={{ ...field, flex: 1 }} />
          </>}
          <select value={form.unit} onChange={(e) => set({ unit: e.target.value })} style={{ ...field, flex: 1 }}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        </div>
        {form.mode === "ramp" && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 6 }}>Day 1: {form.start || 0} · last day: {Math.round(Number(form.start || 0) + Number(form.step || 0) * ((days || 1) - 1))}</div>}
        {form.mode === "none" && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 6 }}>"As many as you can" - any logged set counts as a done day.</div>}
      </div>

      <div style={card}>
        <span style={{ ...lbl, marginTop: 0 }}>Assign to</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sortedClients.map((c) => {
            const on = picked.includes(c.id);
            return <button key={c.id} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))} style={pill(on)}>{on ? "✓ " : ""}{c.name}</button>;
          })}
        </div>
        <span style={lbl}>Starts</span>
        <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} style={field} />
      </div>
      <button onClick={assign} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Assigning…" : picked.length ? `Assign to ${picked.length} client${picked.length === 1 ? "" : "s"}` : "Assign"}</button>

      <div style={card}>
        <span style={{ ...screenLabel }}>Running now</span>
        {running.length === 0 && <div style={{ color: BRAND.muted, fontSize: 14, marginTop: 10 }}>No challenges running yet.</div>}
        {running.map(({ client, ch, s }) => {
          const logged = s.status === "active" && s.today > 0;
          const statusText = s.status === "upcoming" ? `starts ${prettyDate(ch.startDate)}` : s.status === "finished" ? "complete" : `Day ${s.dayNow} · ${logged ? `✓ ${fmtAmount(s.today, ch.unit)} today` : "not logged"}`;
          return (
            <button key={ch.id} onClick={() => setOpen({ clientId: client.id, challengeId: ch.id })}
              style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 0", border: "none", borderTop: `1px solid ${BRAND.line}`, background: "none", cursor: "pointer", fontFamily: BRAND.sans, color: BRAND.text, textAlign: "left" }}>
              <span style={{ fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.name} · {ch.exercise}</span>
              <span style={{ fontSize: 13, whiteSpace: "nowrap", color: s.status === "active" && !logged ? BRAND.red : BRAND.muted }}>{statusText}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
