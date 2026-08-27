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
