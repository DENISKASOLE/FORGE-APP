# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Deploying the `forge-ai` Edge Function

Every AI feature in this app (nutrition reports, the coach assistant, body-analysis reads, the nutrition-plan Extras estimate and AI refine, etc.) shares one Supabase Edge Function, action-routed via `{action, ...body}` — see `supabase/functions/forge-ai/index.ts`. There is no per-feature function and no per-feature secret; adding a new AI action never needs a new deploy config, only a new `if (action === "...")` block and a redeploy.

```
supabase secrets set GEMINI_API_KEY=...
# optional, defaults to a current Gemini model if unset:
supabase secrets set GEMINI_MODEL=gemini-3.6-flash

supabase functions deploy forge-ai
```

The Gemini API key never reaches the browser — every AI call goes through `supabase.functions.invoke("forge-ai", ...)` from `src/lib/ai.js`'s `callForgeAI`, and Supabase's platform verifies the caller's JWT before the function runs (default behavior for `functions deploy`; nothing extra to configure). No server-side per-user rate limiting is implemented yet for any action — the 429/503 retry+backoff in `geminiRequest()` protects against Gemini's own free-tier rate limit, not against one user calling too often.
