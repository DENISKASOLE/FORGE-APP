export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
export function isoDate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function weekKey(date) {
  return isoDate(startOfWeek(date));
}
export function weekRangeLabel(start) {
  const a = new Date(start);
  const b = addDays(a, 6);
  return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${b.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}
export function weekDays(start) {
  return DAYS.map((name, i) => {
    const date = addDays(start, i);
    return { name, date: isoDate(date), label: `${name} ${date.getDate()}` };
  });
}
// Weekly check-in window: opens every Saturday and stays open through
// Tuesday, then closes (no more nagging) until the next Saturday reopens it -
// rather than a rolling "7 days since last submission" window.
const CHECKIN_OPEN_WEEKDAYS = [6, 0, 1, 2]; // Sat, Sun, Mon, Tue (Date#getDay())

export function isCheckInWindowOpen(date = new Date()) {
  return CHECKIN_OPEN_WEEKDAYS.includes(date.getDay());
}
export function checkInWindowStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - 6 + 7) % 7; // days since the most recent Saturday
  d.setDate(d.getDate() - diff);
  return d;
}
// Owed right now: the window is open (Sat-Tue) and nothing has been
// submitted since it started.
export function isCheckInDue(submissions, date = new Date()) {
  if (!isCheckInWindowOpen(date)) return false;
  const windowStartISO = isoDate(checkInWindowStart(date));
  const last = (submissions || [])[submissions.length - 1];
  return !last || last.date < windowStartISO;
}
// Already handled for this window, regardless of whether the window is
// still open - keeps a "you're all caught up" state visible until Saturday.
export function hasSubmittedThisCheckInWindow(submissions, date = new Date()) {
  const windowStartISO = isoDate(checkInWindowStart(date));
  const last = (submissions || [])[submissions.length - 1];
  return !!last && last.date >= windowStartISO;
}

// Counts consecutive weeks (this week backwards) that have at least one date
// in `dates` (an array of ISO date strings). Used for streak indicators.
export function currentStreakWeeks(dates) {
  const weeksWithActivity = new Set((dates || []).filter(Boolean).map((d) => weekKey(new Date(d))));
  let streak = 0;
  let cursor = new Date();
  while (weeksWithActivity.has(weekKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}
