// files:<bucket> steps: recursively list a Supabase Storage bucket and copy
// each object to R2 under `<bucket>/<path>`. Objects already in R2 with the
// same size are skipped, so re-runs only move what changed.
//
// The cursor carries a queue of folder prefixes still to list and the
// position inside the current listing, so a call can stop anywhere (budget
// exhausted mid-page) and the next call resumes at the exact entry.
import { headObject, putObject } from "../files/store";
import { clampPageSize, parseJsonCursor } from "./cursor";
import { logSet } from "./log";
import type { StorageEntry } from "./supabase";
import type { StepContext, StepInput, StepResult } from "./types";
import { nowIso } from "../http";

export const BUCKETS = ["client-photos", "screening-documents"] as const;
export type BucketName = (typeof BUCKETS)[number];

export const LIST_DEFAULT_PAGE = 100;
export const LIST_MAX_PAGE = 1000;
/** Worst case per object: R2 head + Supabase download + R2 put + a D1 write inside putObject. */
// head + download + putObject (usage read, R2 put, file_objects upsert).
export const FILE_COST = 5;
const PLACEHOLDER = ".emptyFolderPlaceholder";

export interface FilesCursor {
  q: string[]; // folder prefixes still to list
  cur: { p: string; o: number } | null; // listing in progress: prefix + offset
  seen: number;
  copied: number;
  skipped: number;
  bytes: number;
}

function isFilesCursor(v: unknown): v is FilesCursor {
  const c = v as FilesCursor;
  return (
    !!c && Array.isArray(c.q) && c.q.every((p) => typeof p === "string") &&
    (c.cur === null || (typeof c.cur?.p === "string" && Number.isInteger(c.cur?.o) && c.cur.o >= 0)) &&
    [c.seen, c.copied, c.skipped, c.bytes].every((x) => Number.isInteger(x) && x >= 0)
  );
}

const fresh = (): FilesCursor => ({ q: [], cur: { p: "", o: 0 }, seen: 0, copied: 0, skipped: 0, bytes: 0 });

async function copyObject(
  ctx: StepContext,
  bucket: string,
  path: string,
  entry: StorageEntry,
  state: FilesCursor,
  warnings: string[],
): Promise<void> {
  const { env, sb, budget } = ctx;
  const size = typeof entry.metadata?.size === "number" ? entry.metadata.size : null;
  state.seen += 1;
  state.bytes += size ?? 0;

  budget.use(1);
  const existing = await headObject(env, bucket, path);
  if (existing && size != null && existing.size === size) {
    state.skipped += 1;
    return;
  }

  const res = await sb.download(bucket, path); // budget counted inside
  if (!res || !res.body) {
    warnings.push(`${bucket}/${path}: listed but could not be downloaded (deleted in v1 meanwhile?)`);
    return;
  }
  const length = size ?? Number(res.headers.get("Content-Length") ?? 0);
  const contentType = entry.metadata?.mimetype || res.headers.get("Content-Type") || "application/octet-stream";
  budget.use(3);
  await putObject(env, bucket, path, res.body, contentType, length, null);
  state.copied += 1;
}

export async function runFilesStep(ctx: StepContext, bucket: BucketName, input: StepInput): Promise<StepResult> {
  const { sb, budget } = ctx;
  const limit = clampPageSize(input.pageSize, LIST_DEFAULT_PAGE, LIST_MAX_PAGE);
  const state = parseJsonCursor(input.cursor, fresh(), isFilesCursor);
  const warnings: string[] = [];
  const before = state.copied + state.skipped;
  let done = false;

  // Reserve one subrequest for the migration_log write when the pass ends.
  while (budget.canAfford(1 + FILE_COST + 1)) {
    if (!state.cur) {
      const next = state.q.shift();
      if (next === undefined) {
        done = true;
        break;
      }
      state.cur = { p: next, o: 0 };
    }
    const cur = state.cur;
    const entries = await sb.listObjects(bucket, cur.p, limit, cur.o);
    let i = 0;
    for (; i < entries.length; i++) {
      const e = entries[i];
      const full = cur.p ? `${cur.p}/${e.name}` : e.name;
      if (e.id == null) {
        state.q.push(full);
        continue;
      }
      if (e.name === PLACEHOLDER) continue;
      if (!budget.canAfford(FILE_COST + 1)) break;
      await copyObject(ctx, bucket, full, e, state, warnings);
    }
    if (i < entries.length) {
      cur.o += i; // budget ran out mid-page: resume at entry i
      break;
    }
    if (entries.length < limit) state.cur = null;
    else cur.o += entries.length;
  }

  if (!done && !state.cur && state.q.length === 0) done = true;
  const step = `files:${bucket}`;
  if (done) {
    await logSet(ctx.env.DB, budget, `bucketcount:${bucket}`, { objects: state.seen, bytes: state.bytes, at: nowIso() });
  }
  return {
    step,
    done,
    nextCursor: done ? null : JSON.stringify(state),
    processed: state.copied + state.skipped - before,
    warnings,
    details: { seen: state.seen, copied: state.copied, skipped: state.skipped, bytes: state.bytes, pendingFolders: state.q.length },
  };
}
