# Cutover runbook: moving Forge from v1 (Supabase) to v2 (Cloudflare)

This guide is for the app owner. You don't need database experience: each step gives you the exact command to run and tells you what you should see.

## How it works, in one paragraph

v1 (Vercel + Supabase) keeps running for real users until cutover day. v2 runs on Cloudflare. A hidden admin route in v2 (`/api/admin/migrate`) **copies** everything from Supabase into Cloudflare: clients, programs, check-ins, screenings, buddy pairs, the exercise library, user accounts and uploaded photos and PDFs. It only ever **reads** from Supabase, so v1 is never changed. The copy works in many small pieces (a limit of Cloudflare's free plan), and the script `scripts/cutover.mjs` sends those pieces one after another until the copy is finished. Every step is safe to repeat: running it again brings v2 up to date with v1 and never creates duplicates. You can **rehearse as often as you like** before cutover day, and on the day you run the same thing one last time.

What does **not** carry over: passwords. Supabase stores them in a format the Cloudflare Worker can't check, so on cutover day every user gets a "set your password" email.

---

## 1. One-time setup (prerequisites)

Run these from the `FORGE-APP` folder. `npx wrangler` asks you to log in to Cloudflare the first time.

1. **Apply the database tables** (this is safe to run again):
   ```sh
   npx wrangler d1 migrations apply forge-db --remote
   ```
2. **Set the secrets.** Each command prompts you to paste a value, which is never shown or stored in git.

   | Secret | Where to get it |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → `service_role` key. It can read everything, so treat it like a password. |
   | `MIGRATION_ADMIN_TOKEN` | Make one up; it must be **at least 32 characters**. Generate one with `openssl rand -hex 32`. Keep a copy, because the script needs it. |
   | `RESEND_API_KEY` | Resend dashboard → API keys (sends the password emails). |
   | `FILE_URL_SECRET` | Make one up: `openssl rand -hex 32` (signs photo links). |
   | `GEMINI_API_KEY`, `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | The same values v1 uses today. |

   ```sh
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put MIGRATION_ADMIN_TOKEN
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put FILE_URL_SECRET
   # ...and the others in the table
   ```
3. **Switch the migration route on.** It is off by default: while it is off, `/api/admin/*` answers "not found" to everyone. In `wrangler.jsonc`, under `"vars"`, change
   ```jsonc
   "MIGRATION_ENABLED": "false",
   ```
   to `"true"`, then deploy:
   ```sh
   npm run cf:deploy
   ```
   Check that `SUPABASE_URL` in the same file is `https://rjzfyfgymkcaffazzpff.supabase.co`.
4. **Save two values in your terminal** for the commands below (replace the placeholders):
   ```sh
   export FORGE_URL=https://forge.<your-account>.workers.dev
   export MIGRATION_ADMIN_TOKEN=<the token you made in step 2>
   ```

## 2. Rehearsal (repeat on any day while v1 is live)

A rehearsal copies v1's current data into v2 so you can click around v2 and check that everything is there. Real users are not affected, and nobody gets an email.

```sh
node scripts/cutover.mjs --rehearsal
```

What you'll see:
- a line per piece of work, for example `clients: +50 (total 150)`;
- a `✓ <step> done` line when each step finishes;
- a list of **warnings**, if there are any (see "Reading warnings" below);
- a **Verify** table comparing how many rows and files v1 has with how many v2 has. Every line should say `OK`.

The script ends with `✓ Rehearsal finished.` (exit code 0). If verify finds a difference it prints `✗ Verify found mismatches` and exits with code 2. If something breaks it prints `✗ <reason>` and exits with code 1. In both cases it is safe to run again.

A rehearsal takes minutes: most time goes on copying photos the first time. Later runs skip photos that are already in v2.

**Log in to v2 during a rehearsal?** Migrated users have no password in v2 yet. To test as yourself, use "Forgot password" on v2 with your own email, or add yourself with a test account. Don't run `--send-emails` for a rehearsal.

Useful variations:
- Run only some steps: `node scripts/cutover.mjs --steps=clients,client_data,verify`
- Start v2 from empty again (it asks you to type `YES`): `node scripts/cutover.mjs --rehearsal --fresh`. This wipes the copied app data in v2. It does **not** delete user accounts, payments or uploaded files, and it refuses once v2 has real payments.

### Reading warnings

| Warning says | What it means / what to do |
|---|---|
| `v1 column "x" has no D1 column and was dropped` | v1 has a field v2 doesn't store. Tell the developer before cutover. (For clients and the exercise library, extra fields are kept automatically in an `extra` field, so there's no warning for those.) |
| `a value is over D1's 2 MB limit; row skipped` | One client's section is too big for v2, usually old photos stored inside the data. The developer needs to move those photos to storage in v1, then re-run. |
| `already belongs to a different v2 account` | Someone created a v2 account with the same email. Decide which account to keep. |
| `prune <table>: N of M rows are missing in v1; skipped as a safety check` | More than half a table would be deleted in v2. If that is really expected, run `node scripts/cutover.mjs --steps=prune --force-prune`. |
| `bucket:… extra in R2` (verify note) | Files deleted in v1 after they were copied. Harmless. |

### The steps, in order

| Step | Copies | Default piece size |
|---|---|---|
| `trainers`, `clients` | coach and client records | 50 rows |
| `client_data` | each client's program, logs, nutrition, check-ins… (large) | 5 rows |
| `trainer_data`, `health_screenings`, `buddy_pairs`, `buddy_members`, `exercise_library` | the rest of the app data | 50 rows |
| `users` | login accounts (email, name, role, "email verified"), **without passwords** | 50 users |
| `files:client-photos`, `files:screening-documents` | photos and PDFs → Cloudflare R2 (skips files already copied with the same size) | 100 listing entries, up to ~9 file copies per call |
| `prune` | removes from v2 anything deleted in v1 since the last run (never payments, never an account that has set a v2 password) | one table per call |
| `verify` | the count comparison table | one call |
| `send-password-setup` | the "set your password" emails (**only with `--send-emails`**) | 8 emails per call |

If a call fails because a piece was too heavy (Cloudflare's free-plan time limit), the script automatically retries with a smaller piece size.

## 3. Cutover day

Allow about an hour. Pick a quiet time.

1. **The day before, announce it** to your clients: "Forge is moving to a new address on <date> at <time>. Please don't use the app for about 30 minutes from <time>. You'll get an email to set a new password."
2. **Do a final rehearsal that morning** (`node scripts/cutover.mjs --rehearsal`), so the real run only has a few changes left to copy and you know everything works.
3. **At the start time, tell users to stop using v1** (for example with a message in your client group chat). Wait a couple of minutes for anyone mid-save to finish.
4. **Run the real migration:**
   ```sh
   node scripts/cutover.mjs
   ```
   Check that the Verify table is all `OK`. If it isn't, run the same command again: it only copies what's missing. If a mismatch keeps coming back, stop here and see "Rollback" (v1 is untouched).
5. **Log in to v2 yourself** (use "Forgot password" with your coach email) and spot-check two or three clients: their program, recent logs, photos and screening PDF.
6. **Send the password-setup emails:**
   ```sh
   node scripts/cutover.mjs --steps=send-password-setup --send-emails
   ```
   The end of the output shows `emails: sent today X/90, still to send Y`. If `Y` is more than 0 you hit the daily email limit (see the note below): run the same command again tomorrow. Nobody ever gets the email twice.
7. **Share the new address** with your clients: `https://forge.<your-account>.workers.dev` (or your custom domain). Remind them to use the email link to set a password, and to reinstall the home-screen app from the new address.
8. **Keep v1 as a read-only fallback for 2 weeks.** Don't delete the Supabase project or the Vercel site yet. Ask users not to use the old address. After 2 weeks with no problems, take a final Supabase backup and pause the project (see sow.md, Phase 6).

## 4. After cutover: switch the migration route off

Once the emails have gone out and v2 is working:

1. In `wrangler.jsonc`, set `"MIGRATION_ENABLED": "false"` and deploy with `npm run cf:deploy`. `/api/admin/*` goes back to "not found".
2. Remove the secrets that are no longer needed:
   ```sh
   npx wrangler secret delete SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret delete MIGRATION_ADMIN_TOKEN
   ```
   (If you still need to send leftover password emails on a later day, keep `MIGRATION_ADMIN_TOKEN` and the route switched on until that's done. The email step doesn't need the Supabase key.)

**Don't** run the migration again after users have started working in v2. It would overwrite their v2 changes to clients and programs with the old v1 data (it never touches passwords or payments).

## 5. Rollback

v1 is never modified by the migration, so rolling back only means sending people back to it.

- **Before you've shared the new address:** just stop. Tell users v1 is back and carry on as before. Try again another day: the rehearsal and cutover commands are the same.
- **After users have started on v2 (within the 2-week window):** tell users to go back to the old address and log in with their **old** password (v1 passwords never changed). Anything they did in v2 since cutover won't appear in v1. The developer can export it from D1 (`npx wrangler d1 export forge-db --remote --output v2-backup.sql`) if it needs to be re-entered.
- To try the cutover again later, repeat section 3. Add `--fresh` for a clean copy (only before v2 has any real payments).

## 6. Free-tier note on email volume

The Resend free plan allows **100 emails per day** (and 3,000 per month). That total also covers the app's own emails (password resets, invites), so the migration stops at **90 per day** by default and tells you how many are left. With about 50 users, everything goes out on the first day. For more users than that, run the email command once a day until `still to send` is 0. To change the cap, set `MIGRATION_EMAIL_DAILY_MAX` in `wrangler.jsonc` `vars` (for example `"40"`) and redeploy. The day resets at midnight UTC.

## Reference

- API: `POST /api/admin/migrate/<step>` with body `{"cursor": null, "pageSize": 5}` returns `{"data": {"step", "done", "nextCursor", "processed", "warnings", "details"}}`. Pass back `nextCursor` until `done` is true. `GET /api/admin/migrate` lists the steps and each one's last run. `POST /api/admin/migrate/reset-app-data` with `{"confirm": "WIPE D1 APP DATA"}` wipes the migrated app tables.
- Every call needs `Authorization: Bearer $MIGRATION_ADMIN_TOKEN` and fails with 404 while `MIGRATION_ENABLED` isn't `"true"`.
- Progress is recorded in the D1 table `migration_log`: the last run of each step, which users were emailed, and the last verify result.
