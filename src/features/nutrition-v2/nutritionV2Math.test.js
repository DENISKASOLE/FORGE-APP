import { describe, it, expect } from "vitest";
import {
  itemMacros, mealTotals, dayTotals, planForDate, publishPlan, nextDraftFrom,
  mealStatus, unplannedEntries, loggedDayTotals, dayAdherence, mergeLegacyMacroLog, addDaysISO,
  weekDatesEnding, weeklyProgress, weeklyInsights, recentAlertSignals, suggestSavedMealsFromHistory,
} from "./nutritionV2Math.js";
import { foodRefFromRow, newPlanItem, newPlanMeal, newPlanVersion, newLogEntry, normalizeFoodRow } from "./nutritionV2Model.js";

const chickenRow = { id: "chk", name: "Chicken breast, cooked", unit: "g", kcal: 165, protein: 31, carbs: 0, fat: 3.6 };
const eggRow = { id: "egg", name: "Egg, hard-boiled", unit: "piece", pieceGrams: 50, kcal: 155, protein: 12.6, carbs: 1.1, fat: 10.6 };
const oatsContainerRow = { id: "gy", name: "Greek yogurt 0%, container", basisGrams: 170, servings: [{ label: "container", grams: 170 }, { label: "g", grams: 1 }], kcal: 90, protein: 18, carbs: 5, fat: 0 };

describe("normalizeFoodRow - upgrading the old per-100g/ml/piece-only shape losslessly", () => {
  it("a plain gram food gets basisGrams 100 and a 1:1 g serving", () => {
    const f = normalizeFoodRow(chickenRow);
    expect(f.basisGrams).toBe(100);
    expect(f.servings).toEqual([{ label: "g", grams: 1 }]);
  });
  it("a piece food's pieceGrams becomes its own named serving, plus a gram fallback", () => {
    const f = normalizeFoodRow(eggRow);
    expect(f.servings).toEqual([{ label: "piece", grams: 50 }, { label: "g", grams: 1 }]);
  });
  it("a food already in the new shape passes through unchanged", () => {
    expect(normalizeFoodRow(oatsContainerRow)).toBe(oatsContainerRow);
  });
});

describe("itemMacros / mealTotals / dayTotals - plan items snapshot macros AND grams-per-unit", () => {
  it("scales a gram food by qty/100", () => {
    const food = foodRefFromRow(chickenRow);
    const item = newPlanItem(food, 180, "g");
    const m = itemMacros(item);
    expect(m.kcal).toBeCloseTo(165 * 1.8, 4);
    expect(m.protein).toBeCloseTo(31 * 1.8, 4);
  });
  it("a piece food's qty is in pieces, each worth pieceGrams", () => {
    const food = foodRefFromRow(eggRow);
    const item = newPlanItem(food, 3, "piece");
    const m = itemMacros(item);
    // 3 eggs * 50g = 150g, /100 * 155 kcal = 232.5
    expect(m.kcal).toBeCloseTo(232.5, 4);
  });
  it("a container-basis food (not per-100g) scales off its own basisGrams", () => {
    const food = foodRefFromRow(oatsContainerRow);
    const item = newPlanItem(food, 2, "container"); // 2 containers = 340g, basis is 170g
    const m = itemMacros(item);
    expect(m.kcal).toBeCloseTo(90 * 2, 4);
  });
  it("later changing the food library row never changes an already-snapshotted item's macros", () => {
    const food = foodRefFromRow(chickenRow);
    const item = newPlanItem(food, 100, "g");
    const before = itemMacros(item);
    chickenRow.kcal = 9999; // mutate the "live" row after the fact
    expect(itemMacros(item)).toEqual(before);
    chickenRow.kcal = 165; // restore for other tests
  });
  it("mealTotals/dayTotals sum across items and meals", () => {
    const meal = newPlanMeal("breakfast");
    meal.items = [newPlanItem(foodRefFromRow(eggRow), 3, "piece"), newPlanItem(foodRefFromRow(chickenRow), 100, "g")];
    const mt = mealTotals(meal);
    expect(mt.kcal).toBeCloseTo(232.5 + 165, 4);
    const plan = newPlanVersion({ from: "2026-10-01" });
    plan.meals = [meal];
    expect(dayTotals(plan).kcal).toBeCloseTo(mt.kcal, 4);
  });
});

