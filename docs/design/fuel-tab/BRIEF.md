# Fuel tab redesign — build brief for Claude Code

Approved by Denis on 2 Nov 2026 (picture-before-code: the picture is done).
The four mockups in this folder are the source of truth for layout, copy
and look:

| File | Screen |
|---|---|
| `Main.dc.html` | Client · Fuel › Today |
| `Swap.dc.html` | Client · Change a meal (swap / eating out / something else) — bottom sheet |
| `Week.dc.html` | Client · My week |
| `Coach.dc.html` | Coach · Tools › Nutrition |

They're "Design Component" files from a Claude design canvas: plain HTML with
inline styles, plus a small `renderVals()` script holding the sample data.
Read them as reference markup. Don't ship them or try to run them (they need
the canvas runtime). Rebuild each screen as React components inside the
existing app.

## Ground rules

- Reuse what exists. The nutrition-v2 feature (`src/features/nutrition-v2/`)
  already has signed plans, per-meal ticking (`source: "confirm"`),
  substitutions (`source: "sub"`, `replaces`), photo/quick logs, skipped marks,
  weekly progress and alert signals. This is mostly a new UI on that data,
  not a new data model.
- Keep the brand: true black `#000`, cards `#0d0d0d` / `#171717`, lines
  `#262626`, white accent `#EDEDED`, muted text `#a1a1a1`, protein green
  `#3DD68C`, amber `#FFA94D` for training day / off-plan, brand red
  `#ED000A` only for the coach avatar and real alerts. Uppercase labels. Don't
  touch GLOBAL_TEXT_CSS / typography.
- Swaps and off-plan meals are never shown in red. They're neutral or amber
  (no-shame logging).
- Touch targets ≥ 44 px. Real `<button>`s and labelled inputs.
- Keep the existing date rules (local `isoDate`, `addDaysISO`, no `toISOString()` for dates).
- Add or extend vitest tests for any new pure logic in `nutritionV2Math.js`.

## Client · Today (`Main.dc.html`)

- Header: weekday + program week, "FUEL", and a day-type chip (Training day / Rest day / Dinner out …).
- A 7-day strip (Mon–Sun) with today highlighted. Its dots mark training days.
- Double ring: outer = calories, inner = protein (green). Centre = "g protein left".
  Beside it: protein x / target, calories x / target, "n of 4 meals on plan".
- Coach tip card (red "D" avatar, one short line from the coach).
- Meal cards in plan order, each showing time, kcal and protein, and its items with amounts.
  - The first not-done meal is outlined white and tagged NEXT.
  - **Ate it** (primary, 2/3 width) logs the whole prescribed meal as eaten,
    i.e. one `confirm` entry per plan item at full qty. This is the same as the
    existing confirm path.
  - **Swap** opens the Change-a-meal sheet.
  - Once done, the card collapses to "Ate as planned · 12:51 PM" with an **Undo** link.
- Dashed **+ Ate something off-plan** button → the same sheet, section 3.
- **This week** link card ("5-day streak · 86% on plan") → My week.
- Bottom nav as it is today (Today · Train · Fuel · Check-in · Learn · Me), with Fuel active.

## Client · Change a meal (`Swap.dc.html`)

A bottom sheet over Today, titled with the meal and its time. There are three sections:

