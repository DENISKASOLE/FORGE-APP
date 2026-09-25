# FORGE — Nutrition Plans & Tick-Logging
## Build spec for Claude Code

> **Read this whole file before writing any code.** Then do Phase 0 and stop.
> The folder `mockups/` next to this file holds the approved screen designs (`.dc.html`).
> They are the visual source of truth. Open them as HTML and match layout, spacing, colours
> and copy. Ignore the `<script src="./support.js">`, `<x-dc>` and `<script type="text/x-dc">`
> wrappers — they belong to the design tool. The markup inside is plain HTML with inline styles.

---

## 0. Context and ground rules

**Owner:** Denis — solo coach, brand "The Forge Method", logo "FORGE PERFORMANCE". Dubai (Asia/Dubai, UTC+4).

**Target app:** Forge — a single codebase (`forge-app`; the earlier rebuild and the old live app have been
merged into one clean app), React + Vite + Supabase. Supabase client in `src/lib/supabase.js`, keys in
`.env.local`. There is only one app now — no separate "v2" to target and no old app to migrate away from.
Phase 0's recon establishes the current real conventions (see the note at the end of Appendix A).

**What we're building (one line):** the coach designs and signs a nutrition plan; the client logs it every day
by ticking prescribed meals/foods (like the exercise log, no food search), plus types anything off-plan
into an "Extras" section, which Claude estimates.

**Rules you must follow:**
1. **Picture before code.** The mockups are approved. Don't invent new UI. If something isn't in the mockups
   and isn't described here, ask Denis before building it.
2. **Design tokens (do not change):**
   | token | value | use |
   |---|---|---|
   | bg | `#000000` | page |
   | panel | `#070707` | sidebars, nav bars |
   | card | `#0d0d0d` | cards |
   | card2 | `#171717` | inset rows, chips, empty ring track |
   | line | `#262626` | borders, dividers |
   | line-dashed | `#333333` | dashed "add" boxes, placeholders |
   | text | `#EDEDED` | primary text AND the accent (white accent on true black) |
   | muted | `#a1a1a1` | secondary text |
   | dim | `#6e6e6e` | labels, tertiary |
   | brand red | `#ED000A` | logo "F" and "PERFORMANCE" only (and critical alerts) |
   | kcal | `#22D3EE` | calories |
   | protein | `#3DD68C` | protein, "done/on plan" green |
   | carbs | `#FFA94D` | carbs |
   | fat | `#A78BFA` | fat |
   | water | `#38BDF8` | hydration |
   If the app already has a tokens file/theme, add the missing ones there. Never hardcode a colour twice.
3. **Typography is locked:** system sans-serif stack
   (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`), **font-weight 700 on everything**,
   labels UPPERCASE with letter-spacing ~0.1–0.16em. Food names in lists are sentence case (see mockups).
   Don't add any new font to the app without Denis approving it.
4. **Mobile-first PWA.** Clients use phones only. The coach uses phone AND desktop — the plan builder must
   work on both (see §5.2 responsive rules). Touch targets ≥ 44px.
5. **Dates:** always the client's **local date** as a `YYYY-MM-DD` string built from local year/month/day.
   **Never** `new Date().toISOString().slice(0,10)` — that gives the UTC date and was the cause of past
   timezone bugs. Put one helper `localDateKey(date = new Date())` in `src/lib/dates` and use it everywhere.
6. **Secrets:** the Anthropic API key lives only in Supabase Edge Function secrets. Never in the frontend.
7. **Work in phases (§11).** After each phase: run the app, check the phase's acceptance list, commit,
   and **stop** with a short summary + what Denis should look at. Don't start the next phase until he says go.
8. Before Phase 1, **inspect the repo** (Phase 0) and adapt table/column names in this spec to what already
   exists (auth, `clients` table, messages, check-ins, program calendar). Where this spec says
   `clients(id, user_id, trainer_id)`, map it to the real thing.

---

## 1. Feature overview

### Coach
- **Food library** (Tools → Foods): the coach's own foods with macros per 100 g/ml.
- **Plan builder** (Tools → Nutrition Plans): templates made of **days** (e.g. Training / Rest), each day made
  of **blocks**: Meal, Swaps, Coach note, Education, Supplement, Hydration, Photo, Divider.
  Live day totals vs targets.
- **Studio guidelines** (Settings → Nutrition): house rules, auto-added to every plan.
- **Saved meals** (meal presets) to drop into any plan.
- **AI refine**: ask Claude to change a block; it *proposes*, coach Accepts or Rejects.
- **Assign & sign**: pick client, start date, weekly schedule → locked snapshot sent to client + message.
- **Client → Nutrition** view: current plan, adherence, day-by-day logs incl. swaps, skips and extras.
- **Alerts** for low adherence / heavy extras.
- **PDF** export of the plan (2+ A4 pages, branded).

### Client (Fuel tab)
- **Today**: rings (kcal/P/C/F), today's meals from the signed plan, one-tap **"Ate as planned"**.
- **Meal detail**: tick individual foods, swap a food from the coach's options, ate less/more, skipped meal.
- **Extras**: type anything off-plan ("2 dates and a handful of almonds") → Claude estimates → confirm → added.
- **My plan**: read the full plan in-app + download PDF.
- Logs every day. Works offline (queued), except the AI estimate.

---

## 2. Data model (Supabase)

Design decision: the plan itself is stored as **one JSON document** (`PlanDoc`, §3). Templates hold an editable
`PlanDoc`; signing copies it into `client_plans.doc` as a **frozen snapshot**. Logs are relational rows.
Food macros are **denormalised into the doc** so later food-library edits never change a signed plan or old logs.

Create one migration `supabase/migrations/<timestamp>_nutrition_plans.sql`. Adapt `clients` / auth references to
the real schema found in Phase 0.

```sql
-- ============ helpers ============
create extension if not exists pgcrypto;

-- Is the given client one of the calling coach's clients?
create or replace function public.is_my_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients c where c.id = cid and c.trainer_id = auth.uid());
$$;

-- The client row id of the calling user (null if caller is not a client)
create or replace function public.my_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select c.id from clients c where c.user_id = auth.uid() limit 1;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ food library ============
create table public.foods (
  id              uuid primary key default gen_random_uuid(),
  trainer_id      uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  brand           text,
  category        text not null check (category in
                    ('protein','carb','fat','veg','fruit','dairy','drink','snack','other')),
  unit            text not null default 'g' check (unit in ('g','ml','piece')),
  piece_grams     numeric check (piece_grams > 0),        -- required when unit = 'piece'
  kcal            numeric not null check (kcal >= 0),     -- all macros per 100 g / 100 ml
  protein         numeric not null check (protein >= 0),
  carbs           numeric not null check (carbs >= 0),
  fat             numeric not null check (fat >= 0),
  fibre           numeric check (fibre >= 0),
  state           text check (state in ('raw','cooked','dry')), -- shown in names: "Salmon fillet, raw"
  grocery_name    text,                                   -- e.g. "Basmati rice, dry"
  grocery_factor  numeric not null default 1 check (grocery_factor > 0), -- cooked rice → dry ≈ 0.35
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint piece_needs_grams check (unit <> 'piece' or piece_grams is not null)
);
create index foods_trainer_name_idx on public.foods (trainer_id, lower(name));
create trigger foods_touch before update on public.foods for each row execute function touch_updated_at();

