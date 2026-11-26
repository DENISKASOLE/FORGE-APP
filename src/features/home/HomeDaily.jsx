import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { isoDate } from "../../lib/dateUtils.js";
import { upsertSection } from "../../lib/clientData.js";
import { currentProgramWeek, workoutForDay, exerciseCountOf } from "../../lib/programModel.js";
import { sessionForWorkout, parseSeconds } from "../../lib/trainingLogs.js";
import { ChallengeHomeCard } from "../challenges/ChallengeScreens.jsx";
import { NotificationBell } from "./NotificationBell.jsx";
import { MOODS, weekOf, dayNutrition, habitsFor, habitGoals, weightInfo, measurementInfo, bodyFatInfo, proteinStreak, energyInfo, shortDate } from "./homeData.js";

const card = { background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 20, boxSizing: "border-box", minWidth: 0 };
const h4 = { fontSize: 15, fontWeight: 600, color: BRAND.text };
const sub = { fontSize: 12, color: BRAND.dim, marginTop: 4, lineHeight: 1.35 };
const fmt = (n, d = 0) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 }));

function Ring({ pct, color, size = 34, stroke = 4, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
        {p > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} />}
      </svg>
      {children && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div>}
    </div>
  );
}

// One metric tile: title, optional corner ring, big number + unit, footnote.
function Tile({ title, value, unit, foot, footColor, ring, onClick, label }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} aria-label={label} style={{ ...card, padding: 14, minHeight: 112, position: "relative", textAlign: "left", color: BRAND.text, fontFamily: "inherit", cursor: onClick ? "pointer" : "default", width: "100%" }}>
      <div style={h4}>{title}</div>
      {ring && <div style={{ position: "absolute", top: 12, right: 12 }}><Ring pct={ring.pct} color={ring.color} /></div>}
      <div style={{ fontFamily: BRAND.display, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 10, whiteSpace: "nowrap" }}>
        {value}{unit && value !== "—" ? <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 2 }}>{unit}</span> : null}
      </div>
      <div style={{ ...sub, color: footColor || BRAND.dim }}>{foot}</div>
    </Tag>
  );
}

function workoutToday(client) {
  const jsDow = new Date().getDay();
  const dow = jsDow === 0 ? 7 : jsDow;
  const program = client.program;
  const weekNum = currentProgramWeek(program);
  const week = program?.weeks?.find((wk) => wk.weekNum === weekNum) || null;
  const workout = week ? workoutForDay(week, dow) : null;
  const estMin = Math.round((workout?.blocks || []).reduce((total, b) => total + (b.exercises || []).reduce((s, ex) => {
    const sets = ex.sets?.length || 0;
    const restSec = parseSeconds(ex.rest || "") || 60;
    return s + sets + (sets * restSec) / 60;
  }, 0), 0));
  const days = week ? Array.from({ length: 7 }, (_, i) => workoutForDay(week, i + 1)).filter(Boolean) : [];
  const done = week ? days.filter((wo) => sessionForWorkout(client.trainingLogs, week.id, wo.id)?.status === "completed").length : 0;
  return { program, workout, exCount: exerciseCountOf(workout), estMin, trainDone: done, trainTotal: days.length };
}

