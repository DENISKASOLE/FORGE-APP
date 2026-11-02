// Small cross-feature metrics derived from client data that don't belong
// to any one feature's lib file. Lives here (not in trainingLogs.js or
// nutrition.js) so both ProgressTab.jsx and the Progress Report can import
// it without duplicating the regex-match logic.
export function weightHistoryFromCheckins(checkIns) {
  const points = [];
  (checkIns || []).forEach((c) => {
    const ans = (c.answers || []).find((a) => /weight/i.test(a.question));
    const val = ans ? parseFloat(String(ans.answer).replace(/[^0-9.]/g, "")) : NaN;
    if (!isNaN(val) && val > 0) points.push({ date: c.date, value: val });
  });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
// Weight trend for the Fuel tab redesign's "My week" screen (DECISIONS.md
// "Fuel tab redesign"). Check-ins in this app are weekly (isCheckInDue's
// Sat-Tue window, dateUtils.js), not daily, so a true 7-day rolling
// average would almost always just be the single most recent weigh-in
// anyway - this uses each logged weigh-in as its own point directly
// rather than manufacturing a denser average the real data doesn't
// support. Returns null when there isn't enough to show a trend (the
// brief's own rule: "if there isn't enough data, hide the card").
export function weightTrend(checkIns, maxPoints = 8) {
  const all = weightHistoryFromCheckins(checkIns);
  if (all.length < 2) return null;
  const points = all.slice(-maxPoints);
  const current = points[points.length - 1].value;
  const change = current - points[points.length - 2].value;
  return { points, current, change };
}
