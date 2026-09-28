// Route group /api/files - see docs/cloudflare/CONTRACTS.md for ownership.
// R2-backed replacement for supabase.storage (client shim:
// src/lib/forge/storage.js). Access rules: worker/lib/files/access.ts.
import { Hono, type Context, type Next } from "hono";
import type { AppContext } from "../lib/env";
import { HttpError, fail, readJson } from "../lib/http";
import { requireUser } from "../lib/session";
import { canAccess } from "../lib/files/access";
import { ALLOWED_CONTENT_TYPES, fileLimits } from "../lib/files/config";
import { objectKey, targetFromPathname, validateTarget } from "../lib/files/paths";
import { consumeUploadQuota } from "../lib/files/quota";
import { clampExpiresIn, createSignedUrl, verifySignedUrl } from "../lib/files/sign";
import { assertWithinCap, deleteObject, readUsage, storedEtag, usageSummary, writeAndRecord } from "../lib/files/store";

const app = new Hono<AppContext>();
type Ctx = Context<AppContext>;

const forbidden = () => new HttpError(403, "You don't have access to this file.", "forbidden");

function currentUser(c: Ctx) {
  const user = c.get("user");
  if (!user) throw new HttpError(401, "Not signed in", "unauthorized");
  return user;
}

async function apiRateLimit(c: Ctx, next: Next) {
  const { success } = await c.env.API_LIMITER.limit({ key: currentUser(c).id });
  if (!success) return fail(c, 429, "Too many requests. Please slow down.", "rate_limited");
  await next();
}

function isUpsert(header: string | undefined): boolean {
  return /^(1|true)$/i.test((header ?? "").trim());
}

function uploadSize(c: Ctx, maxBytes: number): number {
  const raw = c.req.header("Content-Length");
  if (!raw || !/^\d{1,12}$/.test(raw)) throw new HttpError(411, "Upload is missing its size.", "length_required");
  const size = Number(raw);
  if (size === 0) throw new HttpError(400, "The file is empty.", "empty_file");
  if (size > maxBytes) {
    throw new HttpError(413, `File is too large. The limit is ${Math.floor(maxBytes / (1024 * 1024))} MB.`, "too_large");
  }
  return size;
}

app.use("/object/*", requireUser, apiRateLimit);
app.use("/sign", requireUser, apiRateLimit);
app.use("/usage", requireUser);

app.put("/object/:bucket/*", async (c) => {
  const user = currentUser(c);
  const { bucket, path, segments } = targetFromPathname(new URL(c.req.url).pathname, "object");
  const contentType = (c.req.header("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new HttpError(415, "Only JPEG, PNG, WebP, HEIC images and PDF files can be uploaded.", "unsupported_type");
  }
  const limits = fileLimits(c.env);
  const size = uploadSize(c, limits.maxUploadBytes);
  const body = c.req.raw.body;
  if (!body) throw new HttpError(400, "The file is empty.", "empty_file");

  if (!(await canAccess(c.env.DB, user.id, bucket, segments, "insert"))) throw forbidden();
  const key = objectKey(bucket, path);
  const usage = await readUsage(c.env.DB, key);
  if (usage.existingSize !== null) {
    if (!isUpsert(c.req.header("x-upsert"))) throw new HttpError(409, "The resource already exists", "Duplicate");
    if (!(await canAccess(c.env.DB, user.id, bucket, segments, "update"))) throw forbidden();
  }
  assertWithinCap(limits.softCapBytes, usage, size);
  await consumeUploadQuota(c.env.DB, user.id, limits);
  await writeAndRecord(c.env, key, body, contentType, size, user.id);
  return c.json({ data: { path, fullPath: key } });
});

app.delete("/object/:bucket/*", async (c) => {
  const user = currentUser(c);
  const { bucket, path, segments } = targetFromPathname(new URL(c.req.url).pathname, "object");
  if (!(await canAccess(c.env.DB, user.id, bucket, segments, "delete"))) throw forbidden();
  await deleteObject(c.env, objectKey(bucket, path));
  return c.json({ data: { path } });
});

app.post("/sign", async (c) => {
  const user = currentUser(c);
  const body = await readJson<{ bucket?: unknown; path?: unknown; expiresIn?: unknown }>(c);
  const { bucket, path, segments } = validateTarget(body.bucket, body.path);
  const expiresIn = clampExpiresIn(body.expiresIn);
  if (!(await canAccess(c.env.DB, user.id, bucket, segments, "read"))) throw forbidden();
  const { signedUrl } = await createSignedUrl(c.env.FILE_URL_SECRET, bucket, path, expiresIn);
  return c.json({ data: { signedUrl } });
});

// No session: the HMAC signature is the capability, so <img src> works.
app.get("/raw/:bucket/*", async (c) => {
  const { bucket, path } = targetFromPathname(new URL(c.req.url).pathname, "raw");
  const remaining = await verifySignedUrl(c.env.FILE_URL_SECRET, bucket, path, c.req.query("exp"), c.req.query("sig"));
  const key = objectKey(bucket, path);
  const headers = new Headers({
    "Cache-Control": `private, max-age=${remaining}`,
    "X-Content-Type-Options": "nosniff",
  });

  // Answer revalidations from the D1 ledger so they cost no R2 Class B op.
  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch) {
    const etag = await storedEtag(c.env.DB, key);
    if (etag && etagMatches(ifNoneMatch, etag)) {
      headers.set("ETag", etag);
      return new Response(null, { status: 304, headers });
    }
  }

  const object = await c.env.FILES.get(key, ifNoneMatch ? { onlyIf: c.req.raw.headers } : undefined);
  if (!object) return fail(c, 404, "File not found", "not_found");
  headers.set("ETag", object.httpEtag);
  if (!("body" in object) || !object.body) return new Response(null, { status: 304, headers });
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
});

app.get("/usage", async (c) => {
  const user = currentUser(c);
  const coach = (c.env.COACH_EMAIL ?? "").trim().toLowerCase();
  if (!coach || user.email.trim().toLowerCase() !== coach) throw forbidden();
  const usage = await readUsage(c.env.DB, "");
  return c.json({ data: usageSummary(usage, fileLimits(c.env).softCapBytes) });
});

export function etagMatches(header: string, etag: string): boolean {
  const bare = (v: string) => v.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  const target = bare(etag);
  return header.split(",").some((v) => v.trim() === "*" || bare(v) === target);
}

app.onError((err, c) => {
  if (err instanceof HttpError) return fail(c, err.status, err.message, err.code);
  throw err;
});

export default app;