-- ============ saved meals (presets) ============
create table public.meal_presets (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  items       jsonb not null default '[]',   -- MealItem[] (see PlanDoc)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger meal_presets_touch before update on public.meal_presets for each row execute function touch_updated_at();

-- ============ studio settings ============
create table public.studio_settings (
  trainer_id  uuid primary key references auth.users(id) on delete cascade,
  guidelines  jsonb not null default '[]',   -- string[]
  updated_at  timestamptz not null default now()
);
create trigger studio_settings_touch before update on public.studio_settings for each row execute function touch_updated_at();

-- ============ plan templates ============
create table public.plan_templates (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  doc         jsonb not null,                -- PlanDoc
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger plan_templates_touch before update on public.plan_templates for each row execute function touch_updated_at();

-- ============ signed client plans ============
create table public.client_plans (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  trainer_id   uuid not null references auth.users(id) on delete cascade,
  template_id  uuid references public.plan_templates(id) on delete set null,
  version      int  not null,                 -- 1,2,3… per client
  doc          jsonb not null,                -- frozen PlanDoc snapshot (incl. guidelines)
  schedule     jsonb not null,                -- { "mon": "<dayId>", …, "sun": "<dayId>" }
  start_date   date not null,
  status       text not null default 'active' check (status in ('active','archived')),
  coach_note   text,
  signed_at    timestamptz not null default now(),
  unique (client_id, version)
);
create unique index client_plans_one_active on public.client_plans (client_id) where status = 'active';

-- ============ daily logs ============
create table public.nutrition_logs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  client_plan_id  uuid references public.client_plans(id) on delete set null,
  plan_version    int,
  log_date        date not null,              -- client's LOCAL date
  day_id          text,                       -- PlanDay.id used that day
  day_switched    boolean not null default false, -- client switched training/rest manually
  planned_items   int not null default 0,     -- total planned items that day
  target_kcal numeric, target_protein numeric, target_carbs numeric, target_fat numeric,
  -- running totals, recomputed on every change (planned + extras)
  kcal numeric not null default 0, protein numeric not null default 0,
  carbs numeric not null default 0, fat numeric not null default 0,
  extras_kcal numeric not null default 0,
  adherence       numeric,                    -- 0..1, see §4.3
  updated_at      timestamptz not null default now(),
  unique (client_id, log_date)
);
create trigger nutrition_logs_touch before update on public.nutrition_logs for each row execute function touch_updated_at();

create table public.nutrition_log_entries (
  id             uuid primary key default gen_random_uuid(),
  log_id         uuid not null references public.nutrition_logs(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  kind           text not null check (kind in ('planned','extra')),
  -- planned
  meal_id        text,                        -- MealBlock.id
  item_id        text,                        -- MealItem.id
  status         text check (status in ('eaten','swapped','skipped')),
  portion        numeric not null default 1 check (portion >= 0 and portion <= 3),
  swap_option_id text,                        -- SwapOption.id when status = 'swapped'
  -- what was actually eaten (always filled, so history never needs the plan)
  name           text not null,
  amount         numeric,
  unit           text,
  kcal numeric not null default 0, protein numeric not null default 0,
  carbs numeric not null default 0, fat numeric not null default 0,
  -- extras
  raw_text       text,                        -- what the client typed
  estimate       jsonb,                       -- AI line items, see §8.1
  is_estimate    boolean not null default false,
  pending_estimate boolean not null default false, -- typed offline, not estimated yet
  client_ref     text,                        -- idempotency key from the offline queue
  logged_at      timestamptz not null default now(),
  constraint planned_fields check (kind <> 'planned' or (meal_id is not null and item_id is not null and status is not null))
);
create unique index nle_one_per_item on public.nutrition_log_entries (log_id, meal_id, item_id) where kind = 'planned';
create unique index nle_client_ref on public.nutrition_log_entries (client_id, client_ref) where client_ref is not null;
create index nle_log_idx on public.nutrition_log_entries (log_id);

-- ============ AI usage (rate limiting) ============
create table public.ai_usage (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  fn         text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_fn_time on public.ai_usage (user_id, fn, created_at desc);

-- ============ RLS ============
alter table public.foods                 enable row level security;
alter table public.meal_presets          enable row level security;
alter table public.studio_settings       enable row level security;
alter table public.plan_templates        enable row level security;
alter table public.client_plans          enable row level security;
alter table public.nutrition_logs        enable row level security;
alter table public.nutrition_log_entries enable row level security;
alter table public.ai_usage              enable row level security;   -- no policies: service role only

-- coach-owned tables
create policy foods_coach          on public.foods           for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy presets_coach        on public.meal_presets    for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy studio_coach         on public.studio_settings for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy templates_coach      on public.plan_templates  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- client plans: coach full, client read own
create policy cp_coach  on public.client_plans for all
  using (trainer_id = auth.uid() and is_my_client(client_id))
  with check (trainer_id = auth.uid() and is_my_client(client_id));
create policy cp_client_read on public.client_plans for select using (client_id = my_client_id());

-- logs: client full on own; coach read (+ update for corrections) on their clients
create policy nl_client on public.nutrition_logs for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create policy nl_coach_read on public.nutrition_logs for select using (is_my_client(client_id));
create policy nl_coach_upd  on public.nutrition_logs for update using (is_my_client(client_id));

create policy nle_client on public.nutrition_log_entries for all
  using (client_id = my_client_id()) with check (client_id = my_client_id());
create policy nle_coach_read on public.nutrition_log_entries for select using (is_my_client(client_id));
```

**Signing must be atomic** (archive old + insert new). Do it in a Postgres function called via RPC:

```sql
create or replace function public.sign_client_plan(
  p_client_id uuid, p_template_id uuid, p_doc jsonb, p_schedule jsonb,
  p_start_date date, p_coach_note text
) returns public.client_plans
language plpgsql security invoker set search_path = public as $$
declare v_version int; v_row public.client_plans;
begin
  if not is_my_client(p_client_id) then raise exception 'not your client'; end if;
  select coalesce(max(version),0)+1 into v_version from client_plans where client_id = p_client_id;
  update client_plans set status = 'archived' where client_id = p_client_id and status = 'active';
  insert into client_plans (client_id, trainer_id, template_id, version, doc, schedule, start_date, coach_note)
  values (p_client_id, auth.uid(), p_template_id, v_version, p_doc, p_schedule, p_start_date, p_coach_note)
  returning * into v_row;
  return v_row;
end; $$;
```

Enable **Realtime** on `nutrition_logs` (coach view updates live) if the app already uses realtime; otherwise skip.

---

## 3. PlanDoc — the plan document (`src/features/nutrition/types.ts`)

All ids inside the doc are client-generated `crypto.randomUUID()` strings and **never change** once created
(logs point at `meal_id` / `item_id`).

```ts
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export type FoodRef = {              // denormalised copy of a foods row
  foodId: string;
  name: string;                       // include state, e.g. "Salmon fillet, raw"
  category: 'protein'|'carb'|'fat'|'veg'|'fruit'|'dairy'|'drink'|'snack'|'other';
  unit: 'g'|'ml'|'piece';
  pieceGrams?: number;
  per100: Macros & { fibre?: number };
  groceryName?: string;
  groceryFactor?: number;             // default 1
};

export type SwapOption = { id: string; food: FoodRef; amount: number };

export type MealItem = {
  id: string;
  food: FoodRef;
  amount: number;                     // in food.unit (g, ml or pieces)
  swaps: SwapOption[];                // coach-approved alternatives (may be empty)
  swapMatchOn?: 'protein'|'carbs'|'fat'|'kcal';
};

export type MealBlock = {
  id: string; type: 'meal';
  name: string;                       // "BREAKFAST"
  time: string;                       // "07:30" (24h, local)
  items: MealItem[];
  showTotals: boolean;                // default true
  allowSwaps: boolean;                // default true: client may use item.swaps
};
export type SwapsBlock = { id: string; type: 'swaps'; mealId: string; itemId: string };   // display/edit card for item.swaps
export type NoteBlock = { id: string; type: 'note'; text: string };
export type EducationBlock = { id: string; type: 'education'; title: string; body?: string; articleId?: string };
export type SupplementBlock = { id: string; type: 'supplement'; items: { name: string; dose: string; timing?: string }[] };
export type HydrationBlock = { id: string; type: 'hydration'; litres: number; trainingExtraLitres?: number };
export type PhotoBlock = { id: string; type: 'photo'; source: 'checkin'|'upload';
  poses?: ('front'|'side'|'back')[]; imageUrl?: string; caption?: string };
export type DividerBlock = { id: string; type: 'divider'; label?: string };

export type Block = MealBlock|SwapsBlock|NoteBlock|EducationBlock|SupplementBlock|HydrationBlock|PhotoBlock|DividerBlock;

export type PlanDay = {
  id: string;
  name: string;                       // "DAY 1"
  type: 'training'|'rest'|'any';
  targets: Macros;
  blocks: Block[];                    // order = display order
};

export type PlanDoc = {
  schemaVersion: 1;
  name: string;                       // "FAT LOSS · PHASE 1"
  goal?: string;
  settings: { showGuidelines: boolean; showGrocery: boolean };
  guidelines?: string[];              // filled from studio_settings AT SIGN TIME only
  days: PlanDay[];
};
```

Write a `validatePlanDoc(doc)` (zod or hand-written) and run it on every load and before every save/sign.
Refuse to sign a doc with: no days, a day with no meal blocks, a meal with no items, an item with amount ≤ 0,
a meal time not matching `^([01]\d|2[0-3]):[0-5]\d$`.

---

## 4. Maths (pure functions + unit tests) — `src/features/nutrition/math.ts`

### 4.1 Item macros
```
grams = unit === 'piece' ? amount * pieceGrams : amount      // ml treated like g
factor = grams / 100
macro  = per100.macro * factor
```
- Keep **unrounded** numbers for all sums; round only for display.
- Display: kcal → integer with thousands separator (`1,839`); P/C/F → integer grams.
- `mealTotals(meal)`, `dayTotals(day)` = sum of items (meal blocks only).
- Portion on a log entry multiplies the item macros.

### 4.2 Target status (builder chip + bars)
For each of kcal/P/C/F: `pct = total/target`. Chip on the day-total card shows the **worst** deviation:
- `|1 - pct| ≤ 0.05` → green chip `WITHIN n%` (n = rounded max deviation, min 1)
- `≤ 0.10` → amber chip `OFF BY n%`
- `> 0.10` → red chip `OFF BY n%` (`#FF5C5C`)
Bars: width = `min(pct, 1) * 100%`; if `pct > 1` bar stays full and the number turns amber.

### 4.3 Adherence (one day)
```
itemScore(entry):
  skipped                      → 0
  eaten | swapped, portion in [0.75, 1.25] → 1
  eaten | swapped, portion outside that   → 0.5
  no entry yet                 → 0
adherence = sum(itemScore) / planned_items          (null if planned_items = 0)
```
Only count a day as "complete" for coach stats once the local day has ended or all items have an entry.
Extras never lower adherence; they're reported separately (`extras_kcal`).

### 4.4 Swap amount suggestion
When the coach adds a swap food to an item: match on `swapMatchOn` (default = the item food's dominant macro by
category: protein→protein, carb→carbs, fat→fat, else kcal):
```
suggested = sourceMacro / (swapFood.per100[match] / 100)   → round to nearest 5 g (pieces: nearest 0.5)
```
Coach can override the amount. Show `MATCHED TO ±5 G PROTEIN` (the actual rounded difference, ≥1 g).

### 4.5 Grocery list (per week)
```
for each weekday in schedule → its PlanDay → each meal item:
   qty[food] += amount (in grams / ml / pieces)
grocery qty = qty * groceryFactor, label = groceryName ?? food.name
```
Round up: g/ml → nearest 10; ≥ 1000 → `1.3 kg` / `1.2 L` (one decimal, drop `.0`); pieces → ceil integer.
Group by category into three columns: PROTEIN (protein+dairy), CARBS (carb), FRUIT, VEG & OTHER (the rest).

### 4.6 Tests
Vitest. Cover: piece conversion, totals match mockup numbers (Day 1 = **1,839 kcal · 158 P · 204 C · 43 F**
with seed foods), chip thresholds, adherence cases, swap rounding, grocery rounding and factors,
`localDateKey` at 23:30 and 00:30 Dubai time.

---

## 5. Coach UI

Add to Coach → **Tools** grid: **Nutrition Plans** and **Foods**. Add **Settings → Nutrition** (guidelines).

### 5.1 Nutrition Plans list
- List of templates (name, days count, last edited), search box, `+ NEW TEMPLATE`, row menu: Duplicate, Archive.
- New template = one day `DAY 1 · TRAINING` with targets pre-filled from nothing (0s) and blocks
  `BREAKFAST 07:30`, `LUNCH 13:00`, `DINNER 20:00` (empty meals).

### 5.2 Plan builder — mockup `mockups/Main.dc.html`
**Layout ≥ 1024px:** top bar 68px; three columns: left 272px (Add block + Daily targets + My templates),
centre flexible (plan), right 330px (Block settings + Added to this plan + AI refine).
**Layout < 1024px (coach on phone):** single column = centre. Top bar collapses to back arrow + name + `⋯` menu
(Preview PDF / Save template / Assign to client). A floating `+` button opens **Add block** as a bottom sheet.
Tapping a block opens its **Block settings** as a bottom sheet (AI refine lives in that sheet too).
Daily targets become a row under the day tabs that opens an edit sheet.

**Top bar:** FP logo + FORGE, breadcrumb `TOOLS / NUTRITION PLANS / <PLAN NAME>`, status pill
(`DRAFT` / `SAVED` / `SAVING…` / `OFFLINE – NOT SAVED`), buttons `PREVIEW PDF` (outline), `SAVE TEMPLATE` (outline),
`ASSIGN TO CLIENT` (white fill, black text).
**Autosave:** debounce 1.5s after any change + on blur; `SAVE TEMPLATE` forces save. Warn on leaving with unsaved changes.
**Undo/redo:** keep a history stack of the last 50 doc states (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z; on mobile an undo button in the `⋯` menu).

**Plan title:** editable inline (h1). Above it `TEMPLATE · N DAYS`.

**Day tabs:** segmented control. Active tab white fill black text. Each tab label `<NAME> · <TYPE>`.
`+ ADD DAY` → new day (choose: blank / duplicate current). Long-press / right-click a tab: Rename, Change type
(Training/Rest/Any), Duplicate, Delete (confirm; can't delete last day), Move left/right.

**Daily targets (left column):** kcal, protein g, carbs g, fat g inputs for the **selected day**, colour dots per macro.
Helper line: "Rest day has its own targets. Switch days to edit them." Optional small button
`FILL FROM MACROS` = kcal = 4P+4C+9F.

**Day total card:** big kcal total `1,839` + `OF 1,850 KCAL`, three bars P/C/F with `158 / 160 G`, status chip (§4.2).
Sticky at top of the centre column while scrolling on desktop.

**Blocks (centre):** vertical list, 16px gap. Each block card: drag handle (⋮⋮ grip), content, and on hover/focus
a small toolbar: Move up, Move down, Duplicate, Delete (Delete asks to confirm only for meals with items).
Drag-and-drop reordering with `@dnd-kit/sortable` (touch + keyboard sensors). Selected block has a 1px `#EDEDED` border.

- **Meal block** (expanded when selected, collapsed otherwise):
  - Header: grip, time (`07:30`), NAME, totals `412 KCAL 34P 64C 3F` in macro colours.
  - Table: FOOD | AMOUNT (editable pill, number input + unit) | KCAL | P | C | F | remove ✕ (aria-label).
  - `ADD FOOD — SEARCH YOUR FOODS DATABASE` input: debounced (200ms) search over the coach's foods
    (name/brand, case-insensitive, prefix matches first). Keyboard: ↑/↓/Enter. Choosing a food adds it with a
    default amount (100 g / 1 piece) and focuses the amount. Last result row: `+ CREATE "<query>"` → quick food form.
  - `FROM SAVED MEALS` → picker of meal presets → appends their items (new ids).
  - Meal menu: Save as saved meal, Refresh food values from library (re-copies per100 for all items from `foods`;
    shows what changed).
  - Collapsed: header + one line of items `CHICKEN BREAST 180 G · BASMATI RICE 200 G · …`.
- **Swaps block:** created from the palette by choosing a meal item (sheet: pick meal → pick food). Shows
  `FLEXIBLE SWAPS · <MEAL> <CATEGORY>` + `MATCHED TO ±N G <MACRO>`, the original as a white chip, options as
  grey chips with amounts, `+ ADD SWAP` (food search → suggested amount §4.4, editable). Editing here writes to
  `item.swaps` (single source of truth). Deleting a Swaps block asks: "Also remove these swaps from the food?"
  Items can also get swaps without a Swaps block (via the item row menu `Swaps…`); the block only controls
  whether the card appears in the plan/PDF.
- **Coach note:** icon + `COACH NOTE` + multiline text (inline editable, 500 chars).
- **Education:** title + body, OR link to an existing Learn article (picker). Shows title + first 2 lines.
- **Supplement:** list rows name / dose / timing; add/remove rows. Collapsed text `CREATINE 5 G · VITAMIN D3 2,000 IU`.
- **Hydration:** litres + optional "+ litres on training days". Text `3.0 L WATER · +0.5 L ON TRAINING DAYS`.
- **Photo:** source = *From check-in* (poses front/side/back, taken from the client's FIRST check-in with photos —
  resolved when the plan is assigned/rendered for a client; in a template show dashed placeholders
  `FRONT · FROM CHECK-IN`) or *Upload* (image → Supabase Storage bucket `plan-media`, compress to ~1280px, 0.8 JPEG,
  same as existing photo compression).
- **Divider:** thin line, optional label.
- `+ ADD BLOCK` dashed button at the end (inserts after the selected block if any, else at end).

**Right column:**
- `BLOCK SETTINGS · <NAME>` for the selected block. Meal: NAME, TIME, toggles `SHOW MEAL TOTALS`,
  `CLIENT CAN SWAP FOODS`. Other types: their fields. Toggles are real `<button role="switch" aria-checked>`.
- `ADDED TO THIS PLAN`: `STUDIO GUIDELINES` toggle (settings.showGuidelines), `GROCERY LIST` toggle (settings.showGrocery).
- `AI REFINE · <BLOCK>` (meal blocks only): textarea (placeholder "What should change?"), `PROPOSE CHANGE` button,
  proposal card (§8.2) with strike-through old lines, new lines, delta summary
  `+5 G FIBRE · +12 KCAL · PROTEIN UNCHANGED`, `ACCEPT` (white) / `REJECT` (outline). Footer:
  "Claude only proposes. Nothing changes until you accept." Accept applies as ONE undo step.
  Loading state while waiting; error state with retry.

**Preview PDF:** opens the PDF (§7) for the template with `CLIENT NAME` / `START DATE` placeholders.

### 5.3 Assign to client (sheet / modal)
Steps in one sheet:
1. Client picker (search; shows if they already have an active plan: `ACTIVE: FAT LOSS · PHASE 1 · V2`).
2. Start date (default today, local).
3. Weekly schedule: 7 rows Mon–Sun, each a dropdown of the plan's days. Defaults:
   - plan has 1 day → all days that day;
   - plan has exactly one `training` and one `rest` day → if the client has a training program with scheduled
     weekdays, use those for training, others rest; else Mon/Tue/Thu/Fri training, rest the others;
   - otherwise → cycle days in order.
4. Optional note to client (goes into the message).
5. Checkbox `EDIT FOR THIS CLIENT BEFORE SIGNING` → opens the builder on a copy (not saved back to the template).
6. `SIGN & SEND` → build final doc: validated `PlanDoc` + `guidelines` copied from studio_settings if
   `showGuidelines` → `rpc('sign_client_plan', …)` → post a message into the client's messages (reuse the
   app's existing message system): "Your new nutrition plan is ready — open Fuel to start." → toast `SIGNED · V<n>`.
Re-signing for the same client creates version n+1 and archives the old one. **Today's existing log keeps the
version it started with** (see §6.6).

### 5.4 Foods library (Tools → Foods)
List with search + category filter chips, `+ NEW FOOD`. Form: name, brand, state (raw/cooked/dry/none),
category, unit (g/ml/piece) + piece grams, kcal/protein/carbs/fat/fibre per 100, grocery name + factor
(help text: "Cooked rice → buy dry rice: name 'Basmati rice, dry', factor 0.35"). Live check: warn (not block)
when `|kcal − (4P+4C+9F)| > 15%`. Archive instead of delete when a food is used in any template.
**Seed** the coach's library on first open with Appendix A foods (only if the library is empty).

### 5.5 Settings → Nutrition
Studio guidelines: ordered list of short sentences; add / edit / delete / reorder. Seed with Appendix A guidelines.

### 5.6 Client profile → Nutrition tab (coach)
- Active plan card: name, version, signed date, start date, `VIEW` / `EDIT & RE-SIGN` / `PDF`.
- Adherence strip: last 7 days as 7 small bars (height = adherence, colour green ≥ 0.8, amber 0.6–0.8, red < 0.6,
  grey no log) + 7-day and 28-day averages. Average kcal vs target.
- Day list (newest first): date, day type, adherence %, kcal vs target, extras count. Tap → day detail:
  each meal with status icons (✓ planned, ⇄ swapped with "LEAN BEEF FOR CHICKEN", – skipped, ½ portion),
  extras with the raw text the client typed + estimate lines + `ESTIMATED` tag.
- Plan history: previous versions (read-only).

### 5.7 Alerts & at-risk
Add to the coach Alerts feed (and at-risk dashboard if present):
- `LOW NUTRITION ADHERENCE` — rolling 3 complete days average < 0.6.
- `NO NUTRITION LOG` — 2 consecutive complete days with no log while a plan is active.
- `HEAVY EXTRAS` — extras_kcal > 15% of target kcal on 3 of the last 7 days.
Compute client-side when the coach app loads (or in the existing automations Edge Function if the app has one —
ask Denis). Thresholds as constants at the top of one file.

---

## 6. Client UI — Fuel tab

Replace whatever is in the client **Fuel** tab. Mockups: `FuelToday.dc.html`, `FuelMeal.dc.html`, `FuelExtra.dc.html`.

### 6.1 Which plan day applies
```
plan = client's client_plans row with status 'active' (and start_date <= today)
weekday = local weekday of the date → plan.schedule[weekday] → PlanDay
if a nutrition_logs row exists for the date → use its day_id and client_plan_id (never re-derive)
```
The header shows `FRI 25 SEP · TRAINING DAY`. If the plan has a training AND a rest day, a small
`SWITCH TO REST DAY` / `SWITCH TO TRAINING DAY` link under the header lets the client swap for today
(sets `day_switched = true`; allowed only while no planned entries exist for that day — otherwise confirm
"This clears today's ticks").

### 6.2 Today screen (`FuelToday`)
Top to bottom:
1. Header: date + day type (dim label), `FUEL` h1, chip `N / M ON PLAN` = meals fully logged as eaten/swapped out
   of meals whose time has passed or that have entries (green when all, muted otherwise).
2. Rings card: 4 rings (kcal cyan, P green, C amber, F purple), centre = logged total, under = `/ TARGET UNIT`.
   Ring = logged/target, capped at 100% visually. Totals include extras.
3. Meal cards in time order, states:
   - **Logged as planned:** green circle ✓, `AS PLANNED · 07:42` (time of logging) in green, kcal right.
   - **Swapped / adjusted:** white circle with ⇄, `SWAPPED · LEAN BEEF FOR CHICKEN` (first swap; `+1` if more)
     or `ATE ¾ PORTION`.
   - **Skipped:** dim card, `SKIPPED`.
   - **Partly ticked:** `2 OF 3 TICKED` + open ring.
   - **Next** (= first meal without entries): white 1px border, `NEXT · 16:30`, food line, big white
     `✓ ATE AS PLANNED` + outline `CHANGES`.
   - **Upcoming:** same as next but outline buttons and dim time.
   Tapping a card (not a button) opens Meal detail.
4. `EXTRAS` header + `ANYTHING NOT ON YOUR PLAN`, list of today's extras (text, time, `ESTIMATED` or
   `WAITING FOR ESTIMATE`, kcal; swipe-left or long-press → Delete/Edit), then the dashed input
   `Type what you had, e.g. 2 dates` with a `+` button.
5. Link `VIEW MY FULL PLAN` (→ §6.7).

Date navigation: swipe left/right on the header or `‹ ›` buttons. Past days: editable up to **2 days back**
(constant `EDIT_WINDOW_DAYS`), older read-only. Future days: read-only preview of the planned meals
(no buttons). Dates before `start_date` → empty state.

**"Ate as planned":** one tap → upsert a `planned` entry per item of the meal (`status 'eaten'`, portion 1)
→ optimistic UI → `navigator.vibrate?.(10)` → toast `BREAKFAST LOGGED · UNDO` (5 s; undo deletes those entries).
Double tap must be harmless (unique index + upsert).

### 6.3 Meal detail (`FuelMeal`)
Back button, `20:00 · TICK WHAT YOU ATE`, meal name. Rows: checkbox (`role="checkbox"`, green when ticked),
food name, `amount · kcal`, swap button (only if `allowSwaps` and the item has swaps; white when the swap
sheet for it is open). Tick = `eaten`; untick = delete the entry (not "skipped").
Buttons: `ATE LESS / MORE` → sheet with portion chips `½ · ¾ · 1 · 1¼ · 1½` + custom %, applied to ticked items
(or tap an item's amount to set its own portion); `SKIPPED MEAL` → all items `skipped` (confirm).
Changes save immediately (no save button). Totals line at the bottom updates live.

### 6.4 Swap sheet
Bottom sheet: `SWAP · YOUR COACH'S OPTIONS`, `<FOOD> <AMOUNT>`, helper `Every option has the same <macro>, about N g`,
radio list (`role="radio"`) of `item.swaps` with amounts, selected = white fill. `SWAP AND TICK` → entry
`status 'swapped'`, `swap_option_id`, name/amount/macros of the swap food. Clients can't swap to anything
outside the coach's list (that's what Extras is for).

### 6.5 Extras (`FuelExtra`)
Tap `+` or submit the input → bottom sheet:
- Text field (pre-filled with what they typed), `RECENT` chips = the client's last 10 distinct extras
  (by lower(raw_text)); tapping a chip re-adds it with its stored macros **without** an AI call.
- `ESTIMATE` card from §8.1: one line per item `Medjool dates × 2 · 133 kcal`; tap a line to edit amount
  (macros scale linearly) or remove it. Total line `249 KCAL · 5P · 40C · 10F`.
- Helper: "Tap a line to fix the amount. Your coach sees everything you add here."
- `ADD TO TODAY` → one `extra` entry per line (`raw_text` = typed text, `estimate` = full AI json,
  `is_estimate` true).
- Offline or AI error → allow `SAVE WITHOUT ESTIMATE` → entry with `pending_estimate = true`, 0 macros;
  retried automatically when online (and shown to the coach as `NOT ESTIMATED` if it never resolves).

### 6.6 Writes, totals, offline
- Every write goes through one module `nutritionLogService`:
  1. ensure the day's `nutrition_logs` row exists (create with plan id, version, day_id, planned_items,
     targets from the PlanDay);
  2. upsert/delete entry;
  3. recompute totals + adherence from that day's entries (pure function) and update the log row.
- **Optimistic UI** everywhere. **Offline queue** in IndexedDB (use `idb-keyval` or the app's existing offline
  layer if it has one): each op has a `client_ref` (uuid) for idempotency; flush on `online` event, app focus and
  every 30 s; show a small `OFFLINE · WILL SYNC` pill when the queue isn't empty.
- If the coach signs a new plan version mid-day and today's log already has entries, today stays on the old
  version; the new plan starts tomorrow. If today has no entries yet, today switches immediately.

### 6.7 My plan (read-only)
Full plan in-app: targets, each day's meals with foods and amounts, swaps table, supplements, hydration,
guidelines, grocery list (if enabled). `DOWNLOAD PDF` button (§7).

### 6.8 Hooks into the rest of the app
- **Today (home) Protein ring** = today's logged protein / today's protein target (replace current source).
  Calories ring likewise if present.
- **Weekly check-in "Your week" auto-recap**: add 7-day nutrition adherence %, average kcal vs target,
  number of extras, number of skipped meals.
- Nutrition Learn articles can be linked from Education blocks.

---

## 7. PDF — mockups `PdfPage1.dc.html`, `PdfPage2.dc.html`

Use **`@react-pdf/renderer`** (deterministic A4 output, works in iOS PWAs). Generate client-side, lazy-load the
library only when a PDF is requested. File name: `Forge-Nutrition-Plan-<ClientName>-v<version>.pdf`.

- A4 (595×842 pt). Black background, colours = tokens. Scale mockup px → pt by 0.75.
- **Font:** react-pdf needs an embedded font file. Bundle ONE bold sans TTF in `public/fonts/` and register it.
  **Ask Denis to approve the font** before shipping (typography is locked).
- **Page 1:** header (FP triangle logo: white outline triangle, red F, white P; `FORGE` + red `PERFORMANCE`;
  right: `THE FORGE METHOD` / `NUTRITION PLAN`), `PREPARED FOR` + client name + `<PLAN NAME> · FROM <START DATE>`,
  `COACH / DENIS`, 4 target tiles with colour bars, then each day: `DAY 1 · TRAINING DAY` + day totals, meal
  cards (time, name, macros, food rows with amounts; swapped-able foods get `· swaps on page 2`), coach notes
  (white-bordered "FROM YOUR COACH" box).
- **Following pages:** `FLEXIBLE SWAPS` table (rows grouped by category PROTEIN/CARBS/FATS, each row = original
  + options), `HYDRATION & SUPPLEMENTS` + `GUIDELINES` side by side, `GROCERY LIST · 7 DAYS` (3 columns, §4.5),
  `STARTING POINT` photos (front/side/back from first check-in; dashed placeholders if missing), education blocks.
- Every page footer: `THE FORGE METHOD · +971 567 088 638` left, `n / N` right.
- Never split a meal card across pages (`wrap={false}`); multi-day plans just flow onto more pages.
- Hide sections that are off or empty (no swaps → no swaps table, grocery off → no list, etc.).
- Template preview uses `CLIENT NAME` / `START DATE` placeholders.
- Ask Denis: black PDF only, or also a white "print" version toggle? (Build black first.)

---

## 8. AI — Supabase Edge Functions (Deno)

Shared: secrets `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` (set `ANTHROPIC_MODEL=claude-sonnet-5`; keep it
configurable, don't hardcode). Call `https://api.anthropic.com/v1/messages` with headers
`x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`. Use **tool use with a JSON
schema** and `tool_choice: {type: "tool", name: ...}` to force structured output. Verify the caller's JWT
(`supabase.auth.getUser()`), log a row in `ai_usage`, rate-limit, validate the output server-side, return JSON.
CORS for the app's origins. Timeout 25 s. Never log the typed text with the user id in plain logs.

### 8.1 `forge-nutrition-estimate` (client extras)
Input `{ text: string }` (1–300 chars). Caller must be a client. Rate limit: 40 calls / client / local day.
Tool `record_estimate` schema:
```json
{
  "type": "object",
  "properties": {
    "items": { "type": "array", "maxItems": 12, "items": {
      "type": "object",
      "properties": {
        "name":    { "type": "string" },
        "amount":  { "type": "number" },
        "unit":    { "type": "string", "enum": ["g","ml","piece"] },
        "grams":   { "type": "number" },
        "kcal":    { "type": "number" }, "protein": { "type": "number" },
        "carbs":   { "type": "number" }, "fat":     { "type": "number" },
        "confidence": { "type": "string", "enum": ["high","medium","low"] }
      },
      "required": ["name","amount","unit","grams","kcal","protein","carbs","fat","confidence"] } },
    "not_food": { "type": "boolean" }
  },
  "required": ["items","not_food"]
}
```
System prompt:
> You estimate calories and macros for food a coaching client typed in free text. Split the text into
> separate foods/drinks. Assume typical portions when none are given ("a handful of almonds" ≈ 20 g,
> "medium latte" ≈ 350 ml). Use standard nutrition database values. Name items clearly with the portion you
> assumed. If the text is not food or drink, return no items and not_food = true. Use UAE/UK/US common foods.
> Never give advice — only the estimate.

Server validation: clamp negatives to 0; flag (don't reject) items where `|kcal − (4P+4C+9F)| > 20%` by
recomputing kcal from macros; total kcal > 3000 → return with `warning: "large"` so the UI asks "Is this right?".

### 8.2 `forge-nutrition-refine` (coach AI refine)
Input `{ meal: MealBlock, dayTargets: Macros, dayTotals: Macros, instruction: string, foods: FoodRef[] }`
(`foods` = up to 150 of the coach's library foods, most relevant first — send name, per100, unit, id).
Caller must be a coach. Rate limit 60 / day.
Tool `propose_changes`:
```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "ops": { "type": "array", "maxItems": 8, "items": {
      "type": "object",
      "properties": {
        "op":      { "type": "string", "enum": ["replace","add","remove","set_amount"] },
        "itemId":  { "type": "string" },
        "foodId":  { "type": "string" },
        "newFood": { "type": "object", "properties": {
            "name": {"type":"string"}, "unit": {"type":"string","enum":["g","ml","piece"]},
            "kcal":{"type":"number"},"protein":{"type":"number"},"carbs":{"type":"number"},"fat":{"type":"number"},
            "fibre":{"type":"number"} } },
        "amount":  { "type": "number" },
        "reason":  { "type": "string" }
      },
      "required": ["op","reason"] } }
  },
  "required": ["summary","ops"]
}
```
System prompt:
> You help a strength & nutrition coach refine one meal in a client nutrition plan. Follow the coach's
> instruction. Prefer foods from the provided library (use their foodId). Only use newFood when nothing in the
> library fits; give per-100 g values. Keep the day's macros within 5% of targets unless the instruction says
> otherwise. Make the fewest changes that achieve the instruction. Amounts in grams rounded to 5 g.

Frontend: apply ops to a **copy** of the meal, compute before/after deltas (kcal, P, C, F, fibre) and render the
proposal card. `ACCEPT` commits (newFood → first insert into `foods`, flagged in the food form as AI-created).
`REJECT` discards. Proposals referencing unknown itemIds/foodIds are dropped with a note.

Deploy notes to include in the repo README:
```
supabase secrets set ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=claude-sonnet-5
supabase functions deploy forge-nutrition-estimate
supabase functions deploy forge-nutrition-refine
```

---

## 9. States, errors, accessibility

- Every screen: loading skeleton, empty state, error state with retry.
  - Client, no active plan: "Your coach is building your plan." + Extras still usable.
  - Coach, no templates: "No plans yet" + `+ NEW TEMPLATE`.
  - Foods search no results: `+ CREATE "<query>"`.
- Buttons are `<button>`, links `<a>`, inputs have `<label>` or `aria-label`; icon-only buttons have
  `aria-label`; checkboxes/radios/switches use the right roles and `aria-checked`; sheets are
  `role="dialog"` with focus trap, Esc/back to close, and return focus.
- Colour is never the only signal (icons + text on statuses).
- Text contrast ≥ 4.5:1 (don't put `#6e6e6e` text on `#171717` for anything important).
- Respect `prefers-reduced-motion` for ring/sheet animations.
- Numbers use `Intl.NumberFormat('en-US')`.

## 10. Performance
- Plan docs are small; load the active plan once and cache (React Query or the app's existing data layer).
- Food search: query with `ilike` + limit 20, or load the coach's whole library once (it's small) and search
  in memory — pick one and say which.
- Lazy-load the builder route, `@dnd-kit`, and `@react-pdf/renderer`.
- Logging must feel instant: optimistic updates, no spinners on tick.

---

## 11. Phases (stop after each, show Denis, wait for "go")

| # | Phase | Done when |
|---|---|---|
| 0 | **Recon.** Read the repo: auth, `clients`, roles, routing, nav tabs, tokens/theme, messages, check-ins, program calendar, offline layer, existing Edge Functions. Write `docs/nutrition-recon.md` with the exact table/column/function names you'll use instead of this spec's placeholders, and list any conflicts. | Denis approves the recon note. |
| 1 | Migration + RLS + `sign_client_plan` RPC; `types.ts`, `validatePlanDoc`, `math.ts`, `dates.ts` + Vitest tests. | Migration applies cleanly on a fresh DB; all tests pass; Day 1 seed totals = 1,839 / 158 / 204 / 43. |
| 2 | Foods library + seed (Appendix A) + Settings → Nutrition guidelines. | CRUD works on phone + desktop; macro sanity warning shows. |
| 3 | Plan builder core: list, days, targets, meal blocks, food search, amounts, totals, chip, autosave, undo, drag reorder, responsive layout. | Matches `Main.dc.html` on desktop; usable on a 390px phone. |
| 4 | Other blocks: swaps (+ suggestion), note, education, supplement, hydration, photo, divider; saved meals. | Every block type creates/edits/deletes/reorders. |
| 5 | Assign & sign: sheet, schedule defaults, per-client edit, RPC, message to client, versioning; client profile Nutrition tab (plan card + history only). | Signing twice gives v1 archived + v2 active. |
| 6 | Client Fuel: Today, meal detail, swap sheet, day switch, date nav, undo, offline queue, totals + adherence on the log row. | Log a full day on a phone in airplane mode, reconnect, coach sees it. |
| 7 | Extras + `forge-nutrition-estimate` + recent chips + pending estimates. | "2 dates and a handful of almonds" → ~249 kcal lines; offline typed extra resolves later. |
| 8 | PDF + grocery list (template preview + client download). | Output matches the two PDF mockups; meals never split across pages. |
| 9 | Coach insights: adherence strip, day detail, alerts, Home protein ring, check-in recap. | Alerts fire on seeded test data. |
| 10 | AI refine + `forge-nutrition-refine`. | Propose → accept/reject works; accept is one undo step. |
| 11 | QA pass (§12) + README deploy notes. | Checklist all green. |

Commit per phase: `feat(nutrition): phase N – <short name>`.

## 12. QA checklist
- [ ] Coach and client can never see another coach's/client's data (test RLS with two clients + a second coach).
- [ ] Dubai 23:59 vs 00:01 logs land on the right dates.
- [ ] Re-signing mid-day keeps today on the old version if today has entries.
- [ ] Deleting/archiving a food doesn't change any signed plan or past log.
- [ ] Double-tapping "Ate as planned" creates no duplicates; undo removes exactly that meal's entries.
- [ ] Offline: tick 3 meals + 1 extra, kill the app, reopen online → all synced once.
- [ ] Swap sheet only shows coach options; swap macros correct.
- [ ] Portion ¾ → macros × 0.75, adherence 1; portion ½ → adherence 0.5.
- [ ] Rings and totals include extras; adherence ignores extras.
- [ ] PDF: 1-day and 3-day plans, with/without swaps, grocery off, no photos.
- [ ] Builder usable at 390px wide; all touch targets ≥ 44px.
- [ ] Keyboard-only: can build a meal, reorder blocks, open/close sheets.
- [ ] AI functions reject unauthenticated calls and respect rate limits; key never reaches the browser.

## 13. Open decisions — ask Denis, don't guess
1. PDF font (must embed one) and whether to add a white print version.
2. Edit window for past days (default 2 days).
3. May clients switch training/rest day themselves (default yes)?
4. Alert thresholds (defaults in §5.7).
5. Should the coach be able to edit a client's log (corrections)? Policy allows update on `nutrition_logs`;
   UI not built unless he says yes.

---

## Appendix A — seed data

**Foods (per 100 g unless noted).** Starter values from standard databases — Denis should verify.

| name | category | unit | state | kcal | P | C | F | fibre | grocery name / factor |
|---|---|---|---|---|---|---|---|---|---|
| Greek yogurt 0% | dairy | g | – | 54 | 10.4 | 3.6 | 0 | 0 | – |
| Rolled oats | carb | g | dry | 380 | 13 | 66 | 6.5 | 10 | – |
| Blueberries | fruit | g | – | 57 | 0.7 | 14.5 | 0.3 | 2.4 | – |
| Raspberries | fruit | g | – | 52 | 1.2 | 12 | 0.7 | 6.5 | – |
| Honey | other | g | – | 304 | 0.3 | 82 | 0 | 0 | – |
| Chicken breast | protein | g | cooked | 165 | 31 | 0 | 3.6 | 0 | Chicken breast, raw / 1.35 |
| Lean beef mince 5% | protein | g | cooked | 180 | 28 | 0 | 7.5 | 0 | Lean beef mince 5%, raw / 1.3 |
| White fish (cod) | protein | g | cooked | 105 | 23 | 0 | 0.9 | 0 | White fish, raw / 1.25 |
| Firm tofu | protein | g | – | 144 | 17 | 3 | 9 | 2 | – |
| Salmon fillet | protein | g | raw | 208 | 20 | 0 | 13.4 | 0 | – |
| Whey protein | protein | g | – | 400 | 80 | 10 | 6.7 | 0 | – |
| Basmati rice | carb | g | cooked | 130 | 2.7 | 28 | 0.3 | 0.4 | Basmati rice, dry / 0.35 |
| Potatoes, boiled | carb | g | cooked | 87 | 1.9 | 20 | 0.1 | 1.8 | Potatoes / 1 |
| Wholewheat pasta | carb | g | cooked | 124 | 5.3 | 26.5 | 0.5 | 4 | Wholewheat pasta, dry / 0.4 |
| Sourdough | carb | g | – | 289 | 11.8 | 56 | 1.8 | 2.4 | – |
| Sweet potato | carb | g | – | 86 | 1.6 | 20 | 0.1 | 3 | – |
| Banana | fruit | piece (120 g) | – | 89 | 1.1 | 22.8 | 0.3 | 2.6 | – |
| Medjool dates | fruit | piece (24 g) | – | 277 | 1.8 | 75 | 0.2 | 6.7 | – |
| Broccoli | veg | g | – | 34 | 2.8 | 6.6 | 0.4 | 2.6 | – |
| Mixed salad | veg | g | – | 20 | 1.2 | 3.5 | 0.2 | 1.5 | – |
| Avocado | fat | g | – | 160 | 2 | 8.5 | 14.7 | 6.7 | – |
| Almonds | fat | g | – | 579 | 21 | 22 | 50 | 12.5 | – |
| Olive oil | fat | ml | – | 884 | 0 | 0 | 100 | 0 | – |

(Olive oil: treat ml ≈ g for the maths; the mockup lists it as "10 g".)
Banana in the mockup is written as grams (120 g); keep piece foods displayable in grams too
(`1 banana (120 g)`).

**Example template** "FAT LOSS · PHASE 1" (create it in the seed so Denis sees the mockup rebuilt):
- DAY 1 · TRAINING — targets 1,850 kcal · 160 P · 200 C · 45 F
  - Photo block (from check-in: front/side/back)
  - BREAKFAST 07:30: Greek yogurt 0% 250 g, Rolled oats 50 g, Blueberries 100 g, Honey 10 g
  - Coach note: "Hit protein first at every meal. On training days, move the banana from your snack to
    60 minutes before your session."
  - LUNCH 13:00: Chicken breast 180 g (swaps: Lean beef 5% 190 g, White fish 240 g, Firm tofu 330 g),
    Basmati rice 200 g (swaps: Potatoes 300 g, Wholewheat pasta 170 g, Sourdough 100 g),
    Mixed salad 100 g, Olive oil 10 g (swaps: Avocado 60 g, Almonds 18 g)
  - Swaps block → Lunch / Chicken breast
  - PRE-SESSION SNACK 16:30: Whey protein 30 g, Banana 120 g
  - DINNER 20:00: Salmon fillet 150 g, Sweet potato 200 g (swaps: Basmati rice 145 g, Potatoes 235 g,
    Wholewheat pasta 135 g, Sourdough 80 g), Broccoli 150 g
  - Hydration 3.0 L, +0.5 L training
  - Supplements: Creatine 5 g daily; Vitamin D3 2,000 IU with a meal
- DAY 2 · REST — copy of Day 1 without the pre-session snack; targets 1,650 kcal · 160 P · 150 C · 50 F
  (Denis to adjust).
- Settings: guidelines on, grocery list on.
Expected Day 1 totals: **1,839 kcal · 158 P · 204 C · 43 F**. (Swap amounts in the seed are Denis's; the §4.4
suggestion is only used when adding new swaps.)

**Studio guidelines:**
1. Weights are cooked unless marked raw.
2. Protein first at every meal.
3. Swap only within the same row.
4. One flexible meal a week. Keep the protein.
5. Message me before changing anything else.

Note for Phase 0: the app may still carry monolith conventions from its earlier `App.jsx` history (BRAND tokens,
GLOBAL_TEXT_CSS, `client_data`/`trainer_data` sections via `upsertSection`/`upsertTrainerData`,
`buildProgramDays()` for training days) alongside newer patterns from the rebuild. Recon should confirm which
conventions are actually current in the merged codebase and use those — don't assume either the old or the v2
shape without checking.
