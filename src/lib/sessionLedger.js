// Session packages + ledger (Nov 28 2026). Nothing is ever deducted
// automatically - only the coach uses a session (after logging a workout,
// from today's list, or by deciding on a late cancellation).
//
// client.packages (section "packages"): [{ id, name, total, used, ... }]
//   newest first; "used" stays the running count, so the counts clients
//   already had are the starting point.
// client.sessionLedger (section "session_ledger"): { windowHours, events }
//   events: { id, type: "used", date, time, reason: "session"|"late_cancel"|"manual", packageId, at, by }
//           { id, type: "cancelled", date, time, by: "client"|"coach", late, decision: null|"used"|"waived"|"free", at, usedEventId }
import { uid } from "./uid.js";
import { isoDate, DAYS } from "./dateUtils.js";
import { slotMinutes } from "./whatsappQueue.js";

export const DEFAULT_WINDOW_HOURS = 12;

export function ledgerOf(client) {
  const l = client?.sessionLedger || {};
  return { windowHours: Number(l.windowHours) > 0 ? Number(l.windowHours) : DEFAULT_WINDOW_HOURS, events: Array.isArray(l.events) ? l.events : [] };
}
const packagesOf = (client) => (Array.isArray(client?.packages) ? client.packages : []);

// The package sessions come out of: the newest one that still has sessions
// left, otherwise the newest one.
export function activePackage(client) {
  const list = packagesOf(client);
  return list.find((p) => Number(p.used || 0) < Number(p.total || 0)) || list[0] || null;
}
export function packageLeft(p) { return p ? Math.max(0, Number(p.total || 0) - Number(p.used || 0)) : 0; }
export function sessionsLeft(client) { return packageLeft(activePackage(client)); }

// Session start as a local Date.
export function startsAt(date, time) {
  const mins = slotMinutes(time);
  const d = new Date(`${date}T00:00:00`);
  if (mins != null) d.setMinutes(mins);
  return d;
}
export function freeUntil(client, date, time) {
  return new Date(startsAt(date, time).getTime() - ledgerOf(client).windowHours * 3600000);
}

const sameSlot = (e, date, time) => e.date === date && String(e.time || "") === String(time || "");
export const usedEventFor = (client, date, time) => ledgerOf(client).events.find((e) => e.type === "used" && sameSlot(e, date, time));
export const cancelEventFor = (client, date, time) => ledgerOf(client).events.find((e) => e.type === "cancelled" && sameSlot(e, date, time));

// Scheduled (recurring) sessions on one date: [{ date, time }].
export function scheduledOn(client, date) {
  const day = DAYS[(new Date(`${date}T12:00:00`).getDay() + 6) % 7];
  return (Array.isArray(client?.schedule) ? client.schedule : [])
    .filter((s) => s.day === day && slotMinutes(s.time) != null)
    .sort((a, b) => slotMinutes(a.time) - slotMinutes(b.time))
    .map((s) => ({ date, time: s.time }));
}

// Upcoming sessions (not cancelled), from now for `days` days.
export function upcomingSessions(client, now = new Date(), days = 21) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = isoDate(new Date(now.getTime() + i * 86400000));
    scheduledOn(client, date).forEach((s) => {
      if (startsAt(s.date, s.time) <= now) return;
      if (cancelEventFor(client, s.date, s.time)) return;
      out.push({ ...s, freeUntil: freeUntil(client, s.date, s.time) });
    });
  }
  return out;
}

function withLedger(client, events, extra = {}) {
  const l = ledgerOf(client);
  return { ...client, ...extra, sessionLedger: { windowHours: l.windowHours, events } };
}

// Coach uses one session. Returns the updated client (packages + ledger).
export function spendSession(client, { date, time = "", reason = "session", now = new Date() }) {
  const pkg = activePackage(client);
  const ev = { id: uid(), type: "used", date, time, reason, packageId: pkg?.id || null, at: now.toISOString(), by: "coach" };
  const packages = pkg ? packagesOf(client).map((p) => (p.id === pkg.id ? { ...p, used: Number(p.used || 0) + 1 } : p)) : packagesOf(client);
  return { client: withLedger(client, [...ledgerOf(client).events, ev], { packages }), event: ev };
}

// Undo a use: give the session back to its package and drop the event
// (a late-cancel decision goes back to "waiting for you").
export function undoUse(client, eventId) {
  const ev = ledgerOf(client).events.find((e) => e.id === eventId);
  if (!ev) return client;
  const packages = packagesOf(client).map((p) => (p.id === ev.packageId ? { ...p, used: Math.max(0, Number(p.used || 0) - 1) } : p));
  const events = ledgerOf(client).events
    .filter((e) => e.id !== eventId)
    .map((e) => (e.usedEventId === eventId ? { ...e, decision: null, usedEventId: null } : e));
  return withLedger(client, events, { packages });
}

// Cancel a scheduled session. Client cancelling inside the window is marked
// late and waits for the coach's decision; everything else is free.
export function cancelSession(client, { date, time, by, now = new Date() }) {
  const late = by === "client" && now >= freeUntil(client, date, time);
  const ev = { id: uid(), type: "cancelled", date, time, by, late, decision: late ? null : "free", at: now.toISOString() };
  return withLedger(client, [...ledgerOf(client).events, ev]);
}

export function decideLateCancel(client, eventId, decision, now = new Date()) {
  const ev = ledgerOf(client).events.find((e) => e.id === eventId);
  if (!ev) return client;
  if (decision === "used") {
    const { client: next, event } = spendSession(client, { date: ev.date, time: ev.time, reason: "late_cancel", now });
    return withLedger(next, ledgerOf(next).events.map((e) => (e.id === eventId ? { ...e, decision: "used", usedEventId: event.id } : e)));
  }
  return withLedger(client, ledgerOf(client).events.map((e) => (e.id === eventId ? { ...e, decision: "waived" } : e)));
}

export const pendingLateCancels = (client) => ledgerOf(client).events.filter((e) => e.type === "cancelled" && e.late && !e.decision);

// For the calendar: date -> "used" | "late" | "cancelled" | "upcoming".
export function monthMarks(client, monthISO, now = new Date()) {
  const marks = {};
  ledgerOf(client).events.forEach((e) => {
    if (!e.date?.startsWith(monthISO)) return;
    if (e.type === "used") marks[e.date] = e.reason === "late_cancel" ? "late" : "used";
    else if (e.type === "cancelled" && !marks[e.date]) marks[e.date] = "cancelled";
  });
  upcomingSessions(client, now, 45).forEach((s) => { if (s.date.startsWith(monthISO) && !marks[s.date]) marks[s.date] = "upcoming"; });
  return marks;
}

export function setWindowHours(client, hours) {
  return { ...client, sessionLedger: { ...ledgerOf(client), windowHours: Math.max(1, Math.round(Number(hours) || DEFAULT_WINDOW_HOURS)) } };
}
