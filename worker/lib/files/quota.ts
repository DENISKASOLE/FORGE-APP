// Daily upload counters (per user and global) that cap R2 Class A writes.
import { HttpError } from "../http";
import type { FileLimits } from "./config";

export const GLOBAL_COUNTER_ID = "*";

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// Increments both counters in one D1 round trip and throws 429 when either
// is over its limit. Every accepted attempt counts, including ones that later
// fail, which errs on the side of fewer R2 writes.
export async function consumeUploadQuota(db: D1Database, userId: string, limits: FileLimits, day = utcDay()): Promise<void> {
  const bump = db.prepare(
    `INSERT INTO file_upload_counts (user_id, day, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
     RETURNING count`,
  );
  const [user, global] = await db.batch<{ count: number }>([bump.bind(userId, day), bump.bind(GLOBAL_COUNTER_ID, day)]);
  const userCount = Number(user.results?.[0]?.count ?? 0);
  const globalCount = Number(global.results?.[0]?.count ?? 0);
  if (userCount > limits.userDailyUploads) {
    throw new HttpError(429, `Daily upload limit reached (${limits.userDailyUploads} per day). Please try again tomorrow.`, "upload_limit");
  }
  if (globalCount > limits.globalDailyUploads) {
    throw new HttpError(429, "Uploads are paused for today to stay within the free storage plan. Please try again tomorrow.", "upload_limit");
  }
}
