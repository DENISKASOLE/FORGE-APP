import { describe, it, expect } from "vitest";
import {
  itemMacros, mealTotals, dayTotals, targetStatus, itemScore, dayAdherence,
  suggestSwapAmount, buildGroceryList, macroSanityCheck,
  entryFromEatenItem, entryFromSwap, skippedEntry, loggedDayTotals,
  nutritionAlertSignals,
} from "./planMath.js";
import { isoDate } from "../../lib/dateUtils.js";

// Appendix A seed foods (per 100g/ml unless noted), exactly as given in
// NUTRITION_SPEC.md.
const F = {
  greekYogurt: { foodId: "greekYogurt", name: "Greek yogurt 0%", category: "dairy", unit: "g", per100: { kcal: 54, protein: 10.4, carbs: 3.6, fat: 0 } },
  oats: { foodId: "oats", name: "Rolled oats", category: "carb", unit: "g", per100: { kcal: 380, protein: 13, carbs: 66, fat: 6.5 } },
  blueberries: { foodId: "blueberries", name: "Blueberries", category: "fruit", unit: "g", per100: { kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3 } },
  honey: { foodId: "honey", name: "Honey", category: "other", unit: "g", per100: { kcal: 304, protein: 0.3, carbs: 82, fat: 0 } },
  chicken: { foodId: "chicken", name: "Chicken breast", category: "protein", unit: "g", per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }, groceryName: "Chicken breast, raw", groceryFactor: 1.35 },
  leanBeef: { foodId: "leanBeef", name: "Lean beef mince 5%", category: "protein", unit: "g", per100: { kcal: 180, protein: 28, carbs: 0, fat: 7.5 } },
  whiteFish: { foodId: "whiteFish", name: "White fish (cod)", category: "protein", unit: "g", per100: { kcal: 105, protein: 23, carbs: 0, fat: 0.9 } },
  tofu: { foodId: "tofu", name: "Firm tofu", category: "protein", unit: "g", per100: { kcal: 144, protein: 17, carbs: 3, fat: 9 } },
  rice: { foodId: "rice", name: "Basmati rice", category: "carb", unit: "g", per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, groceryName: "Basmati rice, dry", groceryFactor: 0.35 },
  potatoes: { foodId: "potatoes", name: "Potatoes, boiled", category: "carb", unit: "g", per100: { kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 } },
  pasta: { foodId: "pasta", name: "Wholewheat pasta", category: "carb", unit: "g", per100: { kcal: 124, protein: 5.3, carbs: 26.5, fat: 0.5 } },
  sourdough: { foodId: "sourdough", name: "Sourdough", category: "carb", unit: "g", per100: { kcal: 289, protein: 11.8, carbs: 56, fat: 1.8 } },
  salad: { foodId: "salad", name: "Mixed salad", category: "veg", unit: "g", per100: { kcal: 20, protein: 1.2, carbs: 3.5, fat: 0.2 } },
  oliveOil: { foodId: "oliveOil", name: "Olive oil", category: "fat", unit: "ml", per100: { kcal: 884, protein: 0, carbs: 0, fat: 100 } },
  avocado: { foodId: "avocado", name: "Avocado", category: "fat", unit: "g", per100: { kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 } },
  almonds: { foodId: "almonds", name: "Almonds", category: "fat", unit: "g", per100: { kcal: 579, protein: 21, carbs: 22, fat: 50 } },
  whey: { foodId: "whey", name: "Whey protein", category: "protein", unit: "g", per100: { kcal: 400, protein: 80, carbs: 10, fat: 6.7 } },
  banana: { foodId: "banana", name: "Banana", category: "fruit", unit: "piece", pieceGrams: 120, per100: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 } },
  salmon: { foodId: "salmon", name: "Salmon fillet, raw", category: "protein", unit: "g", per100: { kcal: 208, protein: 20, carbs: 0, fat: 13.4 } },
  sweetPotato: { foodId: "sweetPotato", name: "Sweet potato", category: "carb", unit: "g", per100: { kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 } },
  broccoli: { foodId: "broccoli", name: "Broccoli", category: "veg", unit: "g", per100: { kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4 } },
};
function item(food, amount) { return { id: `${food.foodId}-item`, food, amount, swaps: [] }; }

