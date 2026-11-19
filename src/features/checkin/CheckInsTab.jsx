// Weekly check-in (Nov 2026 redesign, see lib/checkinV2.js). Always
// available - no Saturday window. Five steps in a full-screen flow; sending
// again in the same week updates that week's check-in.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { uid } from "../../lib/uid.js";
import { isoDate } from "../../lib/dateUtils.js";
import { upsertSection } from "../../lib/clientData.js";
import { compressImage } from "../../lib/compressImage.js";
import { uploadClientPhoto, usePhotoUrl } from "../../lib/storage.js";
import { showToast } from "../../components/ui/Toast.jsx";
import {
  FEEL_SCALES, TRAINING_FEEL, ADHERENCE, PHOTO_SLOTS,
  emptyCheckinForm, thisWeeksCheckin, weekLabel, sessionsThisWeek, previousWeight,
  buildCheckinEntry, upsertCheckin, formFromEntry, trendSeries, checkinWeek,
} from "../../lib/checkinV2.js";

const C = {
  kick: { fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)" },
  h1: { fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", margin: "6px 0 4px", color: "var(--ink)" },
  h2: { fontSize: 21, fontWeight: 700, letterSpacing: "-.02em", margin: "4px 0 16px", lineHeight: 1.2, color: "var(--ink)" },
  sub: { fontSize: 14, color: "var(--ink-2)", lineHeight: 1.45 },
  card: { background: "var(--card)", border: "1px solid var(--line-strong)", borderRadius: 20, padding: 16 },
  lab: { fontSize: 11, color: "var(--ink-3)", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 },
  q: { fontSize: 15, fontWeight: 600, margin: "16px 0 8px", color: "var(--ink)" },
  btn: { height: 52, borderRadius: 999, background: "var(--accent)", color: "#fff", border: "none", width: "100%", fontWeight: 600, fontSize: 16, cursor: "pointer", fontFamily: "inherit" },
  ta: { width: "100%", boxSizing: "border-box", minHeight: 70, borderRadius: 16, border: "1.5px solid var(--line-strong)", background: "var(--card)", padding: "12px 14px", fontSize: 15, color: "var(--ink)", fontFamily: "inherit", resize: "vertical", outline: "none" },
};
const tile = (on) => ({
  borderRadius: 14, background: on ? "color-mix(in srgb, var(--accent) 10%, var(--card))" : "var(--card)",
  border: `1.5px solid ${on ? "var(--accent)" : "var(--line-strong)"}`, cursor: "pointer", fontFamily: "inherit", color: on ? "var(--accent)" : "var(--ink)",
});
const DRAFT_KEY = (id) => `forge_checkin_draft_${id}`;
const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function useCoachName(trainerId) {
  const [name, setName] = useState("");
  useEffect(() => {
    let off = false;
    if (!trainerId) return undefined;
    supabase.from("trainers").select("name").eq("id", trainerId).maybeSingle().then(({ data }) => {
      if (!off && data?.name) setName(String(data.name).trim().split(/\s+/)[0]);
    }, () => {});
    return () => { off = true; };
  }, [trainerId]);
  return name;
}

function Options({ items, value, onPick }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {items.map((it) => (
        <button key={it} type="button" onClick={() => onPick(it)} style={{ ...tile(value === it), padding: "13px 12px", fontSize: 14, fontWeight: 500, textAlign: "left" }}>{it}</button>
      ))}
    </div>
  );
}

function FaceScale({ scale, value, onPick }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
      {scale.options.map(([emoji, word], i) => (
        <button key={word} type="button" onClick={() => onPick(i + 1)} style={{ ...tile(value === i + 1), height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 20, padding: 0 }}>
          {emoji}<small style={{ fontSize: 9.5, color: value === i + 1 ? "var(--accent)" : "var(--ink-3)", marginTop: 2, fontWeight: 500 }}>{word}</small>
        </button>
      ))}
    </div>
  );
}