describe("planForDate / publishPlan - continuous date-range versioning", () => {
  it("publishing v2 while v1 is already live closes v1's range but keeps it 'published', not 'archived'", () => {
    const v1 = { ...newPlanVersion({ version: 1, from: "2026-09-01" }), status: "published", published: "Sep 1" };
    const v2draft = newPlanVersion({ version: 2, from: "2026-10-01" });
    const plans = publishPlan([v1], v2draft, "Oct 1");
    const archivedV1 = plans.find((p) => p.version === 1);
    expect(archivedV1.status).toBe("published");
    expect(archivedV1.to).toBe("2026-09-30");
    expect(planForDate(plans, "2026-09-15")).toMatchObject({ version: 1 });
    expect(planForDate(plans, "2026-10-01")).toMatchObject({ version: 2 });
  });
  it("a plan entirely superseded before it ever took effect is marked 'archived', not 'published'", () => {
    const v1 = { ...newPlanVersion({ version: 1, from: "2026-09-01" }), status: "published" };
    const futureV2 = { ...newPlanVersion({ version: 2, from: "2026-11-01" }), status: "published" }; // scheduled, never started
    const v3draft = newPlanVersion({ version: 3, from: "2026-10-15" }); // supersedes futureV2 before it starts
    const plans = publishPlan([v1, futureV2], v3draft, "Oct 14");
    expect(plans.find((p) => p.version === 2).status).toBe("archived");
    expect(planForDate(plans, "2026-11-15")).toMatchObject({ version: 3 }); // not the dead v2
  });
  it("re-signing mid-day: today's resolved plan never silently rewrites past days", () => {
    const v1 = { ...newPlanVersion({ version: 1, from: "2026-10-01" }), status: "published" };
    const plans = publishPlan([v1], newPlanVersion({ version: 2, from: "2026-10-14" }), "Oct 14");
    expect(planForDate(plans, "2026-10-13")).toMatchObject({ version: 1 });
    expect(planForDate(plans, "2026-10-14")).toMatchObject({ version: 2 });
  });
  it("nextDraftFrom bumps the version only when the current draft is already published", () => {
    const draft = newPlanVersion({ version: 2, from: "2026-10-14" });
    expect(nextDraftFrom(draft, "draft").version).toBe(2); // not published yet - no bump
    expect(nextDraftFrom(draft, "published").version).toBe(3);
  });
});

describe("mealStatus - matches the prototype's status() exactly", () => {
  const meal = newPlanMeal("lunch");
  meal.items = [newPlanItem(foodRefFromRow(chickenRow), 180, "g")];
  const today = "2026-10-14";

  it("skipped mark wins over everything else", () => {
    expect(mealStatus(today, today, meal, [], { lunch: "skipped" })).toBe("skipped");
  });
  it("a full confirm is 'eaten'", () => {
    const entries = [{ source: "confirm", meal: "lunch", planItemId: meal.items[0].id, qty: 180 }];
    expect(mealStatus(today, today, meal, entries, {})).toBe("eaten");
  });
  it("a confirm at less than the prescribed qty is 'partial'", () => {
    const entries = [{ source: "confirm", meal: "lunch", planItemId: meal.items[0].id, qty: 90 }];
    expect(mealStatus(today, today, meal, entries, {})).toBe("partial");
  });
  it("a substitution (no confirm) is 'substituted'", () => {
    const entries = [{ source: "sub", meal: "other", replaces: "lunch" }];
    expect(mealStatus(today, today, meal, entries, {})).toBe("substituted");
  });
  it("no entries, date in the past, is 'open'; in the future, is 'future'", () => {
    expect(mealStatus("2026-10-10", today, meal, [], {})).toBe("open");
    expect(mealStatus("2026-10-20", today, meal, [], {})).toBe("future");
  });
});