// Client · Home "Today" (Nov 2026, approved mockup): date strip, mood
// check-in, then health tiles (today's workout card removed Nov 18 2026 -
// it lives on the Train tab).
// Tapping a tile opens the matching quick-log sheet (steps, water, sleep,
// weight & measurements) or the related tab. Days after today are shown
// but can't be selected; a past day shows that day's food, habits and mood.
export function HomeDaily({ client, updateClient, goTo, openLog }) {
  const todayISO = isoDate();
  const [dateISO, setDateISO] = useState(todayISO);
  const isToday = dateISO === todayISO;
  const firstName = (client.name || "").split(" ")[0];
  const days = weekOf(dateISO);
  const monthLabel = new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }).toUpperCase();

  const { trainDone, trainTotal } = workoutToday(client);
  const { eaten, target } = dayNutrition(client, dateISO);
  const kcalPct = target?.kcal ? eaten.kcal / target.kcal : 0;
  const habits = habitsFor(client, dateISO);
  const goals = habitGoals(client);
  const weight = weightInfo(client, dateISO);
  const vo2 = measurementInfo(client, "vo2max", dateISO);
  const rhr = measurementInfo(client, "restingHr", dateISO, 7);
  const waist = measurementInfo(client, "waist", dateISO, 28);
  const bodyFat = bodyFatInfo(client);
  const streak = proteinStreak(client, dateISO);
  const energy = energyInfo(client, dateISO);
  const mood = client.moodLog?.[dateISO] || 0;
  const canLog = isToday && !!openLog;

  async function pickMood(v) {
    if (!updateClient || dateISO > todayISO) return;
    const next = { ...(client.moodLog || {}), [dateISO]: v };
    updateClient({ ...client, moodLog: next });
    try { await upsertSection(client.id, "mood_log", { entries: next }); } catch { showToast("Couldn't save your mood - check your connection.", "warn"); }
  }

  const steps = parseInt(habits.steps, 10) || 0;
  const water = parseFloat(habits.water) || 0;
  const sleep = parseFloat(habits.sleep) || 0;
  const change = (v, unit, goodWhenDown = true) => (v == null || v === 0 ? null : { text: `${v > 0 ? "+" : "−"}${Math.abs(v)} ${unit}`, color: (v < 0) === goodWhenDown ? BRAND.green : BRAND.muted });
  const wChange = change(weight?.change, "kg");
  const waistChange = change(waist?.change, "cm");

  return (
    // Everything on Home drawn ~10% smaller (Denis, Nov 18 2026). zoom keeps
    // the layout full-width and scales text, rings and tiles together.
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, maxWidth: "100%", zoom: 0.9 }}>
      {/* Nov 20 2026: brand left, bell right (Me moved to the bottom dock). */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", paddingTop: 2 }}>
        {/* Brand mark: a small teal circle with the letter F (Denis, Nov 20). */}
        <div aria-label="Forge Performance" style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: BRAND.display, fontSize: 22, fontWeight: 800, lineHeight: 1, boxShadow: "0 2px 8px rgba(0,0,0,.12)" }}>F</div>
        <div style={{ textAlign: "center", fontFamily: BRAND.display, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>Today</div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>{goTo ? <NotificationBell client={client} goTo={goTo} /> : null}</div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: BRAND.dim, marginTop: -4 }}>{monthLabel}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {days.map((d) => {
          const on = d.iso === dateISO, future = d.iso > todayISO;
          return (
            <button key={d.iso} onClick={() => !future && setDateISO(d.iso)} disabled={future} aria-pressed={on}
              style={{ padding: "8px 0", borderRadius: 14, border: "none", cursor: future ? "default" : "pointer", fontFamily: "inherit", background: on ? BRAND.btnBg : "transparent", color: on ? BRAND.btnInk : BRAND.muted, opacity: future ? 0.4 : 1, fontSize: 12, fontWeight: 600 }}>
              {d.name}
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: on ? BRAND.btnInk : BRAND.text }}>{d.num}</div>
            </button>
          );
        })}
      </div>

      <div style={{ ...card, padding: 16, textAlign: "center", marginTop: 2 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{isToday ? `Hi ${firstName}, how are you feeling today?` : `How you felt · ${shortDate(dateISO, todayISO)}`}</div>
        <div style={{ display: "flex", justifyContent: "space-between", margin: "14px 4px 0" }}>
          {MOODS.map((e, i) => {
            const v = i + 1, on = mood === v;
            return (
              <button key={v} onClick={() => pickMood(v)} aria-label={`Mood ${v} of 5`} aria-pressed={on}
                style={{ width: 48, height: 48, borderRadius: "50%", fontSize: 24, cursor: "pointer", display: "grid", placeItems: "center", border: `2px solid ${on ? BRAND.gold : "transparent"}`, background: on ? "color-mix(in srgb, var(--accent) 12%, var(--card))" : BRAND.card2, padding: 0 }}>{e}</button>
            );
          })}
        </div>
      </div>

      {/* Coach-set challenge (Nov 26 2026) - only shows when one is running. */}
      <ChallengeHomeCard client={client} onOpen={goTo ? () => goTo("challenge") : undefined} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <button onClick={goTo ? () => goTo("nutrition") : undefined} aria-label="Calories" style={{ ...card, padding: 14, textAlign: "center", color: BRAND.text, fontFamily: "inherit", cursor: goTo ? "pointer" : "default", width: "100%" }}>
          <div style={h4}>Calories</div>
          <div style={{ display: "grid", placeItems: "center", marginTop: 8 }}>
            {/* Starts full, empties as food is logged (Denis, Nov 20 2026). */}
            <Ring pct={target?.kcal ? 1 - Math.min(1, kcalPct) : 1} color={BRAND.gold} size={96} stroke={8}>
              {target?.kcal
                ? <span style={{ display: "grid", lineHeight: 1.05 }}><span style={{ fontFamily: BRAND.display, fontSize: 20, fontWeight: 700 }}>{fmt(Math.max(0, target.kcal - eaten.kcal))}</span><span style={{ fontSize: 11, color: BRAND.dim }}>kcal left</span></span>
                : <span style={{ fontFamily: BRAND.display, fontSize: 22, fontWeight: 700 }}>—</span>}
            </Ring>
          </div>
          <div style={{ ...sub, marginTop: 8 }}><b style={{ color: BRAND.text, fontWeight: 600 }}>{fmt(eaten.kcal)}</b>{target?.kcal ? ` / ${fmt(target.kcal)} kcal` : " kcal"}</div>
        </button>
        <button onClick={goTo ? () => goTo("nutrition") : undefined} aria-label="Macros" style={{ ...card, padding: 14, textAlign: "left", color: BRAND.text, fontFamily: "inherit", cursor: goTo ? "pointer" : "default", width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {[["Protein", "protein", "var(--green)"], ["Carbs", "carbs", "var(--blue)"], ["Fat", "fat", "var(--violet)"]].map(([l, k, c]) => {
            const a = Math.round(eaten[k] || 0), t = Math.round(target?.[k] || 0), pct = t ? a / t : 0;
            const left = t ? Math.max(0, 1 - Math.min(1, pct)) : 1; // bar starts full, shrinks as logged
            return (
              <div key={k} style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600 }}>{l}<span>{t ? `${Math.round(left * 100)}% left` : ""}</span></div>
                <div style={{ height: 5, borderRadius: 9, background: "var(--line-strong)", marginTop: 6, overflow: "hidden" }}><div style={{ width: `${left * 100}%`, height: "100%", borderRadius: 9, background: c }} /></div>
                <div style={{ fontSize: 12, marginTop: 4 }}><span style={{ color: c, fontWeight: 600 }}>{a}</span><span style={{ color: BRAND.dim }}>{t ? ` / ${t} g` : " g"}</span></div>
              </div>
            );
          })}
        </button>

        <Tile title="Weight" value={weight ? fmt(weight.value, 1) : "—"} unit="kg" label="Weight" onClick={canLog ? () => openLog("measure") : undefined}
          foot={weight ? <>{shortDate(weight.date, todayISO)}{wChange ? <> · <span style={{ color: wChange.color }}>{wChange.text} this week</span></> : null}</> : canLog ? "Tap to log" : "Not logged"} />
        <Tile title="Steps" value={steps ? fmt(steps) : "—"} label="Steps" ring={{ pct: steps / goals.steps, color: "var(--green)" }} onClick={canLog ? () => openLog("steps") : undefined} foot={`Goal ${fmt(goals.steps)}`} />
        <Tile title="Water" value={water ? fmt(water, 1) : "—"} unit="L" label="Water" ring={{ pct: water / goals.water, color: "var(--blue)" }} onClick={canLog ? () => openLog("water") : undefined} foot={`Goal ${goals.water} L`} />
        <Tile title="Sleep" value={sleep ? fmt(sleep, 1) : "—"} unit="hr" label="Sleep" ring={{ pct: sleep / goals.sleep, color: "var(--violet)" }} onClick={canLog ? () => openLog("sleep") : undefined} foot={`Goal ${goals.sleep} hr`} />
      </div>

      <button onClick={canLog ? () => openLog("measure") : undefined} aria-label="VO2 max" style={{ ...card, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", color: BRAND.text, fontFamily: "inherit", textAlign: "left", cursor: canLog ? "pointer" : "default", width: "100%" }}>
        <div><div style={h4}>VO₂ Max</div><div style={sub}>{vo2?.date ? `From your watch · ${shortDate(vo2.date, todayISO)}` : "From your watch / Apple Health"}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 700 }}>{vo2 ? fmt(vo2.value, 1) : "—"}</div><div style={{ ...sub, marginTop: 0 }}>{vo2 ? "ml/kg/min" : canLog ? "Tap to add" : ""}</div></div>
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Tile title="Resting HR" value={rhr ? fmt(rhr.value) : "—"} unit="bpm" label="Resting heart rate" onClick={canLog ? () => openLog("measure") : undefined}
          foot={rhr ? <>{shortDate(rhr.date, todayISO) || "Latest"}{rhr.change ? ` · ${rhr.change > 0 ? "↑" : "↓"}${Math.abs(rhr.change)}` : ""}</> : canLog ? "Tap to add" : "Not logged"} />
        <Tile title="Energy" value={energy ? energy.value : "—"} unit="/10" label="Energy" foot={energy ? energy.source : "Pick a mood above"} />
        <Tile title="Waist" value={waist ? fmt(waist.value, 1) : "—"} unit="cm" label="Waist" onClick={canLog ? () => openLog("measure") : undefined}
          foot={waist ? (waistChange ? <span style={{ color: waistChange.color }}>{waistChange.text} in 4 wks</span> : shortDate(waist.date, todayISO) || "Latest") : canLog ? "Tap to add" : "Not logged"} />
        <Tile title="Body fat" value={bodyFat ? fmt(bodyFat.value, 1) : "—"} unit="%" label="Body fat" onClick={goTo ? () => goTo("progress_hub") : undefined}
          foot={bodyFat ? `Last body scan · ${shortDate(bodyFat.date, todayISO)}` : "From your body scan"} />
        <Tile title="Protein streak" value={streak} unit={streak === 1 ? "day" : "days"} label="Protein streak" onClick={goTo ? () => goTo("nutrition") : undefined}
          foot={target?.protein ? `Hit ${Math.round(target.protein)} g+ protein` : "Needs a nutrition plan"} />
        <Tile title="Training" value={trainTotal ? `${trainDone}/${trainTotal}` : "—"} label="Training this week" onClick={goTo ? () => goTo("program") : undefined} foot="Sessions this week" />
      </div>
    </div>
  );
}
