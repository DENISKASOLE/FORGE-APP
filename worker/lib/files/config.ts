// Limits for /api/files. Every number here exists to keep R2 usage well
// inside Cloudflare's free tier (sow.md §4): 10 GB-month storage,
// 1M Class A and 10M Class B operations per month.
import type { Env } from "../env";

export const ALLOWED_BUCKETS = ["client-photos", "screening-documents"] as const;
export type Bucket = (typeof ALLOWED_BUCKETS)[number];

export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export const R2_FREE_TIER_BYTES = 10 * 1024 ** 3; // 10 GB-month
export const MAX_SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_SIGNED_URL_SECONDS = 3600;

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_SOFT_CAP_BYTES = 8 * 1024 ** 3;
const DEFAULT_USER_DAILY_UPLOADS = 200;
// 3,000/day x 31 days = 93k Class A writes/month, under 10% of the 1M free ops.
const DEFAULT_GLOBAL_DAILY_UPLOADS = 3000;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export interface FileLimits {
  maxUploadBytes: number;
  softCapBytes: number;
  userDailyUploads: number;
  globalDailyUploads: number;
}

export function fileLimits(env: Env): FileLimits {
  return {
    maxUploadBytes: positiveInt(env.MAX_UPLOAD_BYTES, DEFAULT_MAX_UPLOAD_BYTES),
    // Never allow the soft cap to be configured above the free tier.
    softCapBytes: Math.min(positiveInt(env.R2_SOFT_CAP_BYTES, DEFAULT_SOFT_CAP_BYTES), R2_FREE_TIER_BYTES),
    userDailyUploads: positiveInt(env.FILE_USER_DAILY_UPLOADS, DEFAULT_USER_DAILY_UPLOADS),
    globalDailyUploads: positiveInt(env.FILE_GLOBAL_DAILY_UPLOADS, DEFAULT_GLOBAL_DAILY_UPLOADS),
  };
}
