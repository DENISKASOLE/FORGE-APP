// Client Home bell (Nov 2026). Notifications are derived from the client's
// own data on every render - nothing new is stored server-side. Each one has
// a stable id so the badge can tell which ones the client has already seen
// (kept per device in localStorage). An item stays in the list until the
// thing behind it is resolved (session done, check-in sent, payment marked
// paid); only the red badge clears when the bell is opened.
import { isoDate, weekKey } from "./dateUtils.js";
import { buildProgramDays } from "./programModel.js";
import { thisWeeksCheckin } from "./checkinV2.js";

const dayName = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

export function clientNotifications(client, now = new Date()) {
  const today = isoDate(now);
  const out = [];

  // Payment: due within 5 days, or overdue.
  if (client?.paymentDueDate && !client.paymentPaid) {
    const d = daysBetween(today, client.paymentDueDate);
    if (d <= 5) {
      const overdue = d < 0;
      out.push({
        id: `pay:${client.paymentDueDate}:${overdue ? "late" : "due"}`, kind: "payment", target: "payments", urgent: overdue || d <= 1,
        title: overdue ? "Payment overdue" : d === 0 ? "Payment due today" : `Payment due in ${d} day${d === 1 ? "" : "s"}`,
        body: overdue ? `Your payment was due ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago. Tap to see the details.` : `Due on ${dayName(client.paymentDueDate)}.`,
        date: client.paymentDueDate,
      });
    }
  }

  // Check-in: from Friday until this week's one is sent.
  const dow = now.getDay();
  if ((dow === 5 || dow === 6 || dow === 0) && !thisWeeksCheckin(client?.checkIns, now)) {
    out.push({
      id: `checkin:${weekKey(now)}`, kind: "checkin", target: "checkins", urgent: dow === 0,
      title: dow === 0 ? "Check-in due today" : "Your weekly check-in is ready",
      body: "2 minutes. Your coach reads every answer.", date: today,
    });
  }

  // Missed sessions in the last 7 days (not today).
  const from = isoDate(new Date(now.getTime() - 7 * 86400000));
  const missed = buildProgramDays(client?.program, client?.trainingLogs)
    .filter((d) => d.state === "missed" && d.dateISO >= from && d.dateISO < today)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  missed.forEach((d) => {
    out.push({
      id: `missed:${d.dateISO}:${d.workout?.id || d.key}`, kind: "missed", target: "program", urgent: false,
      title: `Missed: ${d.workout?.name || "Workout"}`,
      body: `Planned for ${dayName(d.dateISO)}. You can still do it today.`, date: d.dateISO,
    });
  });
  return out;
}

const SEEN_KEY = (id) => `forge_notif_seen_${id}`;
export function readSeen(clientId) {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(clientId)) || "[]")); } catch { return new Set(); }
}
export function markSeen(clientId, ids) {
  try { localStorage.setItem(SEEN_KEY(clientId), JSON.stringify([...new Set([...readSeen(clientId), ...ids])].slice(-200))); } catch { /* ignore */ }
}
