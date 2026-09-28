import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeEnv, COACH_EMAIL } from "./helpers";

// session.ts is owned by the auth agent; stub it with a test header.
vi.mock("../../worker/lib/session", () => ({
  loadUser: async () => null,
  requireUser: async (c: any, next: () => Promise<void>) => {
    const id = c.req.header("x-test-user");
    if (!id) return c.json({ error: { message: "Not signed in", code: "unauthorized" } }, 401);
    c.set("user", { id, email: c.req.header("x-test-email") ?? `${id}@forge.test`, email_verified: true, user_metadata: {} });
    await next();
  },
}));

const { default: app } = await import("../../worker/index");
const BASE = "http://forge.test";

let ctx: ReturnType<typeof makeEnv>;
beforeEach(() => { ctx = makeEnv(); });

function req(path: string, init: RequestInit & { user?: string; email?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.user) headers.set("x-test-user", init.user);
  if (init.email) headers.set("x-test-email", init.email);
  return app.request(BASE + path, { ...init, headers }, ctx.env);
}

function upload(bucket: string, path: string, user: string, opts: { size?: number; type?: string; upsert?: boolean; length?: string | null } = {}) {
  const body = new Uint8Array(opts.size ?? 10);
  const headers: Record<string, string> = { "Content-Type": opts.type ?? "image/jpeg" };
  if (opts.length !== null) headers["Content-Length"] = opts.length ?? String(body.byteLength);
  if (opts.upsert) headers["x-upsert"] = "true";
  return req(`/api/files/object/${bucket}/${path}`, { method: "PUT", body, headers, user });
}

async function sign(bucket: string, path: string, user: string, expiresIn = 3600) {
  return req("/api/files/sign", { method: "POST", user, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bucket, path, expiresIn }) });
}

