import { describe, it, expect } from "vitest";
import { validatePath, validateTarget, targetFromPathname } from "../../worker/lib/files/paths";
import { canAccess, type FileAction } from "../../worker/lib/files/access";
import { createSignedUrl, verifySignedUrl, clampExpiresIn, timingSafeEqual } from "../../worker/lib/files/sign";
import { assertWithinCap, putObject, headObject, readUsage, deleteObject } from "../../worker/lib/files/store";
import { consumeUploadQuota } from "../../worker/lib/files/quota";
import { fileLimits } from "../../worker/lib/files/config";
import { makeEnv, makeD1, seed, SECRET } from "./helpers";

const status = async (p: Promise<unknown>) => p.then(() => 0, (e: { status?: number }) => e.status ?? -1);
const statusSync = (fn: () => unknown) => { try { fn(); return 0; } catch (e) { return (e as { status?: number }).status ?? -1; } };

describe("path validation", () => {
  it("accepts app-generated paths", () => {
    expect(validatePath("clients/c1/progress/1700000000000_ab12cd.jpg")).toHaveLength(4);
    expect(validatePath("c1/scr-1/signature.png")).toEqual(["c1", "scr-1", "signature.png"]);
  });

  it.each([
    "..", "../x", "a/../b", "a/./b", "/a", "a/", "a//b", "a\\b", "", ".hidden", "a b", "a/%2e%2e",
    "x".repeat(600), "a/b/c/d/e/f/g/h/i",
  ])("rejects %j", (p) => {
    expect(statusSync(() => validatePath(p))).toBe(400);
  });

  it("rejects unknown buckets and non-string paths", () => {
    expect(statusSync(() => validateTarget("avatars", "clients/c1/x.jpg"))).toBe(400);
    expect(statusSync(() => validateTarget("client-photos", 42))).toBe(400);
  });

  it("parses and decodes the request pathname", () => {
    const t = targetFromPathname("/api/files/object/client-photos/clients/c1/p/x.jpg", "object");
    expect(t).toMatchObject({ bucket: "client-photos", path: "clients/c1/p/x.jpg" });
    expect(statusSync(() => targetFromPathname("/api/files/object/client-photos/clients/%2e%2e/x", "object"))).toBe(400);
    expect(statusSync(() => targetFromPathname("/api/files/object/client-photos/clients/..%2Fc2/x", "object"))).toBe(400);
    expect(statusSync(() => targetFromPathname("/api/files/object/client-photos/a%5Cb/x", "object"))).toBe(400);
    expect(statusSync(() => targetFromPathname("/api/files/object/nope/a/b", "object"))).toBe(400);
    expect(statusSync(() => targetFromPathname("/api/files/object/client-photos/%E0%A4%A", "object"))).toBe(400);
  });
});