describe("itemMacros / piece conversion", () => {
  it("scales a gram food by amount/100", () => {
    // toBeCloseTo, not toEqual: 31 * 1.8 is 55.800000000000004 in IEEE754,
    // which is correct floating-point behaviour, not a bug - values are
    // rounded only at display time (see roundMacros/fmtKcal), never here.
    const m = itemMacros(item(F.chicken, 180));
    expect(m.kcal).toBeCloseTo(297, 5);
    expect(m.protein).toBeCloseTo(55.8, 5);
    expect(m.carbs).toBeCloseTo(0, 5);
    expect(m.fat).toBeCloseTo(6.48, 5);
  });
  it("converts a piece food via pieceGrams before scaling", () => {
    // 1 banana = 120g, so this should equal the 120g-scaled per100 rate.
    const m = itemMacros(item(F.banana, 1));
    expect(m.kcal).toBeCloseTo(89 * 1.2, 5);
    expect(m.carbs).toBeCloseTo(22.8 * 1.2, 5);
  });
});

describe("Day 1 seed template totals (Appendix A example)", () => {
  // Cross-checked by hand against individual line items shown in the
  // mockups themselves (not just the spec's prose): FuelToday.dc.html
  // shows Breakfast = 412 KCAL and the pre-session snack = 227 KCAL;
  // FuelMeal.dc.html shows Salmon 150g = 312 kcal, Sweet potato 200g =
  // 172 kcal, Broccoli 150g = 51 kcal. All four match this function
  // exactly, which is strong evidence the math itself is right.
  //
  // The day TOTAL this produces (kcal 1839.6, fat 44.1) is ~1kcal / ~1g
  // off the spec's quoted "1,839 kcal · 158 P · 204 C · 43 F" once
  // rounded - that's accumulated rounding noise already baked into the
  // Appendix A table's own per-100g figures (a documented source, not a
  // computed one), not a bug here. Asserted against the actual computed
  // value rather than fudged to match the spec's rounder headline number.
  const breakfast = { type: "meal", items: [item(F.greekYogurt, 250), item(F.oats, 50), item(F.blueberries, 100), item(F.honey, 10)] };
  const lunch = { type: "meal", items: [item(F.chicken, 180), item(F.rice, 200), item(F.salad, 100), item(F.oliveOil, 10)] };
  const snack = { type: "meal", items: [item(F.whey, 30), item(F.banana, 1)] };
  const dinner = { type: "meal", items: [item(F.salmon, 150), item(F.sweetPotato, 200), item(F.broccoli, 150)] };
  const day1 = { id: "day1", blocks: [breakfast, lunch, snack, dinner] };

  it("matches individual mockup line items", () => {
    expect(Math.round(mealTotals(breakfast).kcal)).toBe(412);
    expect(Math.round(mealTotals(snack).kcal)).toBe(227);
    expect(itemMacros(item(F.salmon, 150)).kcal).toBe(312);
    expect(itemMacros(item(F.sweetPotato, 200)).kcal).toBe(172);
    expect(itemMacros(item(F.broccoli, 150)).kcal).toBe(51);
  });
  it("day total is within known appendix rounding noise of 1,839/158/204/43", () => {
    // Explicit +/-2 tolerance rather than toBeCloseTo's numDigits rounding
    // rule (which doesn't map cleanly onto "off by about one unit") - the
    // noise here is real and documented above, not a bug to hide.
    const t = dayTotals(day1);
    expect(Math.abs(t.kcal - 1839)).toBeLessThan(2);
    expect(Math.abs(t.protein - 158)).toBeLessThan(2);
    expect(Math.abs(t.carbs - 204)).toBeLessThan(2);
    expect(Math.abs(t.fat - 44)).toBeLessThan(2); // spec says 43; see note above
  });
});

describe("targetStatus chip thresholds (§4.2)", () => {
  const targets = { kcal: 1850, protein: 160, carbs: 200, fat: 45 };
  it("within 5% -> good, labeled with the worst deviation", () => {
    expect(targetStatus({ kcal: 1839, protein: 158, carbs: 204, fat: 43 }, targets)).toEqual({ level: "good", label: "WITHIN 4%" });
  });
  it("6-10% off -> warn", () => {
    expect(targetStatus({ kcal: 1850, protein: 145, carbs: 200, fat: 45 }, targets).level).toBe("warn"); // protein 9.4% low
  });
  it("over 10% off -> bad", () => {
    expect(targetStatus({ kcal: 2200, protein: 160, carbs: 200, fat: 45 }, targets).level).toBe("bad"); // kcal ~19% over
  });
  it("minimum reported deviation is 1%, never 0", () => {
    expect(targetStatus({ kcal: 1850, protein: 160, carbs: 200, fat: 45 }, targets).label).toBe("WITHIN 1%");
  });
});