describe("/api/files routes", () => {
  it("upload -> sign -> raw -> 304 -> delete round trip", async () => {
    const put = await upload("client-photos", "clients/c1/progress/1.jpg", "user-c1", { size: 20 });
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ data: { path: "clients/c1/progress/1.jpg", fullPath: "client-photos/clients/c1/progress/1.jpg" } });

    const signed = await sign("client-photos", "clients/c1/progress/1.jpg", "coach-1");
    expect(signed.status).toBe(200);
    const { signedUrl } = (await signed.json()).data;
    expect(signedUrl).toMatch(/^\/api\/files\/raw\/client-photos\/clients\/c1\/progress\/1\.jpg\?exp=\d+&sig=[0-9a-f]{64}$/);

    const raw = await req(signedUrl); // no session needed
    expect(raw.status).toBe(200);
    expect(raw.headers.get("Content-Type")).toBe("image/jpeg");
    expect(raw.headers.get("Cache-Control")).toMatch(/^private, max-age=(3600|3599)$/);
    const etag = raw.headers.get("ETag")!;
    expect(etag).toBeTruthy();
    expect((await raw.arrayBuffer()).byteLength).toBe(20);

    const opsBefore = ctx.r2.ops.classB;
    const revalidate = await req(signedUrl, { headers: { "If-None-Match": etag } });
    expect(revalidate.status).toBe(304);
    expect(ctx.r2.ops.classB).toBe(opsBefore); // answered from D1, no R2 read

    const del = await req("/api/files/object/client-photos/clients/c1/progress/1.jpg", { method: "DELETE", user: "coach-1" });
    expect(del.status).toBe(200);
    expect(ctx.r2.objects.size).toBe(0);
    expect((await req(signedUrl)).status).toBe(404);
  });

  it("enforces access per v1 rules on upload, sign and delete", async () => {
    expect((await upload("client-photos", "clients/c1/p/1.jpg", "user-c2")).status).toBe(403);
    expect((await upload("client-photos", "clients/c1/p/1.jpg", "coach-1")).status).toBe(200);
    expect((await sign("client-photos", "clients/c1/p/1.jpg", "user-c2")).status).toBe(403);
    expect((await sign("client-photos", "clients/c1/p/1.jpg", "stranger")).status).toBe(403);
    expect((await req("/api/files/object/client-photos/clients/c1/p/1.jpg", { method: "DELETE", user: "user-c4" })).status).toBe(403);
    expect((await upload("client-photos", "trainers/coach-1/profile/a.jpg", "coach-1")).status).toBe(200);
    expect((await sign("client-photos", "trainers/coach-1/profile/a.jpg", "user-c1")).status).toBe(403);
  });

  it("screening documents are client-insert-only and append-only", async () => {
    expect((await upload("screening-documents", "c1/s1/screening.pdf", "coach-1", { type: "application/pdf" })).status).toBe(403);
    expect((await upload("screening-documents", "c1/s1/screening.pdf", "user-c1", { type: "application/pdf" })).status).toBe(200);
    expect((await upload("screening-documents", "c1/s1/screening.pdf", "user-c1", { type: "application/pdf", upsert: true })).status).toBe(403);
    expect((await sign("screening-documents", "c1/s1/screening.pdf", "coach-1")).status).toBe(200);
    expect((await req("/api/files/object/screening-documents/c1/s1/screening.pdf", { method: "DELETE", user: "user-c1" })).status).toBe(403);
  });

  it("honours x-upsert like supabase and keeps usage in sync", async () => {
    const p = "clients/c1/p/1.jpg";
    expect((await upload("client-photos", p, "user-c1", { size: 100 })).status).toBe(200);
    const dup = await upload("client-photos", p, "user-c1", { size: 50 });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe("Duplicate");
    expect((await upload("client-photos", p, "user-c1", { size: 50, upsert: true })).status).toBe(200);
    const usage = await req("/api/files/usage", { user: "coach-1", email: COACH_EMAIL });
    expect((await usage.json()).data).toMatchObject({ totalBytes: 50, totalObjects: 1, softCapBytes: 4096 });
  });

  it("validates type, size, length and path", async () => {
    expect((await upload("client-photos", "clients/c1/p/1.gif", "user-c1", { type: "image/gif" })).status).toBe(415);
    expect((await upload("client-photos", "clients/c1/p/1.html", "user-c1", { type: "text/html" })).status).toBe(415);
    expect((await upload("client-photos", "clients/c1/p/big.jpg", "user-c1", { size: 2000 })).status).toBe(413);
    expect((await upload("client-photos", "clients/c1/p/zero.jpg", "user-c1", { size: 0 })).status).toBe(400);
    expect((await upload("client-photos", "clients/c1/p/../../c2/x.jpg", "user-c1")).status).toBeGreaterThanOrEqual(400);
    // URL parsing normalizes dot segments before routing; access is checked on the result.
    expect((await upload("client-photos", "clients/c1/p/%2e%2e/%2e%2e/c2/x.jpg", "user-c1")).status).toBe(403);
    expect((await upload("client-photos", "clients/c1/p/..%2Fx.jpg", "user-c1")).status).toBe(400);
    expect((await upload("other-bucket", "clients/c1/p/x.jpg", "user-c1")).status).toBe(400);
    expect((await upload("client-photos", "clients/c1/p/lie.jpg", "user-c1", { size: 10, length: "abc" })).status).toBe(411);
  });

  it("enforces the streamed size when Content-Length lies", async () => {
    const res = await upload("client-photos", "clients/c1/p/lie.jpg", "user-c1", { size: 900, length: "10" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(ctx.r2.objects.has("client-photos/clients/c1/p/lie.jpg")).toBe(false);
  });

  it("returns 507 with a friendly message when the soft cap would be passed", async () => {
    for (let i = 0; i < 4; i++) expect((await upload("client-photos", `clients/c1/p/${i}.jpg`, "user-c1", { size: 1000 })).status).toBe(200);
    const res = await upload("client-photos", "clients/c1/p/full.jpg", "user-c1", { size: 200 });
    expect(res.status).toBe(507);
    expect((await res.json()).error.message).toMatch(/storage is full/i);
  });

  it("applies the per-user daily upload cap", async () => {
    ctx = makeEnv({ FILE_USER_DAILY_UPLOADS: "2" });
    expect((await upload("client-photos", "clients/c1/p/1.jpg", "user-c1")).status).toBe(200);
    expect((await upload("client-photos", "clients/c1/p/2.jpg", "user-c1")).status).toBe(200);
    expect((await upload("client-photos", "clients/c1/p/3.jpg", "user-c1")).status).toBe(429);
    expect((await upload("client-photos", "clients/c1/p/3.jpg", "coach-1")).status).toBe(200);
  });

  it("raw rejects bad or expired signatures", async () => {
    await upload("client-photos", "clients/c1/p/1.jpg", "user-c1");
    const { signedUrl } = (await (await sign("client-photos", "clients/c1/p/1.jpg", "user-c1")).json()).data;
    expect((await req(signedUrl.replace("clients/c1", "clients/c2"))).status).toBe(403);
    expect((await req(signedUrl.replace(/sig=./, "sig=0"))).status).toBe(403);
    expect((await req(signedUrl.split("?")[0])).status).toBe(403);
  });

  it("usage is coach-only, and routes require a session", async () => {
    expect((await req("/api/files/usage", { user: "user-c1" })).status).toBe(403);
    const ok = await req("/api/files/usage", { user: "coach-1", email: COACH_EMAIL.toUpperCase() });
    expect((await ok.json()).data).toMatchObject({ totalBytes: 0, freeTierBytes: 10 * 1024 ** 3, percentOfFreeTier: 0 });
    expect((await upload("client-photos", "clients/c1/p/1.jpg", "")).status).toBe(401);
    expect((await req("/api/files/usage")).status).toBe(401);
  });

  it("returns 429 when the API rate limiter says no, and blocks cross-origin writes", async () => {
    ctx = makeEnv({ API_LIMITER: { limit: async () => ({ success: false }) } });
    expect((await upload("client-photos", "clients/c1/p/1.jpg", "user-c1")).status).toBe(429);
    const xorigin = await req("/api/files/object/client-photos/clients/c1/p/1.jpg", { method: "DELETE", user: "user-c1", headers: { Origin: "https://evil.test" } });
    expect(xorigin.status).toBe(403);
  });
});
