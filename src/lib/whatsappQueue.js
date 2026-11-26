// Coach "Messages" (Nov 26 2026): the free one-tap WhatsApp version. Forge
// works out who should get a message right now and writes it; the coach taps
// Send, WhatsApp opens with the text typed, and the coach sends it from his
// own number. Nothing is sent automatically and nothing costs money.
//
// Pure functions only - the screen lives in features/coach/WhatsAppMessages.jsx.
// Settings + what was sent/skipped are kept in trainer_data, section "whatsapp":
//   { settings: { enabled: {kind: bool}, templates: {kind: text}, optOut: [clientId] },
//     done: { [itemKey]: { at: ISO, how: "sent" | "skipped" } } }
import { isoDate, weekKey, DAYS } from "./dateUtils.js";
import { buildProgramDays } from "./programModel.js";
import { thisWeeksCheckin } from "./checkinV2.js";
import { planVersionForDate } from "../features/nutrition-v2/nutritionV2Math.js";
import { normalizePlans, normalizeLogs } from "./nutritionV2.js";

export const KINDS = [
  { kind: "session_tomorrow", label: "Session tomorrow", hint: "From 4pm, for clients with a session the next day" },
  { kind: "session_today", label: "Session today", hint: "Morning of the session, until it starts" },
  { kind: "followup", label: "Follow-up", hint: "An hour after a session, or after a logged workout" },
  { kind: "missed", label: "Missed workout", hint: "Planned workout yesterday that wasn't logged" },
  { kind: "food", label: "Food nudge", hint: "Client with a plan who logged nothing by 2pm" },
  { kind: "checkin", label: "Check-in", hint: "Friday to Sunday, until this week's check-in is sent" },
  { kind: "payment", label: "Payment", hint: "3 days before it's due, and when overdue" },
];

export const DEFAULT_TEMPLATES = {
  session_tomorrow: "Hi {name}, see you tomorrow at {time} for our session 💪",
  session_today: "Hi {name}! Session today at {time}. Bring water and let's go 💪",
  followup: "Great work today {name}! How are you feeling?",
  missed: "Hey {name}, I saw yesterday's {workout} didn't get logged. All good? You can still do it today.",
  food: "Quick one {name}, don't forget to log your meals today 🍽️",
  checkin: "Hi {name}, check-in time! It takes 2 minutes in the Forge app.",
  payment: "Hi {name}, friendly reminder: your payment is due {date}. Thank you!",
};

export function mergedSettings(raw) {
  const s = raw || {};
  const enabled = {};
  KINDS.forEach(({ kind }) => { enabled[kind] = s.enabled?.[kind] !== false; });
  return {
    enabled,
    templates: { ...DEFAULT_TEMPLATES, ...(s.templates || {}) },
    optOut: Array.isArray(s.optOut) ? s.optOut : [],
  };
}

