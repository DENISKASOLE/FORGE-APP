// Step registry and dispatcher for POST /api/admin/migrate/:step.
import type { Env } from "../env";
import { HttpError, nowIso } from "../http";
import { Budget } from "./budget";
import { BUCKETS, type BucketName, runFilesStep } from "./files";
import { logSetStatement } from "./log";
import { runPruneStep } from "./prune";
import { SupabaseReader } from "./supabase";
import { TABLE_NAMES, runTableStep, tableSpec } from "./tables";
import type { StepContext, StepInput, StepResult } from "./types";
import { runUsersStep } from "./users";
import { runVerifyStep } from "./verify";
import { runSendPasswordSetupStep } from "./emails";

/** FK order. The driver script runs them in this order. */
export const STEPS = [
  ...TABLE_NAMES,
  "users",
  ...BUCKETS.map((b) => `files:${b}`),
  "prune",
  "verify",
  "send-password-setup",
] as const;

export function isStep(name: string): boolean {
  return (STEPS as readonly string[]).includes(name);
}

async function dispatch(step: string, ctx: StepContext, input: StepInput): Promise<StepResult> {
  const spec = tableSpec(step);
  if (spec) return runTableStep(ctx, spec, input);
  if (step === "users") return runUsersStep(ctx, input);
  if (step.startsWith("files:")) return runFilesStep(ctx, step.slice(6) as BucketName, input);
  if (step === "prune") return runPruneStep(ctx, input);
  if (step === "verify") return runVerifyStep(ctx);
  if (step === "send-password-setup") return runSendPasswordSetupStep(ctx, input);
  throw new HttpError(404, `Unknown step "${step}"`, "unknown_step");
}

export async function runStep(env: Env, origin: string, step: string, input: StepInput): Promise<StepResult> {
  if (!isStep(step)) throw new HttpError(404, `Unknown step "${step}"`, "unknown_step");
  const budget = new Budget();
  budget.use(1); // reserved for the step:<name> log write below
  // Supabase is only required by steps that read it (not send-password-setup).
  let sb: SupabaseReader | null = null;
  const ctx: StepContext = {
    env,
    origin,
    budget,
    get sb() {
      return (sb ??= SupabaseReader.fromEnv(env, budget));
    },
  };
  const result = await dispatch(step, ctx, input);
  await logSetStatement(env.DB, `step:${step}`, {
    at: nowIso(),
    done: result.done,
    processed: result.processed,
    nextCursor: result.nextCursor,
    warnings: result.warnings.length,
  }).run();
  return result;
}
