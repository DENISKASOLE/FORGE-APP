import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { normalizeSlots, timeKey } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { startOfWeek, addDays, weekKey, weekRangeLabel, weekDays } from "../../lib/dateUtils.js";
import { upsertTrainerData, timeLabel } from "../../lib/clientData.js";
import { CLIENT_COLORS } from "../../lib/constants.js";
import { autoBookingsFor } from "./coachHelpers.js";

export function Calendar({ clients, refresh, user }) {
  const [slots, setSlots] = useState(() => normalizeSlots(JSON.parse(localStorage.getItem("forge_time_slots") || "null")));
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem("forge_calendar_zoom") || 1));
  const [bookings, setBookings] = useState([]);
  const [newSlot, setNewSlot] = useState("");
  const [draft, setDraft] = useState(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = weekDays(weekStart);
  const currentWeekKey = weekKey(weekStart);
  useEffect(() => { load(); }, []);
  async function load() { const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uidVal).eq("section", "calendar").maybeSingle(); setBookings(data?.data?.bookings || []); }
  async function save(next) { setBookings(next); const uidVal = user?.id || (await supabase.auth.getUser()).data.user?.id; await upsertTrainerData(uidVal, "calendar", { bookings: next }); }
  function autoBookings() { return autoBookingsFor(clients, weekStart); }
  const all = [...autoBookings(), ...bookings.filter((b) => b.weekKey === currentWeekKey || days.some((d) => d.date === b.date))];
  function removeSlot(id) { const next = slots.filter((x) => x.id !== id); setSlots(next); localStorage.setItem("forge_time_slots", JSON.stringify(next)); }
  function addSlot() { if (!newSlot) return; const next = [...slots, { id: uid(), label: newSlot }]; setSlots(next); localStorage.setItem("forge_time_slots", JSON.stringify(next)); setNewSlot(""); }
  function openBooking(dayObj, slot, existing) { const b = existing || {}; const client = clients.find((c) => c.id === b.clientId) || clients[0]; setDraft({ id: b.id || null, weekKey: currentWeekKey, date: dayObj.date, day: dayObj.name, time: b.time || slot.label, type: b.type || "Client Session", clientId: b.clientId || client?.id || "", title: b.title || client?.name || "", color: b.color || client?.color || BRAND.blue, auto: !!b.auto }); }
  function saveDraft() { if (!draft?.title) { alert("Add a booking name or choose a client."); return; } const color = draft.type === "Free Trial" ? BRAND.red : draft.color; const clean = { ...draft, color, auto: false, id: draft.id?.startsWith("auto_") ? uid() : draft.id || uid() }; save([...(bookings.filter((x) => x.id !== draft.id)), clean]); setDraft(null); }
  const goWeek = (n) => setWeekStart((w) => addDays(w, n * 7));
  function setCalendarZoom(next) {
    const clean = Math.max(0.45, Math.min(1.8, Number(next)));
    setZoom(clean);
    localStorage.setItem("forge_calendar_zoom", String(clean));
  }
  const calendarCellHeight = zoom <= 0.7 ? 48 : zoom >= 1.25 ? 82 : 64;
  const calendarMinWidth = zoom <= 0.75 ? 760 : 920;
  return <Card style={{ overflowX: "auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      <div><div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.gold }}>Calendar</div><div style={{ color: BRAND.muted }}>{weekRangeLabel(weekStart)}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="dark" onClick={() => goWeek(-1)}>Previous Week</Button><Button variant="dark" onClick={() => setWeekStart(startOfWeek(new Date()))}>This Week</Button><Button variant="dark" onClick={() => goWeek(1)}>Next Week</Button></div>
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <input value={newSlot} onChange={(e) => setNewSlot(e.target.value)} placeholder="Add time e.g. 6:30 PM" style={inputStyle({ maxWidth: 190 })} /><Button onClick={addSlot}>Add time</Button>
      <Button variant="dark" onClick={() => setCalendarZoom(zoom - 0.1)}>Zoom -</Button><input type="range" min="0.45" max="1.8" step="0.05" value={zoom} onChange={(e) => setCalendarZoom(e.target.value)} style={{ width: 180 }} /><div style={{ color: BRAND.muted, fontWeight: 900 }}>{Math.round(zoom * 100)}%</div><Button variant="dark" onClick={() => setCalendarZoom(zoom + 0.1)}>Zoom +</Button><Button variant="ghost" onClick={() => setCalendarZoom(0.65)}>Fit Week</Button><Button variant="ghost" onClick={() => setCalendarZoom(1)}>Reset</Button>
    </div>
    <div style={{ overflowX: "auto", overflowY: "hidden", width: "100%" }}>
      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, minWidth: calendarMinWidth }}>
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "separate", borderSpacing: zoom < 0.75 ? 4 : 6, minWidth: calendarMinWidth }}><thead><tr><th style={{ width: 90 }}></th>{days.map((d) => <th key={d.date} style={{ color: BRAND.gold }}>{d.label}</th>)}</tr></thead><tbody>{slots.map((slot) => <tr key={slot.id}><td style={{ color: BRAND.muted, fontWeight: 900, width: 90 }}>{timeLabel(slot.label)} <button onClick={() => removeSlot(slot.id)} style={{ background: "transparent", border: "none", color: BRAND.red, cursor: "pointer" }}>x</button></td>{days.map((d) => { const b = all.find((x) => (x.date === d.date || x.day === d.name) && timeKey(x.time) === timeKey(slot.label)); return <td key={d.date} onClick={() => openBooking(d, slot, b)} style={{ height: calendarCellHeight, width: 120, background: b ? b.color : "#0b0c10", color: b ? "#000" : BRAND.dim, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: zoom < 0.75 ? 5 : 8, cursor: "pointer", fontWeight: 900, verticalAlign: "top", overflow: "hidden" }}>{b ? <><div style={{ fontSize: zoom < 0.75 ? 10 : 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.type === "Free Trial" ? "TRIAL" : b.title}</div><div style={{ fontSize: 10, opacity: .75 }}>{b.time}</div></> : ""}{b && !b.auto && <button onClick={(e) => { e.stopPropagation(); save(bookings.filter((x) => x.id !== b.id)); }} style={{ float: "right", background: "transparent", border: "none", cursor: "pointer" }}>x</button>}</td>; })}</tr>)}</tbody></table>
      </div>
    </div>
    {draft && <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 540 }}><div style={{ fontSize: 24, fontWeight: 1000, marginBottom: 12 }}>{draft.auto ? "Reschedule" : "Book"} {draft.day} · {draft.time}</div><label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>TYPE</div><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value, color: e.target.value === "Free Trial" ? BRAND.red : draft.color })} style={inputStyle()}><option>Client Session</option><option>Free Trial</option><option>Consultation</option></select></label>{draft.type !== "Free Trial" && <label style={{ display: "block", marginTop: 10 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>CLIENT</div><select value={draft.clientId} onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setDraft({ ...draft, clientId: e.target.value, title: c?.name || draft.title, color: c?.color || draft.color }); }} style={inputStyle()}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}<Field label="Booking name" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} /><label style={{ display: "block", marginTop: 10 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>TIME</div><select value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} style={inputStyle()}>{slots.map((s) => <option key={s.id}>{s.label}</option>)}</select></label><div style={{ marginTop: 10 }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 6 }}>COLOR</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{CLIENT_COLORS.map((c) => <button key={c} disabled={draft.type === "Free Trial"} onClick={() => setDraft({ ...draft, color: c })} style={{ width: 34, height: 34, borderRadius: 12, border: draft.color === c ? `3px solid ${BRAND.text}` : `1px solid ${BRAND.line}`, background: draft.type === "Free Trial" ? BRAND.red : c, opacity: draft.type === "Free Trial" ? .45 : 1, cursor: "pointer" }} />)}</div></div><div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button onClick={saveDraft} style={{ flex: 1 }}>Save booking</Button><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div></Card></div>}
  </Card>;
}
