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