describe("adherence (§4.3)", () => {
  it("skipped scores 0", () => { expect(itemScore({ status: "skipped" })).toBe(0); });
  it("eaten at full portion scores 1", () => { expect(itemScore({ status: "eaten", portion: 1 })).toBe(1); });
  it("eaten within 0.75-1.25 still scores 1", () => { expect(itemScore({ status: "eaten", portion: 1.25 })).toBe(1); });
  it("eaten outside that band scores 0.5", () => { expect(itemScore({ status: "eaten", portion: 0.5 })).toBe(0.5); });
  it("swapped counts the same as eaten", () => { expect(itemScore({ status: "swapped", portion: 1 })).toBe(1); });
  it("no entry scores 0", () => { expect(itemScore(undefined)).toBe(0); });
  it("day adherence = sum(itemScore) / planned_items", () => {
    const entries = { a: { status: "eaten", portion: 1 }, b: { status: "eaten", portion: 0.5 }, c: { status: "skipped" } };
    expect(dayAdherence(entries, 4)).toBe((1 + 0.5 + 0) / 4); // 4th item has no entry at all
  });
  it("null when nothing was planned that day", () => { expect(dayAdherence({}, 0)).toBeNull(); });
});

describe("swap amount suggestion (§4.4)", () => {
  it("matches a protein item on protein, rounds to nearest 5g", () => {
    // 180g chicken = 55.8g protein. Lean beef 5% is 28g protein/100g.
    // raw = 55.8 / 0.28 = 199.28g -> nearest 5g = 200g.
    const r = suggestSwapAmount(item(F.chicken, 180), F.leanBeef);
    expect(r.match).toBe("protein");
    expect(r.amount).toBe(200);
  });
  it("rounds a piece-unit swap to the nearest half piece", () => {
    const r = suggestSwapAmount(item(F.whey, 30), F.banana, "kcal"); // 30g whey = 120kcal
    expect(r.amount % 0.5).toBe(0);
  });
});

describe("grocery list (§4.5)", () => {
  const day = {
    id: "day1",
    blocks: [
      { type: "meal", items: [item(F.chicken, 180), item(F.rice, 200)] },
      { type: "meal", items: [item(F.rice, 145) /* dinner swap-sized portion, same food */] },
    ],
  };
  const list = buildGroceryList([day], { mon: "day1" });
  it("groups protein and carbs into the right columns", () => {
    expect(list.PROTEIN.some((r) => r.label === "Chicken breast, raw")).toBe(true);
    expect(list.CARBS.some((r) => r.label === "Basmati rice, dry")).toBe(true);
  });
  it("applies the grocery factor and combines repeated uses of the same food across the week", () => {
    // (200 + 145)g cooked rice * 0.35 dry factor = 120.75g -> ceil to nearest 10 = 130g
    const rice = list.CARBS.find((r) => r.label === "Basmati rice, dry");
    expect(rice.display).toBe("130 g");
  });
});

describe("macroSanityCheck (§5.4 food form warning)", () => {
  it("chicken breast (165 kcal, 31P, 0C, 3.6F) is sane", () => {
    // expected = 4*31 + 4*0 + 9*3.6 = 156.4, actual 165 -> 5.5% off
    expect(macroSanityCheck({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }).ok).toBe(true);
  });
  it("flags a plausible data-entry error", () => {
    // protein/fat swapped: expected = 4*3.6 + 0 + 9*31 = 293.4 vs stated 165
    expect(macroSanityCheck({ kcal: 165, protein: 3.6, carbs: 0, fat: 31 }).ok).toBe(false);
  });
  it("never blocks - always returns ok, just flags", () => {
    expect(macroSanityCheck({ kcal: 9999, protein: 0, carbs: 0, fat: 0 })).toEqual({ ok: true, expectedKcal: 0, pct: 0 });
  });
});

describe("localDateKey (via the app's existing isoDate helper, not a new one)", () => {
  // NUTRITION_SPEC.md §0.5 warns against `new Date().toISOString().slice(0,10)`
  // (gives the UTC date). Confirmed in recon that isoDate() already builds
  // from local getFullYear/getMonth/getDate, so it's reused as-is rather
  // than adding a duplicate helper - see docs/nutrition-recon.md.
  it("23:30 and 00:30 local both resolve to their own local calendar day, not UTC's", () => {
    const late = new Date(2026, 8, 24, 23, 30); // Sep 24, 23:30 local
    const early = new Date(2026, 8, 25, 0, 30); // Sep 25, 00:30 local
    expect(isoDate(late)).toBe("2026-09-24");
    expect(isoDate(early)).toBe("2026-09-25");
  });
});

