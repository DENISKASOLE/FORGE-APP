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

(Further entries appended as the restyle proceeds through client and coach screens.)