describe("unplannedEntries / loggedDayTotals / dayAdherence", () => {
  const plan = newPlanVersion({ from: "2026-10-01" });
  plan.meals = [newPlanMeal("breakfast"), newPlanMeal("lunch")];
  plan.meals[0].items = [newPlanItem(foodRefFromRow(eggRow), 3, "piece")];
  plan.meals[1].items = [newPlanItem(foodRefFromRow(chickenRow), 180, "g")];
  const today = "2026-10-14";

  it("unplannedEntries excludes anything tied to a plan item or a substitution", () => {
    const entries = [
      { planItemId: "pi1", source: "confirm", macros: { kcal: 300, protein: 50, carbs: 0, fat: 10 } },
      { planItemId: null, source: "sub", replaces: "lunch", macros: { kcal: 640, protein: 45, carbs: 70, fat: 18 } },
      { planItemId: null, source: "search", macros: { kcal: 130, protein: 3, carbs: 28, fat: 7 } },
    ];
    expect(unplannedEntries(entries)).toHaveLength(1);
    // loggedDayTotals includes EVERYTHING (confirmed + substituted + unplanned) - rings/totals include extras.
    expect(loggedDayTotals(entries).kcal).toBe(300 + 640 + 130);
  });
  it("adherence counts eaten / all-meals-with-an-outcome, excluding not-logged meals from the denominator", () => {
    const entries = [
      { source: "confirm", meal: "breakfast", planItemId: plan.meals[0].items[0].id, qty: 3 }, // eaten
      // lunch has no entry at all -> 'open', excluded entirely
    ];
    expect(dayAdherence(plan, today, today, entries, {})).toBe(1); // 1 eaten / 1 outcome, lunch excluded
  });
  it("a day with zero logged-outcome meals has no adherence figure (null, not 0%)", () => {
    expect(dayAdherence(plan, today, today, [], {})).toBeNull();
  });
});

describe("mergeLegacyMacroLog - carrying forward the old macros tracker's data", () => {
  it("converts every slot's entries into the flat LogEntry[] shape, snacks -> 'snack'", () => {
    const macroDay = {
      breakfast: [{ id: "m1", foodId: "oats", name: "Oats", amount: 60, serving: "g", kcal: 228, protein: 8, carbs: 40, fats: 4, custom: false, loggedAt: "2026-10-14T07:30:00.000Z" }],
      snacks: [{ id: "m2", name: "Protein bar", amount: 1, serving: "bar", kcal: 200, protein: 20, carbs: 20, fats: 6, custom: true, loggedAt: "2026-10-14T16:00:00.000Z" }],
    };
    const out = mergeLegacyMacroLog(macroDay, "2026-10-14");
    expect(out).toHaveLength(2);
    const [breakfastEntry, snackEntry] = out;
    expect(breakfastEntry.meal).toBe("breakfast");
    expect(breakfastEntry.source).toBe("search"); // custom:false
    expect(breakfastEntry.macros).toEqual({ kcal: 228, protein: 8, carbs: 40, fat: 4 });
    expect(snackEntry.meal).toBe("snack"); // "snacks" slot -> singular "snack" meal key
    expect(snackEntry.source).toBe("quick"); // custom:true
  });
  it("an empty or missing macro day produces no entries", () => {
    expect(mergeLegacyMacroLog(null, "2026-10-14")).toEqual([]);
    expect(mergeLegacyMacroLog({}, "2026-10-14")).toEqual([]);
  });
});

