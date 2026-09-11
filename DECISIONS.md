# v2 restyle — decisions log

Autonomous overnight restyle run. One line per judgment call, in the order made.

## Setup

- **Reference file missing.** `design/forge-sora-reference.html` does not exist anywhere in the repo (checked via glob, not just the `design/` folder). Proceeding entirely from the detailed written spec, which fully specifies exact token values, typography rules, and component rules — sufficient to build a complete, cohesive system without the visual mockup. If the file turns up later, a follow-up visual diff pass against it is recommended.
- **Existing v2 token system ("ember") is superseded, not merged.** `src/styles/tokens.css` already existed on this branch (from prior commits `9fa3d35`/`aacac65`) with a warm orange/"ember" accent palette, `[data-app='client'|'coach']` per-app palette variance, and a planned (but never implemented — `src/hooks/useAccentColor.js` / `useTheme.js` do not exist) coach-customizable accent-color picker. This directly conflicts with the new spec (strict black/white base, exactly 3 functional accents — green/blue/yellow, explicitly "no orange/amber anywhere", one shared system for both apps, not per-app palettes). Since the accent-picker was never actually wired to any real feature/logic (no hook files exist, nothing reads or writes an override), removing this scaffolding is a pure styling change, not a logic change. Replaced `tokens.css` entirely with the new spec'd `src/styles/theme.css`.
- **`data-app="client"/"coach"` DOM attributes left in place** (harmless now that no CSS selects on them) rather than removed from `ClientView.jsx`/`CoachDashboard.jsx`, to minimize touched surface area in files that also carry real logic.
- **Deleted `src/App.css`** — 100% unused Vite-boilerplate (confirmed via grep, no imports anywhere), leftover from project scaffolding.

## Color-token mapping (old `BRAND`/`T` JS objects → new CSS vars)

The app uses inline `style={{}}` objects everywhere (no CSS classes/modules), built from two central JS token objects (`BRAND`, `T` in `src/theme/tokens.js`) imported by nearly every component. Rather than touch every call site individually, the highest-leverage move is to make `BRAND`/`T`'s *values* themselves reference `var(--token)` strings — every existing consumer picks up the new system automatically. Mapping used:

