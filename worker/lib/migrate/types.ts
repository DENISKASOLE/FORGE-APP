// Shared types for the cutover route (/api/admin/migrate). See
// docs/cloudflare/CUTOVER.md for the operator runbook.
import type { Env } from "../env";
import type { Budget } from "./budget";
import type { SupabaseReader } from "./supabase";

export interface StepInput {
  cursor: string | null;
  pageSize?: number;
  /** prune only: allow deleting more than half of a table's rows. */
  force?: boolean;
}

export interface StepResult {
  step: string;
  done: boolean;
  nextCursor: string | null;
  processed: number;
  warnings: string[];
  /** Step-specific extras (verify table, email counts, file stats). */
  details?: unknown;
}

export interface StepContext {
  env: Env;
  /** Origin of the incoming request, used for links in emails. */
  origin: string;
  budget: Budget;
  sb: SupabaseReader;
}

export type Row = Record<string, unknown>;
