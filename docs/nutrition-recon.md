# Nutrition rebuild — Phase 0 recon

Per `NUTRITION_SPEC.md` §11 Phase 0: "inspect the repo... write this note... Denis approves before Phase 1."
This is that note. **No code, migration, or dependency has been added yet.**

The mockups (`mockups/*.dc.html`) are genuinely good — clean, professional, and worth building toward.
The written spec is thorough and clearly took real care. But it was written without seeing this actual
codebase, and it assumes an architecture that doesn't match what's here. That's not a criticism of the
spec — §8 of it says as much ("adapt table/column names... to what already exists") — it's exactly what
Phase 0 is for. The gaps are bigger than table names, though, so they need your call before I touch anything.

## 1. What the spec assumes vs. what's actually here

| Spec assumes | Actually in this repo |
|---|---|
| A "merged" codebase, old app + v2 rebuild combined | There's one `forge-app`. No merge ever happened, no v2 to reconcile. |
| Relational tables: `foods`, `plan_templates`, `client_plans`, `nutrition_logs`, `nutrition_log_entries`, `meal_presets`, `studio_settings` | **Every** feature — training programs, nutrition, check-ins, messages, body analysis, payments — lives as JSON under two tables: `client_data(client_id, section, data)` and `trainer_data(trainer_id, section, data)`, read/written through `upsertSection()` / `upsertTrainerData()` (`src/lib/clientData.js`). No relational per-feature tables exist anywhere in the app. |
| `clients(id, user_id, trainer_id)` | Real columns: `clients(id, trainer_id, client_user_id, ...)` — different name (`client_user_id`, not `user_id`). |
| AI via Anthropic (`ANTHROPIC_API_KEY`, `claude-sonnet-5`, Messages API, tool-use JSON schema), two new edge functions `forge-nutrition-estimate` / `forge-nutrition-refine` | AI runs on **Google Gemini** (`GEMINI_API_KEY`, model `gemini-3.6-flash`, overridable via `GEMINI_MODEL` secret) through **one shared edge function `forge-ai`**, action-routed (`{action: "...", ...}`). Ten actions already live there — nutrition report drafting, client summaries, AI chat, body-analysis PDF/image reading, program generation, progression suggestions. This was a deliberate, hard-won choice this session (see `DECISIONS.md` — there's a whole log of two failed migrations, including one to a different provider, before landing here). Introducing Anthropic as a second provider for nutrition only would fragment AI infra into two systems, two key-management stories, two failure modes. |
| Dependencies: `@dnd-kit/sortable`, `@react-pdf/renderer`, `idb-keyval`, implicitly React Query | **None of these are installed.** Current `dependencies`: `@phosphor-icons/react`, `@supabase/supabase-js`, `jszip`, `pdf-lib`, `react`, `react-dom`, `react-router-dom`, `vite-plugin-pwa`, `xlsx`. |
| PDF via `@react-pdf/renderer` | PDFs are already built with **`pdf-lib`**, hand-drawn (`src/lib/pdf.js`: `buildPdfDoc` for text/tables, `buildWeeklyReportPDF` for a chart-embedding variant using a small dependency-free canvas renderer, `src/lib/reportCharts.js`). Two working PDF exports already ship this way (Program PDF, Weekly Report PDF). |
| IndexedDB offline queue (`idb-keyval` or "the app's existing layer") | There **is** an existing layer: `src/lib/cache.js` — `enqueueSync()` / `flushSyncQueue()`, localStorage-backed, already wired into every `upsertSection()` call as the default write path. This is what "the app's existing offline layer" in the spec's own phrasing refers to. |
| Realtime on `nutrition_logs` | Not used anywhere in the app currently. No blocker to adding it, but it'd be a first — worth confirming it's wanted rather than assumed. |
| Messages system to "reuse" | Real one: `client.messages`, written via `upsertSection(clientId, "messages", {list})`, entry shape `{id, from: "coach"|"client", text, date, read}`. Rendered in `MessagesTab.jsx`. Directly reusable as described — this one's a real match. |
| Check-ins to "reuse" (photos) | Real one: `CheckInsTab.jsx`, submissions in `client.checkIns`, **and** (built earlier this session) check-in photos already flow into the same `transformPhotos` section the Photos tab reads — so "first check-in with photos" for the plan's photo block has real data to resolve against already. |
| Program calendar `buildProgramDays()` | Exists, same name, `src/lib/programModel.js`. Training-day/rest-day lookups for the assign-schedule default (§5.3) can use this directly. |
| Coach "Tools" grid | Exists: `CoachDashboard.jsx`, a plain array `TOOLS = [{key, name, meta, icon, color}]`. Adding "Nutrition Plans" and "Foods" tiles is a two-line change, not new infrastructure. |
| Client bottom nav has 6 tabs incl. `CHECK-IN` and `LEARN` as their own slots | Actual current nav is 5 tabs: `Home, Train, Fuel, AI Coach, Me`. Check-ins and Learn are reached from inside "Me", not their own nav slots (this changed a few iterations ago in this same session — the nav used to be busier and was deliberately trimmed). Fuel *is* still its own tab, which matches. |
| A from-scratch "Fuel" tab | There's a **working nutrition system already live today**: `NutritionFlow.jsx` routes each client through a phase cycle (baseline → report → adjustment → maintenance) with a full food/photo diary (`FoodDiary.jsx`) and a coach-toggleable **macros-only mode** (`tracking_mode`, added this session) that skips the diary entirely for clients who just want numbers — plus a `MacroTracker.jsx` (search-based macro logging), `BodyAnalysis.jsx` (AI-read InBody/DEXA PDF uploads), coach-set macro targets, and AI nutrition-report drafting. This is real, used, and has real client data in it already. The spec's plan replaces this outright with something structurally different (a coach-authored prescriptive plan the client ticks off, vs. the current client-driven log-everything model). **These are two different products**, not an upgrade path from one to the other — see §3 below. |

## 2. Where the spec and reality already agree (no conflict)

- Design tokens (§0.2) — the app has an equivalent BRAND/T token system (`src/theme/tokens.js`, `src/styles/theme.css`) already. The exact hex values differ (this app went through a whole "MacroFactor black/white" restyle earlier this session, documented in `DECISIONS.md`) — reconciling the spec's token table against the current theme is Phase 1 work, not a blocker, just needs a deliberate pass rather than silently overwriting the current palette.
- `localDateKey` / timezone discipline (§0.5) — good instinct, not yet a named helper in this codebase (`isoDate()` in `lib/dateUtils.js` is the closest thing — worth auditing whether it's UTC-safe already or needs the fix the spec describes).
- Mobile-first, phase-gated delivery, "ask Denis, don't guess" — matches how this whole session has actually run.
- Messages, check-ins, program calendar reuse — all real, all reusable as described (see table above).

## 3. The decision this recon can't make for you

The spec describes a **coach-authored prescriptive plan** system: the coach builds a plan of exact foods/amounts/times, signs it, and the client ticks off what they ate against it (with swaps from a coach-approved list, and free-text "Extras" for anything off-plan). That's a genuinely different product from what's live today, which is a **client-driven log** (the client searches/photographs/describes what they eat; the coach reviews and sets targets, but doesn't prescribe individual meals in advance).

Both are legitimate, well-built things. They are not the same feature with different UI polish — they're different coaching philosophies, and a real coach-facing product decision, not a technical one. Two honest paths:

- **A. Build the spec's system alongside the current one**, as a new, separate mode a coach can choose per client (much like `tracking_mode` today already branches between "food log" and "macros only" — this would be a third branch: "prescribed plan"). Nothing existing breaks; existing clients on food-log/macros-only are untouched. New relational tables *can* still make sense here specifically because a prescribed plan is genuinely structured/relational data (days → blocks → items, swap tables, versioned signed snapshots) in a way the current JSONB sections aren't — but see §4, there's a middle path.
- **B. Replace the current system with the spec's**, migrating existing client nutrition data across. Bigger, riskier, and means every client's current in-progress nutrition phase/history needs a migration story the spec doesn't cover (because it assumed a merge had already happened and there was nothing to migrate).

Given how new and actively-iterated the current system is (macros-only mode, body analysis, weekly reports, coach-set targets all shipped in the last few days of this same session), **A seems clearly right** unless you tell me otherwise — but I'm not choosing that for you, since it's exactly the kind of call the spec itself says is yours.

## 4. Recommended adaptation (pending your go-ahead)

If (A): keep the relational schema **but store it inside `trainer_data`/`client_data` as JSONB sections**, matching every other feature in this app, rather than seven new Postgres tables with their own RLS policy set. Concretely:
- `trainer_data` sections: `foods` (the coach's food library), `meal_presets`, `plan_templates`, `nutrition_studio_settings`.
- `client_data` sections: `nutrition_plan` (the signed, versioned `PlanDoc` snapshot + schedule — versioning done as an array of past versions in the JSON, like `client_plans` but without a new table), `nutrition_plan_logs` (the day-by-day tick log, keyed by date like `habits`/`macro_log` already are).
- This keeps RLS trivial (the existing `client_data`/`trainer_data` policies already scope everything to `trainer_id = auth.uid()` / the client's own row — no new policy surface, no new attack surface to review) and avoids a second data-access pattern existing alongside `upsertSection` everywhere else in the app.
- AI estimate (§8.1) and AI refine (§8.2) become two new `action`s on the existing `forge-ai` function, on Gemini, following the same schema-forcing pattern the other ten actions already use — not a new Anthropic integration.
- PDF via `pdf-lib` + `reportCharts.js`, extending the pattern from the Weekly Report PDF, not `@react-pdf/renderer`.
- Drag-and-drop reordering (§5.2): a native HTML5 drag-and-drop or a small hand-rolled up/down-button reorder (the app already does up/down-button reordering elsewhere, e.g. program block ordering in `ProgramBuilder`) instead of pulling in `@dnd-kit`. Worth a real UX call, not just a cost-saving default — flagging it as a decision, not deciding it here.
- Offline queue: reuse `enqueueSync`/`flushSyncQueue` from `lib/cache.js` as-is.

This keeps the spec's actual feature set and UI (the mockups) almost entirely intact — the changes above are all "how it's stored/called," not "what it looks like or does."

## 5. Open decisions (spec §13, plus what recon surfaced)

1. **A or B above** (new parallel mode vs. replace the current system) — the big one.
2. Anthropic vs. Gemini for the two new AI actions (recon recommends Gemini, for the reasons above).
3. New relational tables vs. JSONB sections in the existing two tables (recon recommends JSONB, for the reasons above).
4. `@dnd-kit` vs. a lighter reorder pattern already used elsewhere in the app.
5. `@react-pdf/renderer` vs. extending the existing `pdf-lib` approach (recon recommends extending).
6. PDF font to embed (spec §7 — needs your approval regardless of library choice).
7. Past-day edit window (spec default: 2 days) — fine unless you want different.
8. Can clients switch training/rest day themselves (spec default: yes) — fine unless you want different.
9. Alert thresholds (spec §5.7 defaults) — fine unless you want different.
10. Should the coach be able to correct a client's log after the fact (spec leaves this open).
11. If (A): what happens to a client currently mid-phase on the existing food-log/macros system when a coach wants to move them to a prescribed plan — anything to preserve, or a clean cutover?

I'll wait for your answers on these — especially #1 — before starting Phase 1.
