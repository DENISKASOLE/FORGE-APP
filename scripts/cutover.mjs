#!/usr/bin/env node
// Forge v1 (Supabase) -> v2 (Cloudflare) migration driver. Node 24, no deps.
// Runbook: docs/cloudflare/CUTOVER.md
//
//   FORGE_URL=https://forge.<acct>.workers.dev MIGRATION_ADMIN_TOKEN=... \
//     node scripts/cutover.mjs [--steps=a,b] [--rehearsal] [--send-emails] [--fresh]
//                              [--page-size=N] [--force-prune]
//
// Calls POST /api/admin/migrate/<step> over and over until each step says
// done. Every call is small (Workers Free: 10 ms CPU, 50 subrequests), and
// every step is idempotent, so this can be re-run any number of times.
import { createInterface } from "node:readline/promises";
import { stdin, stdout, exit, env, argv } from "node:process";

const ALL_STEPS = [
  "trainers", "clients", "client_data", "trainer_data", "health_screenings",
  "buddy_pairs", "buddy_members", "exercise_library", "users",
  "files:client-photos", "files:screening-documents", "prune", "verify", "send-password-setup",
];
const EMAIL_STEP = "send-password-setup";
const RESET_CONFIRM = "WIPE D1 APP DATA";
const MAX_ATTEMPTS = 7;
const MAX_CALLS_PER_STEP = 20000;
const RETRYABLE = new Set([429, 500, 503, 504]);
// Page sizes the Worker uses by default; halved when a call dies (usually
// the 10 ms CPU limit on a page of big client_data rows).
const DEFAULT_PAGE = { client_data: 5, "files:client-photos": 100, "files:screening-documents": 100, "send-password-setup": 8 };
const PAGED = new Set(ALL_STEPS.filter((s) => !["prune", "verify"].includes(s)));

function parseArgs(args) {
  const opts = { steps: null, rehearsal: false, sendEmails: false, fresh: false, pageSize: null, forcePrune: false, help: false };
  for (const a of args) {
    if (a === "--rehearsal") opts.rehearsal = true;
    else if (a === "--send-emails") opts.sendEmails = true;
    else if (a === "--fresh") opts.fresh = true;
    else if (a === "--force-prune") opts.forcePrune = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a.startsWith("--steps=")) opts.steps = a.slice(8).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--page-size=")) opts.pageSize = Number(a.slice(12));
    else throw new Error(`Unknown option: ${a}`);
  }
  if (opts.pageSize != null && !(Number.isInteger(opts.pageSize) && opts.pageSize > 0)) {
    throw new Error("--page-size must be a positive integer");
  }
  return opts;
}

function planSteps(opts) {
  if (opts.rehearsal && opts.sendEmails) throw new Error("--send-emails cannot be combined with --rehearsal");
  let steps = opts.steps ?? ALL_STEPS.filter((s) => s !== EMAIL_STEP);
  const unknown = steps.filter((s) => !ALL_STEPS.includes(s));
  if (unknown.length) throw new Error(`Unknown step(s): ${unknown.join(", ")}. Valid: ${ALL_STEPS.join(", ")}`);
  if (steps.includes(EMAIL_STEP) && !opts.sendEmails) {
    throw new Error(`${EMAIL_STEP} only runs with --send-emails`);
  }
  if (opts.sendEmails && !steps.includes(EMAIL_STEP)) steps = [...steps, EMAIL_STEP];
  // Keep the canonical (foreign-key) order whatever order was typed.
  return ALL_STEPS.filter((s) => steps.includes(s));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(base, token, path, body) {
  const res = await fetch(`${base}/api/admin/migrate/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** One call with retry/backoff. Returns the step result or throws. */
async function callWithRetry(base, token, step, body, onRetry) {
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let status = 0;
    let json = null;
    try {
      ({ status, json } = await post(base, token, step, body));
    } catch (err) {
      lastError = `network error: ${err.message}`;
    }
    if (status === 200 && json?.data) return json.data;
    if (status && !RETRYABLE.has(status)) {
      throw new Error(`${step}: HTTP ${status} ${json?.error?.message ?? ""}`.trim());
    }
    if (status) lastError = `HTTP ${status} ${json?.error?.message ?? ""}`.trim();
    const wait = Math.min(30000, 1000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
    body = onRetry(status, body);
    console.log(`  ! ${step}: ${lastError}; retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(wait / 1000)}s`);
    if (attempt < MAX_ATTEMPTS) await sleep(wait);
  }
  throw new Error(`${step}: giving up after ${MAX_ATTEMPTS} attempts (${lastError})`);
}

async function runStep(base, token, step, opts, allWarnings) {
  let cursor = null;
  let total = 0;
  let pageSize = opts.pageSize ?? DEFAULT_PAGE[step] ?? null;
  const started = Date.now();
  let last = null;
  for (let calls = 1; calls <= MAX_CALLS_PER_STEP; calls++) {
    const body = { cursor };
    if (pageSize && PAGED.has(step)) body.pageSize = pageSize;
    if (step === "prune" && opts.forcePrune) body.force = true;
    last = await callWithRetry(base, token, step, body, (status, b) => {
      // A 500/503 from the Worker itself often means the CPU limit: shrink the page.
      if ((status === 500 || status === 503 || status === 0) && b.pageSize && b.pageSize > 1) {
        pageSize = Math.max(1, Math.floor(b.pageSize / 2));
        console.log(`  ! ${step}: lowering page size to ${pageSize}`);
        return { ...b, pageSize };
      }
      return b;
    });
    total += last.processed;
    for (const w of last.warnings ?? []) allWarnings.add(w);
    const extra = last.details && step.startsWith("files:")
      ? ` (copied ${last.details.copied}, unchanged ${last.details.skipped}, folders queued ${last.details.pendingFolders})`
      : "";
    stdout.write(`  ${step}: +${last.processed} (total ${total})${extra}\n`);
    if (last.done) break;
    if (last.nextCursor == null && step !== EMAIL_STEP) throw new Error(`${step}: not done but no cursor returned`);
    cursor = last.nextCursor;
  }
  if (!last?.done) throw new Error(`${step}: did not finish after ${MAX_CALLS_PER_STEP} calls`);
  console.log(`✓ ${step} done: ${total} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return last;
}

function printVerify(details) {
  if (!details?.rows) return;
  const rows = details.rows.map((r) => [r.name, String(r.source ?? "?"), String(r.target), r.ok ? "OK" : "MISMATCH", r.note ?? ""]);
  const head = ["name", "v1 (source)", "v2 (target)", "status", "note"];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log("\nVerify:");
  console.log(line(head));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(line(r));
}

async function confirmFresh() {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      "\n--fresh deletes ALL migrated app data in v2 (clients, programs, screenings...).\n" +
        "Users, payments and uploaded files are kept. Type YES to continue: ",
    );
    return answer.trim() === "YES";
  } finally {
    rl.close();
  }
}