function PhotoSlot({ slot, preview, onPick, onClear }) {
  if (preview) {
    return (
      <div style={{ position: "relative", height: 150 }}>
        <img src={preview} alt={slot} style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 20 }} />
        <button type="button" onClick={onClear} aria-label={`Remove ${slot} photo`} style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 99, border: "none", background: "rgba(0,0,0,.6)", color: "#fff", cursor: "pointer" }}>✕</button>
        <div style={{ position: "absolute", bottom: 6, left: 8, color: "#fff", fontSize: 12, fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>{slot}</div>
      </div>
    );
  }
  return (
    <label style={{ ...C.card, height: 150, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderStyle: "dashed", color: "var(--ink-3)", fontSize: 13, cursor: "pointer", padding: 0 }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>＋</span>{slot}
      <input type="file" accept="image/*" onChange={(e) => onPick(e.target.files?.[0])} style={{ display: "none" }} />
    </label>
  );
}

function CheckinFlow({ client, coachName, existing, onClose, onSent }) {
  const [form, setForm] = useState(() => {
    if (existing) return formFromEntry(existing);
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY(client.id)) || "null"); if (d) return { ...emptyCheckinForm(), ...d }; } catch { /* ignore */ }
    return emptyCheckinForm();
  });
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState({});
  const [saving, setSaving] = useState(false);
  const sessions = useMemo(() => sessionsThisWeek(client), [client]);
  const prev = useMemo(() => previousWeight(client), [client]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  useEffect(() => {
    if (existing) return;
    try { localStorage.setItem(DRAFT_KEY(client.id), JSON.stringify(form)); } catch { /* ignore */ }
  }, [form, existing, client.id]);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const w = parseFloat(String(form.weight).replace(",", "."));
  const diff = prev != null && Number.isFinite(w) && w > 0 ? Math.round((w - prev) * 10) / 10 : null;
  // Required answers per step; text boxes, waist and photos are optional.
  const missingByStep = [
    Number.isFinite(w) && w > 0 ? [] : ["weight"],
    FEEL_SCALES.filter((s) => !form[s.key]).map((s) => s.key),
    [!form.trainingFeel && "trainingFeel", !form.adherence && "adherence", !form.pain && "pain"].filter(Boolean),
    [],
    form.overall > 0 ? [] : ["overall"],
  ];
  const [tried, setTried] = useState(false);
  const missing = missingByStep[step];
  const miss = (k) => tried && missing.includes(k);
  const reqLabel = (text, k) => (
    <div style={{ ...C.q, color: miss(k) ? "var(--red)" : "var(--ink)" }}>{text}{miss(k) && <span style={{ fontWeight: 500, fontSize: 13 }}>  · required</span>}</div>
  );
  function next() {
    if (missing.length) {
      setTried(true);
      const el = document.querySelector(`[data-q="${missing[0]}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setTried(false);
    if (step === 4) send(); else setStep(step + 1);
  }

  function pickPhoto(slot, file) {
    if (!file) return;
    setPhotos((p) => ({ ...p, [slot]: { file, url: URL.createObjectURL(file) } }));
  }
  async function send() {
    setSaving(true);
    const id = existing?.id || uid();
    let nextPhotos = client.transformPhotos || [];
    const photoIds = [...(existing?.photoIds || (existing?.photoId ? [existing.photoId] : []))];
    let failed = false;
    for (const slot of PHOTO_SLOTS) {
      const p = photos[slot];
      if (!p) continue;
      try {
        const blob = await compressImage(p.file);
        const path = await uploadClientPhoto(client.id, "transform", blob);
        const pid = uid();
        photoIds.push(pid);
        nextPhotos = [{ id: pid, image: path, type: slot, date: isoDate(), checkInId: id, weight: Number.isFinite(w) ? String(w) : "" }, ...nextPhotos];
      } catch { failed = true; }
    }
    if (nextPhotos !== client.transformPhotos) upsertSection(client.id, "transformPhotos", nextPhotos);
    const entry = buildCheckinEntry(form, { id, sessions, photoIds });
    const next = upsertCheckin(client.checkIns, entry);
    await upsertSection(client.id, "checkins", { submissions: next });
    try { localStorage.removeItem(DRAFT_KEY(client.id)); } catch { /* ignore */ }
    if (failed) showToast("Check-in sent. A photo couldn't upload – add it from Photos.", "warn");
    setSaving(false);
    onSent({ ...client, checkIns: next, transformPhotos: nextPhotos }, !!existing);
  }

  const coach = coachName ? `Coach ${coachName}` : "your coach";
  const steps = [
    <>
      <div style={C.kick}>Your body</div><h2 style={{ ...C.h2, color: miss("weight") ? "var(--red)" : "var(--ink)" }}>Current weight</h2>
      <label data-q="weight" style={{ ...C.card, ...(miss("weight") ? { borderColor: "var(--red)" } : null), display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6, padding: "22px 0" }}>
        <input inputMode="decimal" value={form.weight} onChange={(e) => set({ weight: e.target.value.replace(/[^0-9.,]/g, "") })} placeholder="0.0" aria-label="Current weight in kg"
          style={{ width: 150, textAlign: "right", border: "none", outline: "none", background: "transparent", fontSize: 56, fontWeight: 700, letterSpacing: "-.03em", color: "var(--ink)", fontFamily: "inherit", padding: 0 }} />
        <span style={{ fontSize: 18, color: "var(--ink-3)" }}>kg</span>
      </label>
      {diff != null && (
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, marginTop: 8, color: diff === 0 ? "var(--ink-3)" : "var(--green)" }}>
          {diff === 0 ? "Same as last week" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} kg since last week`}
        </div>
      )}
      <div style={{ ...C.q, marginTop: 24 }}>Waist <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(optional)</span></div>
      <label style={{ ...C.card, display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 999 }}>
        <input inputMode="decimal" value={form.waist} onChange={(e) => set({ waist: e.target.value.replace(/[^0-9.,]/g, "") })} placeholder="at the belly button"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, color: "var(--ink)", fontFamily: "inherit", padding: 0 }} />
        <span style={{ color: "var(--ink-2)" }}>cm</span>
      </label>
    </>,
    <>
      <div style={C.kick}>How you felt</div><h2 style={C.h2}>Rate your week</h2>
      {FEEL_SCALES.map((s) => (
        <div key={s.key} data-q={s.key}>{reqLabel(s.label, s.key)}<FaceScale scale={s} value={form[s.key]} onPick={(v) => set({ [s.key]: v })} /></div>
      ))}
    </>,
    <>
      <div style={C.kick}>Training &amp; food</div><h2 style={C.h2}>How did the plan go?</h2>
      <div style={{ ...C.card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "color-mix(in srgb, var(--accent) 8%, var(--card))" }}>
        <span style={{ fontSize: 14, color: "var(--ink)" }}>Sessions logged this week</span>
        <b style={{ fontSize: 18, color: "var(--accent)" }}>{sessions.planned ? `${sessions.done} of ${sessions.planned}` : sessions.done}</b>
      </div>
      <div data-q="trainingFeel">{reqLabel("How did training feel?", "trainingFeel")}</div>
      <Options items={TRAINING_FEEL} value={form.trainingFeel} onPick={(v) => set({ trainingFeel: v })} />
      <div data-q="adherence">{reqLabel("How closely did you follow your meal plan?", "adherence")}</div>
      <Options items={ADHERENCE} value={form.adherence} onPick={(v) => set({ adherence: v })} />
      <div data-q="pain">{reqLabel("Any pain or injury?", "pain")}</div>
      <Options items={["No", "Yes"]} value={form.pain} onPick={(v) => set({ pain: v })} />
      {form.pain === "Yes" && (
        <textarea value={form.painNote} onChange={(e) => set({ painNote: e.target.value })} placeholder="Where does it hurt, and when?" style={{ ...C.ta, marginTop: 8 }} />
      )}
    </>,
    <>
      <div style={C.kick}>Your words</div><h2 style={C.h2}>Looking back, looking ahead</h2>
      <div style={C.q}>Your biggest win this week</div>
      <textarea value={form.win} onChange={(e) => set({ win: e.target.value })} placeholder="Big or small – it counts" style={C.ta} />
      <div style={C.q}>What got in the way?</div>
      <textarea value={form.obstacle} onChange={(e) => set({ obstacle: e.target.value })} placeholder="Work, travel, sleep, cravings…" style={C.ta} />
      <div style={C.q}>What do you want help with next week?</div>
      <textarea value={form.help} onChange={(e) => set({ help: e.target.value })} placeholder="e.g. ideas for quick lunches" style={C.ta} />
    </>,
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={C.kick}>Progress photos</div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 99, background: "var(--chip)", color: "var(--ink-2)" }}>Optional</span>
      </div>
      <h2 style={{ ...C.h2, marginBottom: 6 }}>Same spot, same light</h2>
      <div style={{ ...C.sub, marginBottom: 14 }}>Photos are optional. Skip them if you like – you can still send your check-in.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {PHOTO_SLOTS.map((slot) => (
          <PhotoSlot key={slot} slot={slot} preview={photos[slot]?.url} onPick={(f) => pickPhoto(slot, f)} onClear={() => setPhotos((p) => { const n = { ...p }; delete n[slot]; return n; })} />
        ))}
      </div>
      <div data-q="overall" style={{ marginTop: 8 }}>{reqLabel("Overall, how was your week?", "overall")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const on = form.overall === n;
          return <button key={n} type="button" onClick={() => set({ overall: n })} style={{ padding: "10px 0", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: on ? "var(--accent)" : "var(--card)", color: on ? "#fff" : "var(--ink)", border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}` }}>{n}</button>;
        })}
      </div>
      <div style={C.q}>Anything else for your coach?</div>
      <textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Optional" style={C.ta} />
    </>,
  ];
  const last = step === steps.length - 1;

  // Shown in the page itself (bottom bar and avatar stay). Next sits after
  // the last question in normal flow - never pinned over the questions.
  return (
    <div style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", color: "var(--ink)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, color: "var(--ink-3)", marginBottom: 12 }}>
        <button type="button" onClick={() => { setTried(false); if (step === 0) onClose(); else setStep(step - 1); }} aria-label={step === 0 ? "Close" : "Back"}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 46, padding: step === 0 ? 0 : "0 18px 0 12px", width: step === 0 ? 46 : "auto", justifyContent: "center", borderRadius: 999, border: "1px solid var(--line-strong)", background: "var(--card)", color: "var(--ink)", fontSize: 17, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          {step === 0 ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ) : (
            <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>Back</>
          )}
        </button>
        <span style={{ fontSize: 15 }}>{step + 1} of {steps.length}</span>
      </div>
      <div style={{ height: 5, borderRadius: 9, background: "var(--line)", overflow: "hidden" }}>
        <i style={{ display: "block", height: "100%", width: `${((step + 1) / steps.length) * 100}%`, background: "var(--accent)", borderRadius: 9, transition: "width .3s" }} />
      </div>
      <div style={{ padding: "20px 4px 8px" }}>{steps[step]}</div>
      <div style={{ padding: "8px 0 24px" }}>
        {tried && missing.length > 0 && (
          <div style={{ textAlign: "center", color: "var(--red)", fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
            {missing.length === 1 ? "Answer the question in red to continue" : `Answer the ${missing.length} questions in red to continue`}
          </div>
        )}
        <button type="button" disabled={saving} onClick={next} style={{ ...C.btn, opacity: missing.length || saving ? 0.5 : 1 }}>
          {last ? (saving ? "Sending…" : existing ? `Update check-in` : `Send to ${coach}`) : "Next"}
        </button>
      </div>
    </div>
  );
}

function Trend({ label, values, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 28 }}>
        {values.map((v, i) => <i key={i} style={{ width: 8, height: `${Math.max(8, (v || 0) * 100)}%`, borderRadius: 3, background: v ? color : "var(--line)" }} />)}
      </div>
    </div>
  );
}

function HistoryPhotos({ photos }) {
  return <div style={{ display: "flex", gap: 6, marginTop: 4 }}>{photos.map((p) => <Thumb key={p.id} photo={p} />)}</div>;
}
function Thumb({ photo }) {
  const url = usePhotoUrl(photo.image);
  if (!url) return null;
  return <img src={url} alt={photo.type} style={{ width: 54, height: 72, borderRadius: 10, objectFit: "cover" }} />;
}

export function CheckInsTab({ client, updateClient, isCoach }) {
  const [flow, setFlow] = useState(false);
  const [open, setOpen] = useState(null);
  const coachName = useCoachName(client.trainer_id);
  const submissions = client.checkIns || [];
  const current = thisWeeksCheckin(submissions);
  const v2Count = submissions.filter((s) => s.v === 2).length;
  const history = [...submissions].reverse();

  function sent(nextClient, wasUpdate) {
    updateClient(nextClient);
    setFlow(false);
    showToast(wasUpdate ? "Check-in updated" : `Sent to ${coachName ? `Coach ${coachName}` : "your coach"}`);
  }
  const weightOf = (s) => {
    if (s.values?.weight) return s.values.weight;
    const a = (s.answers || []).find((x) => /weight/i.test(x.question));
    const n = a ? parseFloat(String(a.answer).replace(/[^0-9.]/g, "")) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  if (flow) return <CheckinFlow client={client} coachName={coachName} existing={current} onClose={() => setFlow(false)} onSent={sent} />;
  return (
    <div style={{ fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", color: "var(--ink)" }}>
      <div style={C.kick}>Check-in</div>
      <h1 style={C.h1}>Weekly check-in</h1>
      <div style={{ ...C.sub, marginBottom: 16 }}>{isCoach ? "Every check-in this client has sent." : `2 minutes. ${coachName ? `Coach ${coachName}` : "Your coach"} reads every answer.`}</div>

      {!isCoach && (
        <div style={{ background: "linear-gradient(140deg, var(--accent), var(--accent-deep))", color: "#fff", borderRadius: 22, padding: 18 }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>This week · {weekLabel()}</div>
          <div style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 4px" }}>{current ? "You're checked in ✓" : "Ready when you are"}</div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>{current ? `Sent ${fmtDay(current.date)}. Something changed? Update it any time this week.` : "Best done Saturday or Sunday morning."}</div>
          <button type="button" onClick={() => setFlow(true)} style={{ ...C.btn, background: "#fff", color: "var(--accent)", marginTop: 16 }}>{current ? "Update check-in" : "Start check-in"}</button>
        </div>
      )}

      {v2Count >= 2 && (
        <>
          <div style={{ ...C.lab, marginTop: 22 }}>Last {Math.min(6, v2Count)} weeks</div>
          <div style={{ ...C.card, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Trend label="Energy" values={trendSeries(submissions, "energy")} color="var(--accent)" />
            <Trend label="Sleep" values={trendSeries(submissions, "sleep")} color="var(--violet)" />
            <Trend label="On plan" values={trendSeries(submissions, "adherence")} color="var(--green)" />
          </div>
        </>
      )}

      <div style={{ ...C.lab, marginTop: 22 }}>History</div>
      <div style={{ ...C.card, padding: "4px 16px" }}>
        {history.length === 0 && <div style={{ padding: "14px 0", color: "var(--ink-3)", fontSize: 14 }}>No check-ins yet.</div>}
        {history.map((s, i) => {
          const wt = weightOf(s);
          const overall = s.values?.overall;
          const photos = (client.transformPhotos || []).filter((p) => p.checkInId === s.id);
          const isOpen = open === s.id;
          const flags = s.flags?.length || 0;
          return (
            <div key={s.id || i} style={{ borderBottom: i === history.length - 1 ? "none" : "1px solid var(--line)" }}>
              <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--ink)", textAlign: "left" }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{fmtDay(s.date)}{checkinWeek(s) === checkinWeek({ date: isoDate() }) ? <span style={{ color: "var(--accent)", fontWeight: 500, fontSize: 12 }}>  · this week</span> : null}</span>
                <span style={{ color: "var(--ink-3)", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                  {isCoach && flags > 0 && <span style={{ color: "var(--red)", fontWeight: 600 }}>⚑ {flags}</span>}
                  {[wt ? `${wt} kg` : "", overall ? `Week ${overall}/10` : ""].filter(Boolean).join(" · ")}
                  <span style={{ fontSize: 16 }}>{isOpen ? "⌃" : "›"}</span>
                </span>
              </button>
              {isOpen && (
                <div style={{ paddingBottom: 14, display: "grid", gap: 8 }}>
                  {(s.answers || []).filter((a) => String(a.answer || "").trim()).map((a, j) => (
                    <div key={j}>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{a.question}</div>
                      <div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{a.answer}</div>
                    </div>
                  ))}
                  {photos.length > 0 && <HistoryPhotos photos={photos} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
