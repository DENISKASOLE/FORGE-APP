// Resolves a calendar date's "day type" - the chip on Main.dc.html's
// header, the dot under each day in the 7-day strip, and the day-type
// label in Week.dc.html's day-by-day grid (and, later, the coach
// dashboard's roster heatmap and rotation editor). The nutrition
// rotation's own label wins when the coach has set one for that weekday
// (the rotation editor can call a day "Training", "Rest", "Dinner out",
// anything); otherwise it falls back to whether the client's training
// program actually has a workout that date. "Training" amber-dots;
// everything else (Rest, Dinner out, Lunch out, ...) is neutral -
// matches the Coach rotation editor's own border-color rule (only the
// literal "Training" label gets the amber outline).
export function dayTypeFor(resolvedPlan, hasWorkout) {
  if (resolvedPlan?.dayLabel) {
    const lower = resolvedPlan.dayLabel.toLowerCase();
    const label = lower === "training" ? "Training day" : lower === "rest" ? "Rest day" : resolvedPlan.dayLabel;
    return { label, training: lower.includes("train") };
  }
  return { label: hasWorkout ? "Training day" : "Rest day", training: hasWorkout };
}