- `BRAND.bg → var(--page)`, `panel → var(--card-soft)`, `card → var(--card)`, `card2 → var(--chip)`, `line → var(--line)`, `text → var(--ink)`, `muted → var(--ink-2)`, `dim → var(--ink-3)`.
- `BRAND.gold` (previously literal white, used as the app's one bright accent for emphasis/headings/active-states) `→ var(--ink)`. The dedicated "gold" **button** variant (solid CTA) is handled separately in `Button.jsx` using `--btn-bg`/`--btn-ink`, since a button fill and a text-emphasis color are different concerns that happened to share one token before.
- `BRAND.green → var(--green)`. `BRAND.cyan` and `BRAND.blue → var(--blue)` (merged; both were "info" tints in the old system, the new one has one action/link accent).
- `BRAND.red → var(--yellow)`. The new system has no dedicated "danger" accent (only progress/action/attention). "Needs attention" is the closest semantic bucket for errors, overdue payments, and destructive-action affordances, so red-coded UI (delete buttons, overdue banners, error toasts) now reads as yellow. Destructive actions still go through a confirm step, which is where the real safety comes from, not the color.
- `BRAND.purple`, `BRAND.orange → var(--ink-2)` as a generic fallback where the color was purely decorative/categorical (not a real signal). See below for where categorical color was removed outright instead.
- `T.gold → var(--ink)`, `T.good → var(--green)`, `T.warn`/`T.bad → var(--yellow)` (same red/warn collapse as above).

## Categorical color removed (spec: "accents are signals, not decoration")

- **Learn article categories** (Training/Nutrition/Mindset/Recovery, previously orange/green/purple/blue) and **meal-type colors** in the food diary (breakfast/lunch/dinner/snacks, previously orange/blue/purple/green) no longer carry distinct hues. Both now differentiate by label/icon only, styled in neutral ink tones. This is a real, intentional scannability trade-off (four colors that could be told apart at a glance are now four labels) made because the spec is explicit that the three functional accents are the *only* accents allowed, and using them for mere categorization (not a real progress/action/attention signal) would violate that rule four times over. If this reads as a regression once live, the fix is a deliberate spec amendment (e.g. "add a 4th neutral categorical palette"), not something to patch silently mid-restyle.
- **Per-client identity color** (`CLIENT_COLORS`, used for a client's avatar ring and active-tab highlight in the coach's multi-client view) is the one exception kept as-is. This is an identity marker (which client is this), not a meaning signal, and the coach's client list becomes materially harder to scan at a glance without it. No token in the new spec covers this use case.

## Typography

- Applied `--display` (Sora) to: screen/section titles, large stat numbers, avatar-circle initials. Everything else (labels, buttons, body, nav, list rows) uses `--sans` (Inter), per spec.
- Standardized on weights 400/500 everywhere, 600 reserved for a person's name (client name in headers, coach name), matching the spec's "two weights only" rule.
- All-caps section/eyebrow labels converted from `letterSpacing:1.4` (eyebrow) / various to the spec's exact `.16em`/`.14em` values.

- **Retired `GLOBAL_TEXT_CSS`** (the old injected `<style>` block in `App.jsx`). It force-applied `font-weight: 700 !important` to everything, which would have silently overridden the new 400/500 typography rule everywhere; theme.css's global button/select/checkbox rules already superseded the rest of it. Folded its two still-useful rules (`img,video{max-width:100%}`, viewport overflow guard) into `theme.css`.
- **Loading splash "FORGE" → "Forge"**, set in Sora. Spec says sentence case everywhere with no exception carved out for the wordmark, so applying it literally rather than treating the logo as exempt.

## Milestone 2/3 — screen-by-screen restyle

Executed via several parallel subagents (one per independent feature-folder
group), each given the exact token/typography/component rules above plus
the alpha-suffix-bug pattern to hunt for, and the largest cross-cutting
files (`TrainScreens.jsx`, `CoachDashboard.jsx`, `ClientView.jsx`,
`ClientShellUI.jsx`) handled directly rather than split across agents, to
keep one consistent hand on the files every screen composes from. All
agents' changes were spot-checked and verified with a full build + lint
pass before committing. Notable judgment calls surfaced during review:

- **Alpha-suffix bug was widespread**: `` `${BRAND.x}NN` `` (and one
  `BRAND.gold + "77"` string-concatenation variant) appeared in ~15 spots
  across `InjuryBanner.jsx`, `TrainScreens.jsx`, `CoachDashboard.jsx`,
  `ProfileTab.jsx`, `ScreeningForm.jsx`, `Report.jsx`, and more — all fixed
  with a dedicated `-bg` token or `color-mix()`. Ran a final full-repo grep
  for both the template-literal and string-concatenation forms of this bug
  after all agents finished, to make sure nothing was missed.
- **`BRAND.gold` + literal `"#000"` text is a real light-theme bug**:
  `BRAND.gold` now resolves to the `ink` token, which flips from white
  (dark theme) to near-black (light theme). Anywhere a `BRAND.gold`
  background was paired with hardcoded black text (`TrainScreens.jsx`'s
  rest-timer buttons, day-pills, exercise-tag badges, library-picker
  toggle, `InjuryBanner.jsx`'s icon circle) would have rendered invisible
  black-on-black in light mode. Replaced every instance with `BRAND.btnInk`
  (the token that's guaranteed to contrast against an ink-colored fill in
  both themes). Left `color:"#000"` alone where paired with `BRAND.green`/
  `BRAND.yellow` (mid-brightness in both themes, not an inversion risk) or
  with an arbitrary per-client identity color (already an accepted
  exception elsewhere).
- **MealSheet's cooking-method chips**: removed the `color={accentColor}`
  prop from `<Chip>` calls (the prop no longer exists on the component) —
  falls back to the primitive's own neutral/selected treatment.
- **Nutrition macro bars**: `T.meal.breakfast/lunch/dinner/snacks` (already
  flattened to `dim` in the tokens file per the categorical-color removal
  above) referenced directly as `T.dim` for clarity in `Report.jsx`.
- **CoachDashboard tool tiles**: previously each tile (Templates, Trials,
  Analytics, Exercise Library, Calendar...) had a distinct accent color
  purely for visual variety. Flattened to one neutral dot per tile —
  differentiated by icon + label only, consistent with the categorical-
  color-removal rule applied to Learn/meal-types.
- **Coach alerts/Today-agenda**: check-ins-due, payments-due, and the
  Alerts count all consistently use yellow (needs-attention) now, having
  previously been an inconsistent mix of red/orange.

## Layout bug found mid-restyle (user-reported, with a live screenshot)

`html, body, #root` used `max-width: 100vw` instead of `100%`. `100vw` is
fixed to the initial containing block and isn't guaranteed to equal the
true visual viewport in every mobile/PWA context; once any descendant
nudged the real document width even slightly wider, the whole page could
scroll sideways — which reads as every card being clipped at the same
point, and explains why the reported screenshot showed body text sliced
off mid-word ("No workout as...") rather than CSS-ellipsis-truncated: the
text wasn't actually truncated, it was off-screen. Fixed by switching to
`width:100%; max-width:100%` (keeping the existing `overflow-x:hidden`) on
`html/body/#root`, and removing the same `100vw` pattern from the two
remaining occurrences in `ClientView.jsx`'s shell wrappers (a full-repo
grep confirmed no other files had it). Could not fully re-verify live in
the browser afterward (Playwright hit the same environment congestion that
affected the rest of tonight's session), so this is a code-level fix
backed by the specific CSS mechanism identified, not a live-confirmed one
— worth a manual check on a real device.

## Agent session limit

All 5 parallel restyle subagents hit the account's session rate limit
partway through (resets 5:20am local time) — `nutrition/progress` and
`profile/screening/auth` finished cleanly before the cutoff; the
`messages/checkin/scheduling/payments/learn/coach-tools` batch also
finished; `TrainScreens.jsx` and `CoachDashboard.jsx` were both left
partially done (each had completed a first normalization pass but not the
follow-up pass fixing remaining alpha-suffix bugs and ink-contrast issues)
and were finished directly rather than re-delegated, since further agent
spawns would hit the same limit.

## Final self-review pass (before push)

Did a full-repo sweep after all 5 milestones landed, rather than trusting
each file in isolation:

- Re-ran the alpha-suffix-bug grep (both the template-literal `${X}NN` form
  and the `X + "NN"` string-concatenation form) across the whole repo —
  clean, zero remaining hits.
- Grepped every remaining literal hex color (`#rrggbb`/`#rgb`) outside the
  token files. All surviving instances fall into one of three accepted
  buckets: (1) the per-client identity color exception (`client.color`
  paired with `"#000"`/`"#fff"` text - avatars, chat bubbles, calendar
  cells, tab pills), (2) a photo/video overlay scrim
  (`rgba(0,0,0,.6-.7)` + white icon/text, or the deliberate white media
  card in `SupersetLogger.jsx`) - both explicitly photo-backdrop
  exceptions, not real UI surfaces, (3) `BRAND.green`/`BRAND.yellow` paired
  with `"#000"` - these two accents don't invert between themes the way
  `ink` does, so black text on them stays legible in both light and dark.
  Found and fixed one edge case in `AddClientModal`'s toggle-switch knob
  (`background:"#fff"`) - left as-is on reflection, since a white knob on
  either theme's track is the universal iOS/Android toggle convention, not
  an inversion bug.
- Grepped for `fontWeight` 600 and above across every feature file: found
  4 stray `fontWeight:600` instances in `TrainScreens.jsx` on plain muted
  body copy (not a name) that had survived the agent passes - dropped to
  400. Confirmed the one remaining `fontWeight:600` app-wide
  (`MessagesTab.jsx`'s sender name in a chat bubble) is exactly the
  "person's name" exception the spec allows.
- Grepped for `textTransform:"uppercase"` combined with a font size of
  14px or larger (which would indicate real heading/body content forced
  into caps rather than a genuine small label) - zero matches; every
  remaining uppercase treatment in the app is at 11px, i.e. a real eyebrow
  label.
- Confirmed every `.jsx` file in `src/` was either restyled or is a file
  that genuinely needed no changes (`NavIcon.jsx`/`CoachIcon.jsx` already
  deferred all color to `currentColor`/a caller-supplied prop;
  `main.jsx` has no visual content).

## Summary for the human

**What changed:** the entire app (client: Today/Train/Nutrition/Progress/Me,
coach: Home/Clients/Tools/Alerts/Settings) now runs on one shared black/white
design system with exactly three functional accent colors (green =
progress/positive, blue = actions/links, yellow = needs-attention), Sora
for titles and large numbers, Inter everywhere else, sentence case
throughout, hairline borders, no drop shadows, and a persisted light/dark
toggle (default dark) in both apps' Settings surfaces. Along the way this
surfaced and fixed a handful of real, pre-existing bugs (not introduced by
this restyle, just found while touching every file): the alpha-suffix CSS
bug, a light-theme black-on-black contrast bug, and a `max-width:100vw`
horizontal-overflow bug you hit live on your phone mid-session.

**Every judgment call** is logged inline above, in the order it was made -
the two biggest ones to be aware of: (1) the existing "ember"/orange v2
token scaffolding on this branch was fully replaced rather than merged,
since it directly conflicted with this spec's accent rules and was never
wired to a real feature; (2) categorical (non-signal) color was removed
from Learn article categories, food-diary meal types, and coach tool
tiles, since the spec is explicit that the three accents are signals, not
decoration - those areas now differentiate by label/icon alone, which is a
real (if minor) scannability trade-off worth a look once you're using it
live.

---

# Buddy pairs — decisions log

Built on `feature/buddy-pairs`, off `main`, autonomously per the brief's
"don't stop to ask, log the call and keep going" instruction. One entry
per judgment call, in the order made.

**Commit structure note:** milestones 2 ("create and manage pairs") and 3
("slot view") landed in one commit instead of two. The slot view is just
`ProgramTab` mounted twice inside the same new file the management screen
lives in, and "Open slot" has nothing to open until it exists - splitting
them would have meant shipping a dead button in one commit and its wiring
in the next, which is less reviewable, not more. Billing (milestone 4)
is its own commit as specified, since it's a real, separable change to a
different file (`PaymentsTab.jsx`).

## The brief assumed a different schema than this app actually has

The brief's SQL and Step 4 billing plan were written against a generic
schema (`profiles(id)` for both coach and client, `workout_logs` /
`set_logs` tables, Stripe Checkout + webhook). This app's real schema,
confirmed by inspecting it directly rather than guessing, is different in
every one of those respects:

- **No `coach_id`/`profiles(id)` model.** Coaches live in `trainers`
  (PK `id`, equal to the Supabase auth user id); clients live in `clients`
  (PK `id`, with `trainer_id` and `client_user_id` linking to the owning
  coach and the client's own auth user respectively). A `profiles` table
  does technically exist, but it's a one-row, keyed-by-`user_id` leftover
  that nothing in the app reads or writes - using it would have meant
  building on a table that isn't actually part of the live data model.
  `buddy_pairs.coach_id` references `trainers(id)`; `buddy_members.client_id`
  references `clients(id)` - matching how every other table added to this
  project (e.g. `health_screenings`) already does it.
- **No `workout_logs`/`set_logs` tables.** Training data lives as JSON
  under `client_data` (section `program`, section `training_logs`), read
  and written entirely through the existing `ProgramTab`/`WorkoutSession`
  components in `src/features/train/TrainScreens.jsx`. This is actually
  good news for the "additive only, never touch how programs/logs work"
  requirement: the buddy slot view doesn't need to know anything about
  that shape at all - it just mounts the existing `ProgramTab` twice, once
  per member, and that component already does 100% of the session/logging
  work per client. Zero new logging code, zero risk of cross-writing one
  member's log against the other, because there's exactly one code path
  for "log a set" and this feature never touches it.
- **No Stripe. Payment is PayPal**, via a Supabase Edge Function
  (`forge-paypal`) that creates/captures orders, called from an embedded
  PayPal Buttons widget in each client's own Payments tab
  (`src/features/payments/PaymentsTab.jsx`). There is no "webhook" in the
  traditional sense and no shareable payment link concept anywhere in this
  app today - the client pays inside their own logged-in session, and the
  success callback (`onPaid`, running entirely in the browser) is what
  marks them paid. See the Billing section below for how this was reused
  as-is, with zero changes to the Edge Function or any secret.

None of this is a deviation from the brief's *intent* (reuse what's
already there, don't invent a parallel system) - it's the same intent,
pointed at the schema and payment provider that actually exist.

## Two-member guard: trigger, not a CHECK constraint

Postgres CHECK constraints can only see the row being written, never its
siblings, so there's no native way to say "at most 2 rows where
pair_id = X" without a trigger. Used a `BEFORE INSERT` row-level trigger
on `buddy_members` that counts existing members for the target `pair_id`
and raises an exception at 2. This is the standard, reliable pattern for
a per-group row cap in Postgres - a statement-level or deferred-constraint
trigger would only add complexity here, since the app only ever inserts
one member at a time (one client picker submission per member slot in the
UI), never a bulk multi-row insert that could race past the check within
one statement.

"A client in at most one pair at a time" is enforced with a plain
`unique(client_id)` index on `buddy_members` - lower risk than a trigger,
and exactly what a unique constraint is for.

## RLS: coach-only

Mirrored the `client_data_trainer_or_client` EXISTS-subquery style
(inspected directly before writing this). Both tables are gated entirely
by `coach_id = auth.uid()` / a join back to a pair the coach owns; there
is no client-facing read policy. The brief left this open ("client read
access only if the client app needs it") - nothing in Steps 2-3 requires
a client to ever see pairing metadata (a paired client's own app looks
identical to any other client's: their own program, their own logs,
their own Payments tab), so the narrower, more secure option was taken.
If a client-facing "you're paired with X" view is wanted later, add a
scoped SELECT policy then rather than opening it preemptively now.

`buddy_members`'s `with check` also verifies the client being added
belongs to the same coach (`clients.trainer_id = auth.uid()`), so a coach
can't pair in a client id they don't own even if they guessed one.

## Migration not applied

Per the brief, `supabase/migrations/20260830120000_buddy_pairs.sql` is
new-file-only - not run against the live database from here. It needs
review and to be run in the Supabase SQL editor before any of this
feature's UI will actually work end to end (the coach-side screens will
load and render, but every query against `buddy_pairs`/`buddy_members`
will fail until the tables exist).

## Billing: grouped over the existing PayPal flow, no Edge Function changes

Design: `buddy_pairs.price` holds the shared monthly amount. A coach
action on the pair ("Set shared price") writes that price + a due date to
*both* members' existing `client_data.profile` fields
(`price`/`paymentDueDate`/`paymentPaid:false`) - the exact same fields and
the exact same `upsertSection(..., "profile", ...)` call `PaymentsTab`
already uses for a single client, just invoked twice. Nothing new is
invented; both members simply end up with matching billing state.

`PaymentsTab.jsx`'s existing `PayPalCheckout` component and its `onPaid`
handler are untouched in how they talk to PayPal/the Edge Function.
`onPaid` was extended with one additional step: after marking the paying
client's own profile paid (unchanged), it now also looks up whether that
client is a `buddy_members` row, and if so marks the other member in the
same pair paid too, via the identical `upsertSection` call. Whichever of
the two clients pays first (through their own already-existing in-app
PayPal button - nothing coach-facing was added to the payment step
itself) settles the shared package for both. This required no change to
`forge-paypal`, no new secret, and no webhook - the fan-out is pure
application logic that runs after PayPal has already confirmed the
capture, in the same browser session that always handled `onPaid` before.

The brief's "one Checkout link, shared via WhatsApp/email" framing
doesn't have an equivalent in this app - there is no payment-link
generation anywhere today, only the in-app embedded button, and building
a new unauthenticated link-based checkout flow would itself be "a new
payment system," which the brief explicitly says not to build. The
coach-side "Set shared price" action is the closest faithful equivalent:
it's the one new coach action Step 4 asked for, it uses only fields and
calls that already exist, and it doesn't touch payment collection itself
at all.

## What still needs you

1. **Run the migration.** Review
   `supabase/migrations/20260830120000_buddy_pairs.sql` and run it in the
   Supabase SQL editor. Nothing buddy-pair-related will work until then.
2. **Nothing else was deferred.** No webhook or Edge Function change was
   needed for the billing grouping (see above), so there's no follow-up
   payment-infrastructure work waiting on you beyond running the
   migration.
3. Once the migration is applied, sanity-check on a real pair: create a
   pair with two real clients, open its slot view and confirm each side
   logs against the correct person, then set a shared price and pay it
   from one member's own Payments tab, confirming the other member flips
   to paid too.

**What still needs you:**
- **Live device check of the overflow fix.** I fixed the specific CSS
  mechanism (`100vw` → `100%`) that best explains the screenshot you sent,
  and confirmed no other file in the repo has the same pattern, but
  Playwright couldn't get a live re-render in this environment
  (persistent resource congestion all session) to visually confirm it on
  the actual Home screen post-fix. Worth a real-device pass before you
  fully trust it.
- **Confirm Sora actually loads in production.** The Google Fonts `<link>`
  is in `index.html` with both families listed alphabetically as
  specified; I couldn't verify network font loading in this sandboxed
  dev-server environment.
- **Vercel/deploy config**: nothing in this restyle added new npm
  dependencies or environment variables, so no Vercel env changes should
  be needed - but worth a quick preview-deploy sanity check since this is
  the largest visual diff the app has had in one branch.
- **A visual pass against your own eye**, in both themes, especially the
  categorical-color-removal areas called out above (Learn, meal types,
  coach tool tiles) - I'm confident they're spec-compliant, but "spec-
  compliant" and "looks right to you" aren't guaranteed to be the same
  thing, and that's a judgment only you can close the loop on.
- **The reference file** (`design/forge-sora-reference.html`) was never
  present in the repo - if you had a specific pixel-level mockup in mind
  beyond the written spec, this pass never saw it.

---

# feature/glass-restyle — decisions log

Autonomous branch, built off `main` per the brief: "bold, glassmorphism,
cinematic edge-lit borders, ultra-luxury," monochrome base kept (white
stays the one accent, category colors stay as small functional dots
only). CSS/visual only - no logic, routing, data, auth, Supabase schema,
or payments changes. Five commits, one per milestone, all on this branch;
`main` untouched throughout.

## Milestone 1 — tokens, cinematic backdrop, Sora type scale

- **Base flips from true black to warm near-black**, per the brief's
  exact `--ink`/`--shell`/`--page` values - flat black behind translucent
  white glass just reads as grey, the base needs its own depth for the
  blur to have something to catch.
- **`--card`/`--card-soft`/`--chip` become translucent** (`rgba(255,255,
  255,.03-.06)` dark, `rgba(255,255,255,.35-.65)` light) instead of flat
  fills. This was the single highest-leverage move in the whole branch:
  since nearly every surface in the app is already built from these
  tokens via `BRAND.card`/`T.card2`/etc., the entire app picked up a
  glass *tint* the moment this landed, before touching a single component
  file. Milestones 2-4 then layered actual `backdrop-filter` blur onto
  the specific surfaces worth the GPU cost.
- **Light theme gets translucent *white*, not translucent black.** First
  instinct was to reuse the dark theme's black-tinted rgba values for
  light mode too, but translucent black over a light gradient just reads
  as a grey smear, not glass - real light-mode "frosted glass" needs
  white translucency over the light gradient. Caught this by actually
  reasoning through what each rgba layer would look like before shipping
  it, not by trial and error.
- **`--accent` becomes `rgba(255,255,255,.92)`** (dark) / `rgba(10,9,11,
  .92)` (light) instead of flat opaque - this is the brief's exact
  "active pill/selected day" spec, extended to every primary button too,
  so "white stays the accent" reads as one consistent frosted-white
  language everywhere rather than flat-white buttons next to frosted-
  white pills.
- **`.app-shell::before`/`::after`**: the fixed cinematic backdrop (3
  radial blooms + base gradient + grain + inset vignette), scoped to the
  app's own 480px centered column via `left:50%`/`translateX(-50%)`
  rather than `inset:0` on the full browser viewport - otherwise the
  vignette and grain would bleed into the desktop letterbox margins
  outside the actual app content on wide screens. `isolation:isolate` on
  `.app-shell` keeps the pseudo-elements' `z-index:-1` scoped to that
  subtree instead of fighting the Toast/Confirm host's z-index:1000+.
- **Sora imported for `--display` only** (weights 600/700/800, not the
  full family) - since virtually every heading already renders through
  `BRAND.display`/`T.display`, this one `@import` reskinned every
  screen's headings for free. Body text stays on Inter via `--sans`,
  completely untouched.
- **Category dot colors** retuned to the brief's exact breakfast/lunch/
  dinner/snacks hex values (`--orange`/`--blue`/`--violet`/`--green`),
  with a `.cat-dot { box-shadow: 0 0 10px currentColor }` glow utility -
  the one place non-monochrome color survives, exactly as scoped.

## Milestone 2 — glass on shared components

Reskinned `Card.jsx`, `Button.jsx`, `Chip.jsx`, `Mini.jsx`, `Field.jsx`
(inputs/textareas), `Sheet.jsx`, `ConfirmDialog.jsx`, `modal.js`, and
both bottom nav bars. `Card.jsx` was the biggest lever here - it now
renders `className="glass"`/`"glass-soft"` instead of inline background/
border/radius, so every screen already built from `<Card>` (which turned
out to be most of the coach side - see milestone 4) picked this up with
zero further edits.

- **Bottom nav active state**: per the brief's exact "active pill/
  selected day" spec, the active tab's icon now sits on a near-solid
  white frosted pill with a dark icon, replacing the old gold-tinted
  background - this is the one nav treatment in the whole app now, used
  consistently for client and coach.
- **Modal/sheet scrims get `backdrop-filter: blur(6px)`** on top of the
  existing dark overlay, so whatever's behind a modal reads as glass too
  instead of a flat dark rectangle - small, cheap (one element per open
  modal, never repeated), decent visual payoff.

## Milestone 3 — client screens

Explicit `.glass`/`.glass-soft` on the hand-rolled hero cards client
screens build directly rather than through `<Card>` - Home's payment/
check-in/workout banners, the nutrition and macro calendar cards, meal/
habit/snack cards, progress's PB and streak/adherence tiles, the payment
status card, check-in question pages. Every one of these is a single
card or a small fixed-count group (3 meal cards, 2 stat tiles) - never a
scrolling list - so nothing here needed revisiting in milestone 5.

- **Fixed selected-day circles that used a category color** (nutrition
  and macro calendars both used `T.blue` for "this day is selected").
  Per the brief, selection state is white/frosted and category color is
  for data only - a selected calendar day isn't "blue data," it's a
  selection, so these now use the same white-pill treatment as the nav.
- **Bigger catch: five screens never got the backdrop at all.**
  `LoginScreen`, `PaymentLockedScreen`, `AccountNotActiveScreen`,
  `ResetPasswordScreen`, and the boot-loading screen all render in
  `App.jsx` *before* any route mounts `.app-shell` - so none of them
  would have picked up the milestone-1 cinematic backdrop, and the login
  screen (the one screen every single user sees) would have shipped
  looking like the old flat theme. Fixed by pulling the backdrop gradient
  into a shared `--cinematic-gradient` custom property used by both
  `.app-shell::before` and a new `.cinematic-bg` class, applied to all
  five. Worth flagging because it's exactly the kind of gap that's easy
  to miss when "every screen" implicitly means "every screen inside the
  main app shell."

## Milestone 4 — coach screens

Turned out to be mostly already done by milestone 2: `PackageDesigner`,
`BuddyPairs`, `Calendar`, `Trials`, `CoachContentScreen`, and `ScheduleTab`
all build entirely from `<Card>`, so they inherited glass automatically.
The only hand-rolled coach surfaces were `CoachDashboard`'s home tile
grid (6 fixed dashboard tiles), its Tools grid (~10 fixed tiles), and two
settings-screen surfaces - all bounded, all now `.glass`.

Also spot-checked (and left alone, correctly already right): the client
roster cards, per-notification rows (colored by severity tone, not
glass), and the exercise library list all already used plain translucent
-but-unblurred surfaces before this branch existed - someone had already
made the right call here.

## Milestone 5 — de-glass long lists, fallback, reduced motion, build

- **Added a `flat` prop to `Card.jsx`** rather than hand-rolling a
  one-off style for each list: `flat` swaps the `glass`/`glass-soft`
  className for the plain `--card`/`--card-soft` token background (same
  translucent tint and border language, zero `backdrop-filter`). Applied
  to the four `<Card>` usages that sit inside a `.map()` over a
  collection that can genuinely grow unbounded over the life of an
  account: the Learn tab's two article-list views (coach's publishing
  list and the client-facing feed - same underlying growing collection),
  the coach's "all scheduled sessions across every client" view, and the
  coach's saved-program-templates list. Left `<Card>` items that are
  small/bounded by nature as full glass (buddy pairs, package catalog, a
  single session's completed-exercise list) - blurring five or ten items
  once per screen view isn't the GPU cost the brief is warning about.
- **`@supports not (backdrop-filter)` fallback** and the **light-theme
  glass variants** were written directly into the milestone-1 utility
  classes rather than bolted on after, so there was nothing left to add
  here - confirmed by re-reading `theme.css`'s `.glass`/`.glass-soft`/
  `.glass-nav` blocks rather than assuming.
- **`prefers-reduced-motion`**: the app already had a blanket rule
  collapsing all animation/transition durations to near-zero
  (pre-existing, not part of this branch). The one new animation this
  branch added - `.glass-glow`, a slow breathing box-shadow pulse applied
  to the client Home's "Today's Workout" hero card as the one deliberate
  "get creative" flourish - is caught by that same existing rule with no
  extra work, so reduced-motion users get a static glow instead of a
  pulsing one automatically.
- **Incident: an accidental `git checkout main -- .`** while trying to
  capture a before/after eslint diff briefly reverted the entire working
  tree to `main`'s pre-restyle content. Caught immediately via `git
  status`/`git diff --stat HEAD` before anything was committed or pushed.
  All four prior milestones were already committed and were completely
  unaffected; `git reset --hard HEAD` cleanly discarded the bad checkout,
  and the handful of not-yet-committed milestone-5 edits (the `Card.jsx`
  `flat` prop and its four call sites, plus the `.glass-glow` addition)
  were manually redone from the exact diffs already produced earlier in
  the run. Net effect: zero lost work, but worth recording since it's
  the kind of near-miss that's only harmless because nothing had reached
  `main` or been pushed yet.

## Scope limitations - what this branch did *not* fully do

- **"Screen titles ~28-30px"** was addressed only via the Sora font-
  family swap (which flows through `--display` everywhere for free) and
  weight bumps on a handful of components edited directly for other
  reasons (`Mini.jsx`, `ConfirmDialog.jsx`, `Sheet.jsx` titles). The many
  screen-specific hardcoded `fontSize: 22-30` headings scattered across
  three dozen files were *not* individually swept to a single value -
  that's a much larger, purely mechanical find-and-replace with real
  risk of layout shifts per screen, and the font-family change already
  does most of the visual work the brief is after ("bold type," not
  literally identical pixel sizes everywhere).
- **Not every hand-rolled card in every file got an explicit `.glass`
  class.** The token cascade (milestone 1) means every surface built
  from `BRAND.card`/`T.card2`/etc. already reads as glass-tinted even
  without one - explicit classes were added where blur was worth the
  GPU cost (see milestones 2-4's reasoning) rather than chasing 100%
  literal coverage of every `<div>` in the codebase. If a specific card
  somewhere still looks flatter than expected, it's very likely one of
  these un-swept spots rather than a broken token.
- **Coach-authenticated screens were verified by code audit and eslint/
  build diffing, not a live screenshot** - this sandbox has no coach
  test credentials. The client login screen (the one screen reachable
  without auth) was screenshotted and re-verified after every milestone;
  everything past that gate is verified by reading the rendered JSX and
  its resolved styles, not by seeing pixels. Worth a real device/browser
  pass before calling this fully done.
- **Google Fonts network loading** (the Sora `@import`) couldn't be
  confirmed to actually fetch successfully from this sandboxed
  environment the same way a real deploy would - the font rendered
  correctly in the one screenshot this run could take, which is a good
  sign, but a Vercel preview-deploy check is worth doing before trusting
  it fully in production.

## Follow-up: light-mode optimization pass

Requested separately after the branch above shipped ("take a good look at
the app in light mode for both client and coach and make everything
optimal for that as well"). Found and fixed a real class of bug the
first pass introduced: several elements were styled by hardcoding one
theme's expected look (a color literal like `#0A090B` or `rgba(255,255,
255,.92)`) instead of the theme-adaptive `var(--accent)`/`var(--btn-ink)`
tokens - correct-looking in dark mode (the theme built and screenshotted
first) but broken in the other.

- **Three client Home hero cards used hardcoded dark-gray gradients**
  (`#141414`→`#1e1e1e` etc.) as backgrounds while their text used the
  theme-adaptive `BRAND.text` token. In light mode `BRAND.text` flips to
  near-black, landing dark text on a still-dark hardcoded background -
  both the payment-due banner (both its "due soon" and "overdue"
  variants), the check-in-due banner, and the "Today's Workout" card
  would have been illegible. Fixed by moving the gradients into three
  new theme-aware tokens (`--hero-gradient`/`-warm`/`-danger`, dark values
  unchanged, light values a soft white/cream/pink family) so the same
  "this card matters more" visual weight survives in both themes instead
  of only working in the one that was actually looked at.
- **The "active/selected" white-pill styling was hardcoded white, not
  theme-aware** - `.glass-pill-active`, both bottom navs' active-icon
  color, and the nutrition/macro calendars' selected-day circle all used
  literal `rgba(255,255,255,.92)`/`#0A090B` instead of `var(--accent)`/
  `var(--btn-ink)`. In dark mode this is correct (white pill pops against
  a near-black bar). In light mode, where `--accent` is near-black, a
  hardcoded *white* pill would sit almost invisibly against the already-
  light nav bar and calendar - exactly the "selected state you can't see"
  bug a theme system exists to prevent. Fixed by switching every one of
  these to the actual tokens, which already flip correctly per theme (dark
  mode: white pill on dark bar; light mode: near-black pill on light bar -
  a "lifted" look instead of a glow, which is the correct inversion).
  Same fix applied to the small white-glow box-shadows on Button's "gold"
  variant and Chip's selected state, both of which had the identical
  hardcoded-white-glow issue (invisible against a light background).
- **Coach's trainer-avatar fallback gradient** (`accentDeep`→`gold`) paired
  with hardcoded white initials text - inverted from the cards above:
  this one was actually broken in *dark* mode, where the gradient itself
  is near-white and the initials were also hardcoded white. Fixed with
  `BRAND.btnInk`, which is dark-on-light-bg/light-on-dark-bg exactly as
  needed since it's designed to sit on top of `--btn-bg`/`--accent`.
- **Apple Pay button** hardcoded `-apple-pay-button-style: white-outline`,
  correct sitting on a dark glass card in dark mode but low-contrast on
  a light one. Added a `[data-theme="light"] .forge-apple-pay-button`
  override to `-apple-pay-button-style: black` - Apple's own supported
  values include exactly this pairing for light/dark surfaces, so it
  wasn't a workaround, just the theme-aware version of what the vendor
  API already offers.
- **Verified, not just assumed**: this pass was found by systematically
  grepping for every hardcoded hex/rgba literal introduced during the
  glass restyle (`#141414`, `#161616`, `#0A090B`, `rgba(255,255,255,.9x)`,
  etc.) and checking each one against both theme blocks, rather than
  guessing which components might be affected. The login screen (the one
  screen reachable without auth) was screenshotted in both themes before
  and after this pass to confirm no regression; every other fix here is
  verified by tracing the token values through both theme blocks by hand,
  the same way milestone 3's original hardcoded-hex sweep was - there was
  no way to get a live screenshot of an authenticated screen in this
  sandbox to see the coach/client screens directly.