1. **Swap for another plan meal.** Show the same meal slot from the client's
   other weekdays in the rotation (e.g. Thursday's lunch), with its protein.
   If an option has noticeably less protein than the planned meal, show an amber
   hint telling the client how to cover the gap. Saving a swap logs `sub`
   entries with `replaces: <mealKey>` and the macros of the chosen meal.
2. **Eating out.** Three tiles: "1st grilled protein", "+1 one starch",
   "Skip fried & sweet drinks". A **Log as eating out** button logs a `quick` entry
   with an estimate flag. The default estimate comes from a coach-set value, or
   the planned meal's macros if none is set.
3. **Something else.** Photo button, a "What did you eat?" text input and
   Small / Normal / Large chips. This saves a `photo` or `quick` entry with
   `estimate: true`. Copy: "No counting. A photo and a word is enough. Coach
   Denis sees it."

The primary button at the bottom is **Save lunch** (uses the meal's name).

## Client · My week (`Week.dc.html`)

- On-plan % for the last 7 days ("24 of 28 meals ticked or swapped") and a day-streak tile.
- A day-by-day grid: one row per day with its day-type label, 4 meal cells and that day's protein.
  - Cell states: ✓ as planned (green), ⇄ swapped (light green), + off-plan (amber), empty outline = missed.
  - The marks must differ in shape, not only colour.
  - Protein under 100 g (or meaningfully under target) shows amber.
- Avg protein and avg calories tiles with bars against target.
- Weight 7-day moving-average card with a sparkline and the weekly change. Data
  comes from the existing measurements/check-in weigh-ins. If there isn't
  enough data, hide the card.
- The coach's latest weekly review note.

"Swapped" counts as on plan. "Off-plan" and "missed" don't.

## Coach · Tools › Nutrition (`Coach.dc.html`)

A fluid page with the roster on the left and the selected client on the right.
On narrow screens they stack.

- Filter pills: Needs attention (count) · All clients · Online · In-person.
- **Roster table**: client, on-plan %, protein avg / target, weight trend, and a one-line flag.
  - Flags: "No log for N days", "Protein short X of 7 days", "Weekend off-plan", "On track", "No plan yet · create".
  - Sorted with "needs attention" first. Reuse `recentAlertSignals` / `attentionFlagFor`.
- **Selected client header**: name, goal, type, targets, plus Message and Edit plan buttons.
- **Weekly check-in suggestion card**: a headline, one line of reasons, and
  **Keep / −100 kcal / +100 kcal** buttons.
  - Suggested rule for fat loss: if the 7-day-average weight trend is between
    −0.25% and −1% of bodyweight per week and on-plan ≥ 75% → Keep.
  - If the trend is flat for 2+ weeks with on-plan ≥ 75% → suggest −100 kcal.
  - If on-plan < 75% → Keep, and say the plan isn't the problem yet.
  - Applying a change publishes a new plan version from the next Monday
    (`publishPlan`). Denis always confirms; nothing auto-changes.
- **Last 7 days meal heatmap**: the same states and legend as the client week grid.
- **Off-plan this week** list: photo thumbnail, text, when, portion, and a **Reply** button that sends a message to the client.
- **Week rotation editor**: Mon–Sun tabs, each showing its label (Training /
  Rest / Dinner out …) and planned kcal, plus the selected day's 4 meals.
  Actions: **Copy Mon to…** and **Make eating-out day**.

## Data model addition: weekly rotation (needed by Today's day chip, Swap options and the Coach rotation editor)

A plan version gets an optional `days` map, keyed "1".."7" (Mon..Sun, the same
numbering as a program workout's `dayOfWeek`). Each entry can set its own
`meals`, `targets` and `label`. Weekdays without an entry use the version's own
meals and targets.

- `planVersionForDate(plans, date)` returns the stored version. The coach
  builder edits this one.
- `planForDate(plans, date)` returns that version resolved to the date's
  weekday, including `dayLabel`. Every client screen and calculation already
  goes through it.

Plans without `days` must behave exactly as before.

A first implementation of exactly this was written and then reverted on
2 Nov. See commit `9267baa` (the app side is in `src/features/nutrition-v2/*`;
it also added `days` + per-meal `note` support to `supabase/functions/forge-mcp`).
Cherry-picking it is a valid starting point if Denis approves.

## Suggested build order

1. Rotation data layer + tests (or cherry-pick `9267baa`).
2. Client Today (the biggest daily-use win).
3. Change-a-meal sheet.
4. My week.
5. Coach Nutrition page, then the rotation editor inside it.

Show Denis each screen on a real phone before moving to the next.
