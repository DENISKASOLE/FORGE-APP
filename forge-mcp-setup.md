# forge-mcp setup

A remote MCP server exposing your Forge coaching data to Claude (claude.ai → Settings → Connectors). Read-only tools for clients/check-ins/payments, plus two write tools for creating/editing a client's program or nutrition plan. Already deployed and live at:

```
https://app.forgeperformance.online/mcp
```

That's the URL to use as the connector URL in Claude - not the raw `*.supabase.co` one. Supabase only ever routes `/functions/v1/<name>/*` to an Edge Function; nothing can live at a project's bare domain root. Claude's connector OAuth flow needs `/authorize`, `/token`, `/register` and the `.well-known` discovery docs reachable at a true root, so those (plus the MCP endpoint itself, at `/mcp`) are reverse-proxied from the app's own Vercel domain straight through to the same Supabase function - see the `rewrites` added to `vercel.json`. Nothing about the app's actual routes or pages changed, only a handful of proxy rules.

## How it works (short version)

- The actual logic lives in one Edge Function: `supabase/functions/forge-mcp/`. Nothing in the existing app (App.jsx, tables, other functions) was touched - `vercel.json` only gained reverse-proxy rewrites for a handful of specific OAuth/MCP paths.
- Auth is a small, self-built OAuth 2.0 Authorization Code + PKCE layer wrapping Supabase Auth's normal email/password login (`oauth.ts`) - not Supabase's native MCP-OAuth, which would have required switching your whole project's JWT signing algorithm and adding a consent page to the live app. Nothing about your existing Auth settings changed.
- When you connect, you log in with your real coach email/password on a page this function serves itself. That password goes straight to Supabase Auth - never through Claude, never stored anywhere.
- The access token Claude ends up holding is literally your own Supabase JWT. Every tool call runs through Supabase using that JWT, so Row Level Security - not this code - is what actually restricts every query to your own clients. The service role key is never used anywhere in this function.
- Only an account with a row in `trainers` can connect. A client account that somehow tried would be rejected at login, before any token is ever issued.

## One-time setup already done

```bash
supabase link --project-ref rjzfyfgymkcaffazzpff
supabase secrets set MCP_SIGNING_SECRET=<random value>
supabase functions deploy forge-mcp
```

`MCP_SIGNING_SECRET` is a random string this function uses to sign the short-lived (2 minute) login code - it's already set as a project secret. `SUPABASE_URL`/`SUPABASE_ANON_KEY` are provided automatically by the platform, nothing to set there.

**No Supabase Auth dashboard settings need to change** - that's the point of the self-built shim.

### Redeploying after a code change

```bash
supabase functions deploy forge-mcp
```

That's it - `verify_jwt = false` (needed because this function checks auth itself, see `supabase/config.toml`) is picked up automatically from the deploy, confirmed live.

## Add it to Claude

1. claude.ai → **Settings → Connectors → Add custom connector**
2. URL: `https://app.forgeperformance.online/mcp`
3. Click **Connect** - a browser tab opens showing a "Connect Claude to Forge" login page (served by this function, not claude.ai). Sign in with your coach email/password.
4. You're redirected back and the connector shows as connected.
5. Try asking Claude something like "list my clients" or "who needs attention right now" in a new chat.

If you ever want to disconnect, remove it from the same Connectors page - this revokes nothing server-side (there's no persistent session to revoke; Claude just stops sending a token).

## Tools available now (v1)

**Read-only:**
- `list_clients` - name, type, payment status for every client
- `search_clients(query)` - find a client by name/email
- `get_client_overview(client_id)` - check-in, program week, recent workouts, best lifts, payment status
- `get_checkins(client_id, since?)` - full check-in history
- `who_needs_attention` - flags no check-in 7+ days, overdue payment, pain/injury flags, inactivity
- `get_program(client_id)` - full current training program
- `get_nutrition_plan(client_id)` - current live plan + any draft

**Write:**
- `save_program(client_id, program)` - creates or completely replaces a client's program. **Goes live immediately**, same as clicking Save in the Program Builder - there's no draft tier for programs. Ask Claude to `get_program` first when editing, not starting fresh.
- `update_nutrition_plan(client_id, meals, targets?, from?, publish?)` - writes a new plan version. **Defaults to a draft** (invisible to the client until published in-app); pass `publish: true` to go live immediately. Ask Claude to `get_nutrition_plan` first when editing.

## Known simplifications (not bugs, just scope)

- `get_client_overview`'s "best lifts" is a simplified PB readout (best logged set per exercise), not the in-app's full chronological PB-detection algorithm (`detectSessionPBs`), which also distinguishes "new PB" from "best ever."
- Any "today" computed inside the function (e.g. default effective-dates) uses UTC, since Edge Functions have no local timezone. Only matters right at the UTC midnight boundary (4am Dubai) - pass an explicit date if that ever matters.
- The login code is single-secret-signed with a 2-minute expiry but no replay-nonce store (would need a new table). Low risk for a single-coach tool over HTTPS, but worth knowing.

## Suggested v2 write tools (not built)

- `send_message(client_id, text)` - post into the client's in-app message thread
- `publish_article(title, body)` - add to the coach's Learn/articles library
- `draft_program_block(client_id, instruction)` - thinner version of `save_program` that proposes a swap/addition without replacing the whole program (mirrors the in-app AI assistant's "suggest swaps" pattern)

## Housekeeping

The Supabase personal access token used to run the deploy from this session was scoped to this project only - delete it from supabase.com/dashboard/account/tokens once you're done testing, no reason to leave it around.
