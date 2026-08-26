import { supabase } from "../../supabaseClient.js";
import { isoDate, startOfWeek, weekKey, weekDays } from "../../lib/dateUtils.js";
import { daysSince, paymentStatus } from "../../lib/clientData.js";

export function autoBookingsFor(clients, weekStart) {
  const days = weekDays(weekStart);
  const currentWeekKey = weekKey(weekStart);
  return clients.flatMap((c) => (c.schedule || []).map((s) => {
    const foundDay = days.find((d) => d.name === s.day);
    return { id: `auto_${currentWeekKey}_${c.id}_${s.day}_${s.time}`, weekKey: currentWeekKey, date: foundDay?.date || "", day: s.day, time: s.time, title: c.name, type: "Client Session", color: c.color, auto: true, clientId: c.id };
  }));
}
export async function countTodaysCalendarSessions(clients, trainerId) {
  const todayISO = isoDate(new Date());
  const weekStart = startOfWeek(new Date());
  const currentWeekKey = weekKey(weekStart);
  const auto = autoBookingsFor(clients, weekStart);
  let saved = [];
  if (trainerId) {
    const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "calendar").maybeSingle();
    saved = data?.data?.bookings || [];
  }
  const all = [...auto, ...saved.filter((b) => b.weekKey === currentWeekKey || b.date === todayISO)];
  return all.filter((b) => b.date === todayISO).length;
}
export async function loadTodaysAgenda(clients, trainerId) {
  const todayISO = isoDate(new Date());
  const weekStart = startOfWeek(new Date());
  const currentWeekKey = weekKey(weekStart);
  const auto = autoBookingsFor(clients, weekStart);
  let saved = [];
  if (trainerId) {
    const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "calendar").maybeSingle();
    saved = data?.data?.bookings || [];
  }
  const all = [...auto, ...saved.filter((b) => b.weekKey === currentWeekKey || b.date === todayISO)];
  const sessions = all.filter((b) => b.date === todayISO)
    .map((b) => {
      const client = clients.find((c) => c.id === b.clientId);
      const hasInjury = !!(client?.profile?.injuries || "").trim() && !/^none\b|^no\b|^n\/a$/i.test((client?.profile?.injuries || "").trim());
      return { ...b, hasInjury, injuryNote: hasInjury ? client.profile.injuries : "" };
    })
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const checkInsDue = clients.filter((c) => {
    const submissions = c.checkIns || [];
    const last = submissions[submissions.length - 1];
    const daysSinceLast = last ? daysSince(last.date) : null;
    return daysSinceLast === null || daysSinceLast >= 7;
  });

  const paymentsDue = clients.filter((c) => c.clientType === "Online" && ["overdue", "due"].some((k) => (paymentStatus(c).label || "").toLowerCase().includes(k)));

  return { sessions, checkInsDue, paymentsDue };
}