describe("access matrix (mirrors v1 storage policies)", () => {
  const { d1, sqlite } = makeD1();
  seed(sqlite);
  const can = (uid: string, bucket: "client-photos" | "screening-documents", path: string, action: FileAction) =>
    canAccess(d1, uid, bucket, path.split("/"), action);
  const ALL: FileAction[] = ["read", "insert", "update", "delete"];

  it.each([
    ["user-c1", true, "the client themself"],
    ["coach-1", true, "their own coach"],
    ["user-c2", false, "another client of the same coach"],
    ["coach-2", false, "another coach"],
    ["stranger", false, "a stranger"],
  ])("client-photos/clients/c1: %s -> %s (%s)", async (uid, expected) => {
    for (const action of ALL) expect(await can(uid, "client-photos", "clients/c1/progress/x.jpg", action)).toBe(expected);
  });

  it("client-photos: v1 also lets any signed-in user touch a client with no trainer", async () => {
    for (const action of ALL) expect(await can("stranger", "client-photos", "clients/c3/x.jpg", action)).toBe(true);
  });

  it("client-photos/trainers/{id}: only that trainer reads or writes", async () => {
    for (const action of ALL) {
      expect(await can("coach-1", "client-photos", "trainers/coach-1/profile/x.jpg", action)).toBe(true);
      expect(await can("user-c1", "client-photos", "trainers/coach-1/profile/x.jpg", action)).toBe(false);
      expect(await can("coach-2", "client-photos", "trainers/coach-1/profile/x.jpg", action)).toBe(false);
      expect(await can("stranger", "client-photos", "trainers/coach-1/profile/x.jpg", action)).toBe(false);
    }
  });

  it("client-photos: denies ids without a file below them, unknown clients and other prefixes", async () => {
    expect(await can("user-c1", "client-photos", "clients/c1", "read")).toBe(false);
    expect(await can("coach-1", "client-photos", "trainers/coach-1", "insert")).toBe(false);
    expect(await can("coach-1", "client-photos", "clients/missing/x.jpg", "read")).toBe(false);
    expect(await can("user-c1", "client-photos", "c1/progress/x.jpg", "read")).toBe(false);
    expect(await can("", "client-photos", "trainers//x.jpg", "read")).toBe(false);
  });

  it("screening-documents: client inserts; client or own coach reads; nobody updates or deletes", async () => {
    const p = "c1/scr-1/signature.png";
    expect(await can("user-c1", "screening-documents", p, "insert")).toBe(true);
    expect(await can("coach-1", "screening-documents", p, "insert")).toBe(false);
    expect(await can("user-c2", "screening-documents", p, "insert")).toBe(false);
    expect(await can("stranger", "screening-documents", p, "insert")).toBe(false);

    expect(await can("user-c1", "screening-documents", p, "read")).toBe(true);
    expect(await can("coach-1", "screening-documents", p, "read")).toBe(true);
    expect(await can("user-c2", "screening-documents", p, "read")).toBe(false);
    expect(await can("coach-2", "screening-documents", p, "read")).toBe(false);
    expect(await can("stranger", "screening-documents", p, "read")).toBe(false);
    // No trainer_id-is-null loophole for screenings (v1 didn't have one).
    expect(await can("stranger", "screening-documents", "c3/s/x.pdf", "read")).toBe(false);

    for (const uid of ["user-c1", "coach-1"]) {
      expect(await can(uid, "screening-documents", p, "update")).toBe(false);
      expect(await can(uid, "screening-documents", p, "delete")).toBe(false);
    }
    expect(await can("user-c1", "screening-documents", "c1", "read")).toBe(false);
  });
});

