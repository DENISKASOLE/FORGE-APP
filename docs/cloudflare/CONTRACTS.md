# Forge v2 on Cloudflare: build contracts

Shared rules for everyone working on the migration (see `../../../sow.md`).

## Hard constraints
- **Free plan only.** Only Workers Free features: Workers, Static Assets, D1, R2 (free allowance), KV, Rate Limiting binding. No Queues, no Email Sending, no Durable Objects billing features, no Workers AI. Keep every request under **10 ms CPU** and **50 subrequests**.
- **v1 stays live** (Vercel + Supabase) until cutover. Nothing here may write to Supabase. Reading Supabase is only allowed from `/api/admin/migrate` (the cutover route).
- Feature files under `src/features/**` should not change. The frontend keeps calling `supabase.*` from `src/supabaseClient.js`, which is now a shim. Change a feature file only if the shim truly can't cover a call, and say why in your report.
- Plain JS in `src/`, TypeScript in `worker/`. Hono for routing. Match existing style.

## Layout and ownership
| Area | Worker files | Frontend files | D1 migration |
|---|---|---|---|
| Foundation (done) | `worker/index.ts`, `worker/lib/{env,http}.ts` | `src/supabaseClient.js`, `src/lib/forge/http.js` | `0001_core.sql` |
| **auth** | `worker/routes/auth.ts`, `worker/lib/session.ts`, `worker/lib/auth/*` | `src/lib/forge/auth.js` | `0002_auth.sql` |
| **db** | `worker/routes/db.ts`, `worker/lib/policies.ts`, `worker/lib/db/*` | `src/lib/forge/db.js` | `0003_db.sql` (only if needed) |
| **files** | `worker/routes/files.ts`, `worker/lib/files/*` | `src/lib/forge/storage.js` | `0004_files.sql` |
| **services** | `worker/routes/{ai,food,pay}.ts`, `worker/lib/services/*` | `src/lib/forge/functions.js`, PWA files (`src/main.jsx` sw registration, `vite.config.js`, `public/_headers`, delete `public/sw.js`, `vercel.json`, `public/_redirects`) | `0005_payments.sql` |
| **migrate** | `worker/routes/admin.ts`, `worker/lib/migrate/*` | `scripts/cutover.mjs` | none |

Don't edit another area's files. If you need something from another area, code against the contract below.

## Contracts
- **Response envelope:** success is `{ data: ... }`; failure is `{ error: { message, code } }` with a proper HTTP status (use `fail()`/`HttpError` from `worker/lib/http.ts`). `src/lib/forge/http.js#api()` turns this into `{ data, error }`.
- **Current user:** `requireUser` middleware and `loadUser(c)` from `worker/lib/session.ts` give `AuthUser { id, email, email_verified, user_metadata }`. The session is the `forge_session` HttpOnly cookie. Every route except auth sign-in/sign-up/reset and `/api/health` must use `requireUser`.
- **User ids:** migrated users keep their Supabase `auth.users.id`, so `clients.client_user_id` and `trainers.id` stay valid.
- **Roles:** a caller is the *coach* for a client row when `clients.trainer_id = user.id`, and is *that client* when `clients.client_user_id = user.id`. Trainer rows exist only for the coach (`COACH_EMAIL`).
- **Storage keys in R2:** `<bucket>/<path>`, e.g. `client-photos/clients/<clientId>/progress/x.jpg` and `screening-documents/<clientId>/<screeningId>/x.pdf`. The app stores the bare `<path>`, and the shim adds the bucket.
- **Rate limiting:** `c.env.AI_LIMITER.limit({ key: user.id })`, `AUTH_LIMITER` keyed by IP + email, `API_LIMITER` keyed by user id for general data routes. Return 429 when `success` is false.

## Local dev
`npm run build && npx wrangler dev` (secrets go in `.dev.vars`). `npx wrangler d1 migrations apply forge-db --local`. Tests: `npm test` (Vitest).
