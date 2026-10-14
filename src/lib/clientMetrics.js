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
