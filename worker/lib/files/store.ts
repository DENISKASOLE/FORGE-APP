// R2 object storage plus the file_objects ledger (migrations/0004_files.sql)
// that enforces the free-tier soft cap. putObject/headObject are also the
// contract used by the migrate agent (they skip the per-user daily cap).
import type { Env } from "../env";
import { HttpError, nowIso } from "../http";
import { fileLimits, R2_FREE_TIER_BYTES } from "./config";
import { objectKey, validateTarget } from "./paths";

export interface FileUsage {
  totalBytes: number;
  totalObjects: number;
}

export interface UsageWithExisting extends FileUsage {
  existingSize: number | null;
}

export async function readUsage(db: D1Database, key: string): Promise<UsageWithExisting> {
  const row = await db
    .prepare(
      `SELECT u.total_bytes AS total_bytes, u.total_objects AS total_objects,
              (SELECT size FROM file_objects WHERE key = ?) AS existing_size
         FROM file_usage u WHERE u.id = 1`,
    )
    .bind(key)
    .first<{ total_bytes: number; total_objects: number; existing_size: number | null }>();
  return {
    totalBytes: Number(row?.total_bytes ?? 0),
    totalObjects: Number(row?.total_objects ?? 0),
    existingSize: row?.existing_size ?? null,
  };
}

export function assertWithinCap(softCapBytes: number, usage: UsageWithExisting, newSize: number): void {
  const projected = usage.totalBytes - (usage.existingSize ?? 0) + newSize;
  if (projected > softCapBytes) {
    throw new HttpError(
      507,
      "Photo storage is full for now. Please delete some old photos or files, or ask your coach to free up space.",
      "storage_full",
    );
  }
}

export function usageSummary(usage: FileUsage, softCapBytes: number) {
  const pct = (n: number, d: number) => Math.round((n / d) * 10000) / 100;
  return {
    totalBytes: usage.totalBytes,
    totalObjects: usage.totalObjects,
    softCapBytes,
    freeTierBytes: R2_FREE_TIER_BYTES,
    percentOfFreeTier: pct(usage.totalBytes, R2_FREE_TIER_BYTES),
    percentOfSoftCap: pct(usage.totalBytes, softCapBytes),
  };
}

// Counts bytes as they stream and errors past `limit`. When the runtime
// provides FixedLengthStream (Workers), the result also has the known length
// R2 needs and errors if the body is shorter or longer than declared.
export function limitStream(body: ReadableStream, declared: number, limit: number): ReadableStream {
  let seen = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > declared || seen > limit) {
        controller.error(new HttpError(413, "File is larger than the upload limit.", "too_large"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  const counted = body.pipeThrough(counter);
  const Fixed = (globalThis as { FixedLengthStream?: typeof FixedLengthStream }).FixedLengthStream;
  if (!Fixed) return counted;
  const fixed = new Fixed(declared);
  counted.pipeTo(fixed.writable).catch(() => { /* surfaced by the R2 put */ });
  return fixed.readable;
}

// Writes to R2 then records the ledger row. Callers must already have run
// the access and cap checks.
export async function writeAndRecord(
  env: Env,
  key: string,
  body: ReadableStream | ArrayBuffer,
  contentType: string,
  size: number,
  ownerUserId: string | null,
): Promise<void> {
  const payload = body instanceof ArrayBuffer ? body : limitStream(body, size, size);
  let result: R2Object | null;
  try {
    result = await env.FILES.put(key, payload, {
      httpMetadata: { contentType },
      customMetadata: ownerUserId ? { owner: ownerUserId } : undefined,
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error("R2 put failed", key, err);
    throw new HttpError(502, "Upload failed. Please try again.", "upload_failed");
  }
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO file_objects (key, size, content_type, owner_user_id, etag, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET size = excluded.size, content_type = excluded.content_type,
       owner_user_id = excluded.owner_user_id, etag = excluded.etag, updated_at = excluded.updated_at`,
  )
    .bind(key, result?.size ?? size, contentType, ownerUserId, result?.httpEtag ?? null, now, now)
    .run();
}

export async function putObject(
  env: Env,
  bucket: string,
  path: string,
  body: ReadableStream | ArrayBuffer,
  contentType: string,
  size: number,
  ownerUserId: string | null = null,
): Promise<void> {
  const target = validateTarget(bucket, path);
  if (!Number.isInteger(size) || size < 0) throw new HttpError(400, "Invalid file size", "invalid_size");
  if (body instanceof ArrayBuffer && body.byteLength !== size) {
    throw new HttpError(400, "File size does not match body", "invalid_size");
  }
  const key = objectKey(target.bucket, target.path);
  const usage = await readUsage(env.DB, key);
  assertWithinCap(fileLimits(env).softCapBytes, usage, size);
  await writeAndRecord(env, key, body, contentType, size, ownerUserId);
}

export async function headObject(env: Env, bucket: string, path: string): Promise<{ size: number } | null> {
  const target = validateTarget(bucket, path);
  const head = await env.FILES.head(objectKey(target.bucket, target.path));
  return head ? { size: head.size } : null;
}

export async function deleteObject(env: Env, key: string): Promise<void> {
  await env.FILES.delete(key);
  await env.DB.prepare("DELETE FROM file_objects WHERE key = ?").bind(key).run();
}

export async function storedEtag(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT etag FROM file_objects WHERE key = ?").bind(key).first<{ etag: string | null }>();
  return row?.etag ?? null;
}