describe("addDaysISO - local-safe date arithmetic", () => {
  it("adds/subtracts days without drifting across a UTC day boundary", () => {
    expect(addDaysISO("2026-10-14", 1)).toBe("2026-10-15");
    expect(addDaysISO("2026-10-14", -1)).toBe("2026-10-13");
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("weeklyProgress - shared by the client and coach Progress tabs", () => {
  const plan = { ...newPlanVersion({ version: 1, from: "2026-10-01", targets: { kcal: 2000, protein: 150, carbs: 200, fat: 60 } }), status: "published" };
  plan.meals = [newPlanMeal("breakfast"), newPlanMeal("lunch")];
  plan.meals[0].items = [newPlanItem(foodRefFromRow(eggRow), 3, "piece")];
  plan.meals[1].items = [newPlanItem(foodRefFromRow(chickenRow), 180, "g")];
  const today = "2026-10-14";

  function entryFor(date, mealKey, item, macros) {
    // qty must meet-or-exceed the plan item's own qty for mealStatus to
    // resolve this as a full "eaten" (not "partial") - see mealStatus().
    return { id: `e-${date}-${mealKey}`, date, meal: mealKey, name: "x", foodId: null, qty: item.qty, unit: item.unit, macros, source: "confirm", time: "12:00", planItemId: item.id, estimate: false, replaces: null, reason: null };
  }

  it("weekDatesEnding returns the 7 days ending on the given date, oldest first", () => {
    expect(weekDatesEnding("2026-10-14")).toEqual(["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]);
  });

  it("averages only over days that were actually logged, and counts adherence across the whole week", () => {
    const logs = {
      "2026-10-13": [entryFor("2026-10-13", "breakfast", plan.meals[0].items[0], { kcal: 1000, protein: 80, carbs: 100, fat: 30 })], // breakfast eaten, lunch not logged
      "2026-10-14": [
        entryFor("2026-10-14", "breakfast", plan.meals[0].items[0], { kcal: 1000, protein: 80, carbs: 100, fat: 30 }),
        entryFor("2026-10-14", "lunch", plan.meals[1].items[0], { kcal: 1000, protein: 80, carbs: 100, fat: 30 }),
      ],
    };
    const marks = {};
    const plans = [plan];
    const result = weeklyProgress(plans, logs, marks, today, today);
    expect(result.loggedCount).toBe(2); // only the 2 days with any entries
    expect(result.avg.kcal).toBe(1500); // (1000 + 2000) / 2
    expect(result.avgTarget.kcal).toBe(2000); // the plan's own target, averaged over the same 2 days
    // breakfast eaten both days (2), lunch eaten only on the 14th (1), lunch "open" on the 13th (1)
    expect(result.counts.eaten).toBe(3);
    expect(result.counts.open).toBeGreaterThanOrEqual(1);
  });

  it("an entirely unlogged week has no average and no adherence figure, not a divide-by-zero NaN", () => {
    const result = weeklyProgress([plan], {}, {}, today, today);
    expect(result.loggedCount).toBe(0);
    expect(result.avg).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(result.adherencePct).toBeNull();
  });
  it("weeklyInsights flags a not-logged week without crashing (no logged days to divide by)", () => {
    const result = weeklyProgress([plan], {}, {}, today, today);
    const insights = weeklyInsights(result);
    expect(insights).toContain("Nothing was logged on 7 of the last 7 days.");
    expect(insights.join(" ")).not.toContain("NaN");
  });
  it("weeklyInsights flags low protein and a repeated substitution when the data shows it", () => {
    const lowProteinEntry = (date, mealKey, item) => ({ id: `lp-${date}-${mealKey}`, date, meal: mealKey, name: "x", foodId: null, qty: item.qty, unit: item.unit, macros: { kcal: 400, protein: 5, carbs: 50, fat: 10 }, source: "confirm", time: "12:00", planItemId: item.id, estimate: false, replaces: null, reason: null });
    const subEntry = (date) => ({ id: `sub-${date}`, date, meal: "lunch", name: "Burrito bowl", foodId: null, qty: 1, unit: "bowl", macros: { kcal: 600, protein: 40, carbs: 70, fat: 18 }, source: "sub", time: "13:00", planItemId: null, estimate: false, replaces: "lunch", reason: "Eating out" });
    const logs = {};
    weekDatesEnding(today).forEach((d) => { logs[d] = [lowProteinEntry(d, "breakfast", plan.meals[0].items[0])]; });
    logs["2026-10-12"] = [...logs["2026-10-12"], subEntry("2026-10-12")];
    logs["2026-10-13"] = [...logs["2026-10-13"], subEntry("2026-10-13")];
    const result = weeklyProgress([plan], logs, {}, today, today);
    const insights = weeklyInsights(result);
    expect(insights.some((i) => i.startsWith("Protein has been below target"))).toBe(true);
    expect(insights).toContain("Lunch was substituted 2 times this period.");
  });
});

describe("recentAlertSignals - coach alerts, generalized to every client (not just a plan)", () => {
  const plan = { ...newPlanVersion({ version: 1, from: "2026-08-01", targets: { kcal: 2000, protein: 150, carbs: 200, fat: 60 } }), status: "published" };
  plan.meals = [newPlanMeal("breakfast")];
  plan.meals[0].items = [newPlanItem(foodRefFromRow(eggRow), 3, "piece")];
  const today = "2026-10-14";
  const eaten = (date) => ({ id: `e-${date}`, date, meal: "breakfast", name: "x", foodId: null, qty: 3, unit: "piece", macros: { kcal: 500, protein: 40, carbs: 5, fat: 30 }, source: "confirm", time: "08:00", planItemId: plan.meals[0].items[0].id, estimate: false, replaces: null, reason: null });

  it("a client with no plan uses the longer (7-day) no-log threshold", () => {
    expect(recentAlertSignals([], {}, {}, today).noLogThreshold).toBe(7);
  });
  it("a client with an active plan uses the shorter (2-day) no-log threshold", () => {
    expect(recentAlertSignals([plan], {}, {}, today).noLogThreshold).toBe(2);
  });
  it("counts the no-log streak backwards from yesterday regardless of whether a plan exists", () => {
    const logs = { "2026-10-11": [eaten("2026-10-11")] }; // logged 3 days ago; 10-12 and 10-13 empty
    expect(recentAlertSignals([], logs, {}, today).noLogDays).toBe(2);
  });
  it("flags low adherence from the last 3 complete days only (not the full week)", () => {
    const logs = {};
    ["2026-10-11", "2026-10-12", "2026-10-13"].forEach((d) => { logs[d] = []; }); // open every day -> no outcome -> no adherence score at all
    const result = recentAlertSignals([plan], logs, {}, today);
    expect(result.avgAdherence).toBeNull();
    expect(result.lowAdherence).toBe(false);
  });
  it("flags heavy extras on days unplanned entries exceed 15% of that day's target", () => {
    const heavyExtra = (date) => ({ id: `x-${date}`, date, meal: "other", name: "Latte", foodId: null, qty: 1, unit: "drink", macros: { kcal: 350, protein: 2, carbs: 40, fat: 15 }, source: "search", time: "10:00", planItemId: null, estimate: false, replaces: null, reason: null });
    const logs = {};
    ["2026-10-11", "2026-10-12", "2026-10-13"].forEach((d) => { logs[d] = [heavyExtra(d)]; }); // 350/2000 = 17.5%
    expect(recentAlertSignals([plan], logs, {}, today).heavyExtrasDays).toBe(3);
  });
});

describe("newLogEntry validation", () => {
  it("rejects an invalid source", () => {
    expect(() => newLogEntry({ date: "2026-10-14", meal: "lunch", name: "x", macros: {}, source: "bogus", time: "" })).toThrow();
  });
});

describe("suggestSavedMealsFromHistory", () => {
  const quick = (date, name, meal = "snack") => ({
    id: `${date}-${name}`, date, meal, name, foodId: null, qty: 1, unit: "serving",
    macros: { kcal: 380, protein: 32, carbs: 14, fat: 16 }, source: "quick", time: "16:00",
    planItemId: null, estimate: false, replaces: null, reason: null,
  });
  const searched = (date, name) => ({ ...quick(date, name), source: "search" });

  it("a client's own logged history never gets touched - this is a pure read", () => {
    const logs = { "2026-10-10": [quick("2026-10-10", "Post-workout shake")] };
    const before = JSON.stringify(logs);
    suggestSavedMealsFromHistory(logs);
    expect(JSON.stringify(logs)).toBe(before);
  });

  it("surfaces a quick-add name that recurs on 2+ distinct dates", () => {
    const logs = {
      "2026-10-10": [quick("2026-10-10", "Post-workout shake")],
      "2026-10-12": [quick("2026-10-12", "Post-workout shake")],
      "2026-10-14": [quick("2026-10-14", "Post-workout shake")],
    };
    const [sugg] = suggestSavedMealsFromHistory(logs);
    expect(sugg.name).toBe("Post-workout shake");
    expect(sugg.occurrences).toBe(3);
    expect(sugg.macros.kcal).toBe(380);
  });

  it("does not surface a name logged only once", () => {
    const logs = { "2026-10-10": [quick("2026-10-10", "One-off snack")] };
    expect(suggestSavedMealsFromHistory(logs)).toEqual([]);
  });

  it("ignores search/confirm/sub entries - only a client's own typed quick-adds count", () => {
    const logs = {
      "2026-10-10": [searched("2026-10-10", "Chicken and rice")],
      "2026-10-12": [searched("2026-10-12", "Chicken and rice")],
    };
    expect(suggestSavedMealsFromHistory(logs)).toEqual([]);
  });

  it("excludes a name already saved as a real meal", () => {
    const logs = {
      "2026-10-10": [quick("2026-10-10", "Post-workout shake")],
      "2026-10-12": [quick("2026-10-12", "Post-workout shake")],
    };
    expect(suggestSavedMealsFromHistory(logs, ["Post-workout Shake"])).toEqual([]);
  });

  it("ranks by frequency, then recency, and respects the limit", () => {
    const logs = {};
    ["2026-10-01", "2026-10-02"].forEach((d) => { logs[d] = [quick(d, "B")]; });
    ["2026-10-01", "2026-10-03", "2026-10-05"].forEach((d) => { logs[d] = [...(logs[d] || []), quick(d, "A")]; });
    const names = suggestSavedMealsFromHistory(logs, [], { limit: 1 }).map((s) => s.name);
    expect(names).toEqual(["A"]); // A occurs 3x vs B's 2x
  });
});