async function main() {
  const opts = parseArgs(argv.slice(2));
  if (opts.help) {
    console.log(readUsage());
    return 0;
  }
  const base = (env.FORGE_URL ?? "").replace(/\/+$/, "");
  const token = env.MIGRATION_ADMIN_TOKEN ?? "";
  if (!/^https?:\/\//.test(base)) throw new Error("Set FORGE_URL, e.g. FORGE_URL=https://forge.<account>.workers.dev");
  if (token.length < 32) throw new Error("Set MIGRATION_ADMIN_TOKEN (the same value as the Worker secret, 32+ chars)");
  const steps = planSteps(opts);

  console.log(`${opts.rehearsal ? "REHEARSAL" : "MIGRATION"} against ${base}`);
  console.log(`Steps: ${steps.join(" → ")}\n`);

  if (opts.fresh) {
    if (!stdin.isTTY) throw new Error("--fresh needs an interactive terminal to confirm");
    if (!(await confirmFresh())) {
      console.log("Cancelled.");
      return 1;
    }
    const data = await callWithRetry(base, token, "reset-app-data", { confirm: RESET_CONFIRM }, (_s, b) => b);
    console.log("Wiped:", JSON.stringify(data.deleted), "\n");
  }

  const warnings = new Set();
  let verify = null;
  for (const step of steps) {
    const last = await runStep(base, token, step, opts, warnings);
    if (step === "verify") verify = last.details;
    if (step === EMAIL_STEP && last.details) {
      const d = last.details;
      console.log(`  emails: sent today ${d.sentToday}/${d.dailyMax}, still to send ${d.remaining}`);
    }
  }

  if (warnings.size) {
    console.log(`\nWarnings (${warnings.size}):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  printVerify(verify);
  if (verify && !verify.ok) {
    console.log("\n✗ Verify found mismatches (see above).");
    return 2;
  }
  console.log(`\n✓ ${opts.rehearsal ? "Rehearsal" : "Migration"} finished.`);
  return 0;
}

function readUsage() {
  return [
    "Usage: FORGE_URL=https://forge.<acct>.workers.dev MIGRATION_ADMIN_TOKEN=... node scripts/cutover.mjs [options]",
    "  --steps=a,b     only these steps (in canonical order)",
    "  --rehearsal     label the run as a rehearsal (never sends emails)",
    "  --send-emails   also run send-password-setup (cutover day only)",
    "  --fresh         wipe migrated app data in v2 first (asks you to type YES)",
    "  --page-size=N   override the page size for paged steps",
    "  --force-prune   let prune delete more than half of a table",
    `Steps: ${ALL_STEPS.join(", ")}`,
  ].join("\n");
}

main().then(
  (code) => exit(code),
  (err) => {
    console.error(`\n✗ ${err.message}`);
    exit(1);
  },
);