describe("Fuel log entries (§6) - eaten/swapped/skipped all produce the same LogEntry shape", () => {
  const salmonItem = item(F.salmon, 150); // 208kcal/100g * 1.5 = 312 kcal
  const sweetPotatoItem = item(F.sweetPotato, 200); // 86*2 = 172 kcal
  const broccoliItem = item(F.broccoli, 150); // 34*1.5 = 51 kcal
  const dinner = { id: "dinner", type: "meal", name: "DINNER", time: "20:00", items: [salmonItem, sweetPotatoItem, broccoliItem], showTotals: true, allowSwaps: true };
  const day = { id: "d1", name: "DAY 1", type: "training", targets: { kcal: 1850, protein: 160, carbs: 200, fat: 45 }, blocks: [dinner] };

  it("entryFromEatenItem at full portion matches the item's own macros", () => {
    const e = entryFromEatenItem(salmonItem);
    expect(e.status).toBe("eaten");
    expect(e.kcal).toBeCloseTo(312, 0);
  });
  it("entryFromEatenItem at a partial portion scales linearly", () => {
    const e = entryFromEatenItem(salmonItem, 0.5);
    expect(e.kcal).toBeCloseTo(156, 0);
    expect(e.portion).toBe(0.5);
  });
  it("entryFromSwap uses the swap food's own macros, not the original item's", () => {
    const potatoesSwap = newSwapOptionLike(F.potatoes, 235);
    const e = entryFromSwap(potatoesSwap);
    expect(e.status).toBe("swapped");
    // 87 kcal/100g * 2.35 ~= 204
    expect(e.kcal).toBeCloseTo(87 * 2.35, 0);
  });
  it("skippedEntry contributes zero macros", () => {
    expect(skippedEntry()).toMatchObject({ status: "skipped", kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
  it("loggedDayTotals sums only non-skipped entries plus extras, ignoring un-entered items", () => {
    const dayLog = {
      entries: {
        [salmonItem.id]: entryFromEatenItem(salmonItem),
        [sweetPotatoItem.id]: skippedEntry(),
        // broccoli has no entry at all yet
      },
      extras: [{ estimate: { items: [{ kcal: 130, protein: 4, carbs: 12, fat: 6 }] } }],
    };
    const totals = loggedDayTotals(day, dayLog);
    // salmon 312 + extra 130 = 442; sweet potato skipped, broccoli not logged
    expect(totals.kcal).toBeCloseTo(442, 0);
  });
});

function newSwapOptionLike(food, amount) { return { id: "swap-1", food, amount }; }

describe("nutritionAlertSignals (§5.7 coach alerts)", () => {
  const today = "2026-09-25"; // Fri - matches "yesterday" = 09-24, back to 09-18
  const plan = { active: { startDate: "2026-08-01", doc: { days: [{ id: "d1", targets: { kcal: 2000, protein: 150, carbs: 200, fat: 60 } }] } } };

  it("no active plan -> all-clear, no false alerts", () => {
    expect(nutritionAlertSignals(null, {}, today)).toEqual({ lowAdherence: false, avgAdherence: null, noLogDays: 0, heavyExtrasDays: 0 });
  });

  it("flags low adherence when the last 3 complete days average under the threshold", () => {
    const lowDay = { dayId: "d1", plannedItemCount: 4, entries: { i1: { status: "skipped" }, i2: { status: "skipped" }, i3: { status: "eaten", portion: 1 } }, extras: [] };
    const logs = { "2026-09-24": lowDay, "2026-09-23": lowDay, "2026-09-22": lowDay };
    const signals = nutritionAlertSignals(plan, logs, today);
    expect(signals.avgAdherence).toBeCloseTo(0.25, 2); // 1 of 4 items scored, rest 0
    expect(signals.lowAdherence).toBe(true);
  });

  it("does not flag low adherence with no logged days in the window (that's NO_LOG's job, not this one)", () => {
    expect(nutritionAlertSignals(plan, {}, today).lowAdherence).toBe(false);
  });

  it("counts a consecutive no-log streak backwards from yesterday, stopping at the first logged day", () => {
    const logged = { dayId: "d1", plannedItemCount: 2, entries: { i1: { status: "eaten", portion: 1 } }, extras: [] };
    // yesterday and the day before are empty; 3 days ago has a log - streak should stop there, at 2.
    const logs = { "2026-09-22": logged };
    expect(nutritionAlertSignals(plan, logs, today).noLogDays).toBe(2);
  });

  it("flags heavy extras on the days extras exceed 15% of that day's target kcal", () => {
    const heavy = { dayId: "d1", plannedItemCount: 1, entries: {}, extras: [{ estimate: { items: [{ kcal: 350, protein: 0, carbs: 0, fat: 0 }] } }] }; // 350/2000 = 17.5%
    const light = { dayId: "d1", plannedItemCount: 1, entries: {}, extras: [{ estimate: { items: [{ kcal: 100, protein: 0, carbs: 0, fat: 0 }] } }] }; // 5%
    const logs = { "2026-09-24": heavy, "2026-09-23": heavy, "2026-09-22": heavy, "2026-09-21": light, "2026-09-20": light };
    expect(nutritionAlertSignals(plan, logs, today).heavyExtrasDays).toBe(3);
  });
});