describe("signed URLs", () => {
  const now = 1_800_000_000;
  const path = "clients/c1/progress/x y.jpg".replace(" ", "_");

  it("creates a same-origin URL that verifies", async () => {
    const { signedUrl, exp } = await createSignedUrl(SECRET, "client-photos", path, 3600, now);
    expect(exp).toBe(now + 3600);
    const url = new URL(signedUrl, "http://x");
    expect(url.pathname).toBe(`/api/files/raw/client-photos/${path}`);
    const remaining = await verifySignedUrl(SECRET, "client-photos", path, url.searchParams.get("exp")!, url.searchParams.get("sig")!, now + 10);
    expect(remaining).toBe(3590);
  });

  it("rejects expiry, tampering, the wrong secret and malformed input", async () => {
    const { signedUrl } = await createSignedUrl(SECRET, "client-photos", path, 60, now);
    const q = new URL(signedUrl, "http://x").searchParams;
    const exp = q.get("exp")!;
    const sig = q.get("sig")!;
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(await status(verifySignedUrl(SECRET, "client-photos", path, exp, sig, now + 60))).toBe(403);
    expect(await status(verifySignedUrl(SECRET, "client-photos", path, exp, flipped, now))).toBe(403);
    expect(await status(verifySignedUrl(SECRET, "client-photos", "clients/c2/progress/x.jpg", exp, sig, now))).toBe(403);
    expect(await status(verifySignedUrl(SECRET, "screening-documents", path, exp, sig, now))).toBe(403);
    expect(await status(verifySignedUrl(SECRET, "client-photos", path, String(Number(exp) + 1000), sig, now))).toBe(403);
    expect(await status(verifySignedUrl(SECRET + "x", "client-photos", path, exp, sig, now))).toBe(403);
    expect(await status(verifySignedUrl(SECRET, "client-photos", path, undefined, sig, now))).toBe(403);
    expect(await status(verifySignedUrl(SECRET, "client-photos", path, exp, "zz", now))).toBe(403);
  });

  it("caps expiresIn at 7 days and requires a configured secret", async () => {
    expect(clampExpiresIn(undefined)).toBe(3600);
    expect(clampExpiresIn(30 * 24 * 3600)).toBe(7 * 24 * 3600);
    expect(statusSync(() => clampExpiresIn(-1))).toBe(400);
    expect(statusSync(() => clampExpiresIn("abc"))).toBe(400);
    expect(await status(createSignedUrl(undefined, "client-photos", path, 60))).toBe(500);
    expect(await status(createSignedUrl("short", "client-photos", path, 60))).toBe(500);
  });

  it("timingSafeEqual compares whole strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("free-tier guard", () => {
  const bytes = (n: number) => new Uint8Array(n).buffer;

  it("assertWithinCap counts the replaced object and rejects with 507", () => {
    expect(statusSync(() => assertWithinCap(100, { totalBytes: 90, totalObjects: 1, existingSize: null }, 10))).toBe(0);
    expect(statusSync(() => assertWithinCap(100, { totalBytes: 90, totalObjects: 1, existingSize: null }, 11))).toBe(507);
    expect(statusSync(() => assertWithinCap(100, { totalBytes: 100, totalObjects: 1, existingSize: 50 }, 50))).toBe(0);
  });

  it("putObject keeps the running total in sync on insert, overwrite and delete", async () => {
    const { env } = makeEnv();
    await putObject(env, "client-photos", "clients/c1/a/1.jpg", bytes(1000), "image/jpeg", 1000, "user-c1");
    await putObject(env, "client-photos", "clients/c1/a/2.jpg", bytes(500), "image/jpeg", 500);
    expect(await readUsage((env as { DB: D1Database }).DB, "")).toMatchObject({ totalBytes: 1500, totalObjects: 2 });
    await putObject(env, "client-photos", "clients/c1/a/1.jpg", bytes(200), "image/jpeg", 200);
    expect(await readUsage((env as { DB: D1Database }).DB, "")).toMatchObject({ totalBytes: 700, totalObjects: 2 });
    await deleteObject(env, "client-photos/clients/c1/a/2.jpg");
    expect(await readUsage((env as { DB: D1Database }).DB, "")).toMatchObject({ totalBytes: 200, totalObjects: 1 });
    expect(await headObject(env, "client-photos", "clients/c1/a/1.jpg")).toEqual({ size: 200 });
    expect(await headObject(env, "client-photos", "clients/c1/a/2.jpg")).toBeNull();
  });

  it("putObject refuses to pass the soft cap (4096 in tests) and writes nothing", async () => {
    const { env, r2 } = makeEnv();
    await putObject(env, "client-photos", "clients/c1/a/1.jpg", bytes(4000), "image/jpeg", 4000);
    expect(await status(putObject(env, "client-photos", "clients/c1/a/2.jpg", bytes(100), "image/jpeg", 100))).toBe(507);
    expect(r2.objects.has("client-photos/clients/c1/a/2.jpg")).toBe(false);
    expect(await status(putObject(env, "client-photos", "../x", bytes(1), "image/jpeg", 1))).toBe(400);
    expect(await status(putObject(env, "client-photos", "clients/c1/a/3.jpg", bytes(5), "image/jpeg", 4))).toBe(400);
  });

  it("putObject accepts a stream body with a declared size", async () => {
    const { env, r2 } = makeEnv();
    await putObject(env, "screening-documents", "c1/s/screening.pdf", new Response(new Uint8Array(300)).body!, "application/pdf", 300);
    expect(r2.objects.get("screening-documents/c1/s/screening.pdf")?.bytes.byteLength).toBe(300);
  });

  it("the soft cap can never be configured above the 10 GB free tier", () => {
    const { env } = makeEnv({ R2_SOFT_CAP_BYTES: String(50 * 1024 ** 3) });
    expect(fileLimits(env).softCapBytes).toBe(10 * 1024 ** 3);
  });

  it("daily upload quota: per user and global", async () => {
    const { env } = makeEnv();
    const db = (env as { DB: D1Database }).DB;
    const limits = { maxUploadBytes: 1, softCapBytes: 1, userDailyUploads: 2, globalDailyUploads: 3 };
    await consumeUploadQuota(db, "u1", limits, "2026-09-28");
    await consumeUploadQuota(db, "u1", limits, "2026-09-28");
    expect(await status(consumeUploadQuota(db, "u1", limits, "2026-09-28"))).toBe(429);
    await consumeUploadQuota(db, "u1", limits, "2026-09-29"); // new day resets
    // global: 3 used on 09-28 already (including the rejected attempt)
    expect(await status(consumeUploadQuota(db, "u2", limits, "2026-09-28"))).toBe(429);
  });
});