// "7:00 AM" / "07:00" / "19:30" -> minutes after midnight (or null).
export function slotMinutes(t) {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(String(t || ""));
  if (!m) return null;
  let h = Number(m[1]) % 24;
  const min = Number(m[2] || 0);
  const ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
}
const prettyTime = (t) => {
  const mins = slotMinutes(t);
  if (mins == null) return String(t || "");
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const dayKey = (date) => DAYS[(date.getDay() + 6) % 7]; // Mon..Sun
const addDays = (date, n) => new Date(date.getTime() + n * 86400000);
const prettyDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

// UAE-friendly WhatsApp number: digits only, 05x... -> 9715x..., 00 prefix dropped.
export function waNumber(phone) {
  let d = String(phone || "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("05")) d = `971${d.slice(1)}`;
  if (d.length === 9 && d.startsWith("5")) d = `971${d}`;
  return d.length >= 8 ? d : "";
}
export function waLink(phone, text) {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : "";
}

export function fillTemplate(text, vars) {
  return String(text || "").replace(/\{(\w+)\}/g, (all, k) => (vars[k] != null && vars[k] !== "" ? String(vars[k]) : all));
}

// Everything that should be messaged right now, minus what was already
// sent or skipped. Ordered by kind (KINDS order), then client name.
export function buildQueue(clients, rawSettings, done = {}, now = new Date()) {
  const settings = mergedSettings(rawSettings);
  const today = isoDate(now);
  const yesterday = isoDate(addDays(now, -1));
  const tomorrowDate = addDays(now, 1);
  const tomorrow = isoDate(tomorrowDate);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dow = now.getDay();
  const out = [];
  const add = (client, kind, key, vars) => {
    if (!settings.enabled[kind] || done[key]) return;
    const first = (client.name || "").split(" ")[0] || "there";
    out.push({ key, kind, client, clientId: client.id, phone: client.phone || "", text: fillTemplate(settings.templates[kind], { name: first, ...vars }) });
  };

  (clients || []).forEach((client) => {
    if (!client?.id || settings.optOut.includes(client.id)) return;
    const schedule = Array.isArray(client.schedule) ? client.schedule : [];
    const firstAt = (dayName) => schedule
      .filter((s) => s.day === dayName && slotMinutes(s.time) != null)
      .sort((a, b) => slotMinutes(a.time) - slotMinutes(b.time));

    // Sessions from the recurring schedule.
    if (nowMin >= 16 * 60) {
      const t = firstAt(dayKey(tomorrowDate))[0];
      if (t) add(client, "session_tomorrow", `session_tomorrow:${tomorrow}:${client.id}`, { time: prettyTime(t.time), day: "tomorrow" });
    }
    const todays = firstAt(dayKey(now));
    const next = todays.find((s) => slotMinutes(s.time) > nowMin);
    if (next && nowMin >= 5 * 60) add(client, "session_today", `session_today:${today}:${client.id}`, { time: prettyTime(next.time), day: "today" });

    // Follow-up: an hour after a scheduled session, or a workout logged today.
    const sessionDone = todays.some((s) => slotMinutes(s.time) + 60 <= nowMin);
    const loggedToday = (client.trainingLogs?.sessions || []).some((s) => s?.date === today && s?.status === "completed");
    if (sessionDone || loggedToday) add(client, "followup", `followup:${today}:${client.id}`, {});

    // Missed: yesterday's planned workout not logged.
    let days;
    try { days = buildProgramDays(client.program, client.trainingLogs); } catch { days = []; }
    const missed = days.find((d) => d.state === "missed" && d.dateISO === yesterday);
    if (missed) add(client, "missed", `missed:${yesterday}:${client.id}`, { workout: missed.workout?.name || "workout" });

    // Food: on a plan, nothing logged by 2pm.
    if (nowMin >= 14 * 60 && planVersionForDate(normalizePlans(client.nutritionV2Plans), today)) {
      const logs = normalizeLogs(client.nutritionV2Logs)?.[today];
      if (!Array.isArray(logs) || logs.length === 0) add(client, "food", `food:${today}:${client.id}`, {});
    }

    // Check-in: Fri-Sun, app users who haven't sent this week's.
    if ((dow === 5 || dow === 6 || dow === 0) && client.client_user_id && !thisWeeksCheckin(client.checkIns, now)) {
      add(client, "checkin", `checkin:${weekKey(now)}:${client.id}`, {});
    }

    // Payment: due within 3 days, or overdue.
    if (client.paymentDueDate && !client.paymentPaid) {
      const d = Math.round((new Date(`${client.paymentDueDate}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
      if (d <= 3) {
        const when = d < 0 ? `(it was due ${prettyDate(client.paymentDueDate)})` : d === 0 ? "today" : `on ${prettyDate(client.paymentDueDate)}`;
        add(client, "payment", `payment:${client.paymentDueDate}:${d < 0 ? "late" : "due"}:${client.id}`, { date: when });
      }
    }
  });

  const order = Object.fromEntries(KINDS.map((k, i) => [k.kind, i]));
  return out.sort((a, b) => order[a.kind] - order[b.kind] || (a.client.name || "").localeCompare(b.client.name || ""));
}

// Keep the done-log small: drop entries older than 21 days.
export function pruneDone(done, now = new Date()) {
  const cutoff = now.getTime() - 21 * 86400000;
  return Object.fromEntries(Object.entries(done || {}).filter(([, v]) => new Date(v?.at || 0).getTime() >= cutoff));
}
