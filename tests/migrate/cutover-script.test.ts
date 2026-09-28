// Runs scripts/cutover.mjs as a child process against a local HTTP server
// that hands requests to the Worker app (with fake D1/R2/Supabase).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import app from "../../worker/index";
import { ADMIN_TOKEN, FakeSupabase, makeEnv } from "./harness";
import { fixture } from "./fixtures";

const SCRIPT = join(import.meta.dirname, "..", "..", "scripts", "cutover.mjs");

let server: Server;
let base = "";
let supa: FakeSupabase;
let ctx: ReturnType<typeof makeEnv>;
let failFirstCalls = 0;

beforeEach(async () => {
  supa = new FakeSupabase(fixture());
  vi.stubGlobal("fetch", supa.fetch);
  ctx = makeEnv();
  failFirstCalls = 0;
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    if (failFirstCalls > 0) {
      failFirstCalls--;
      res.writeHead(503, { "Content-Type": "application/json" }).end('{"error":{"message":"busy"}}');
      return;
    }
    const r = await app.request(
      `http://localhost${req.url}`,
      { method: req.method, headers: req.headers as Record<string, string>, body: chunks.length ? Buffer.concat(chunks) : undefined },
      ctx.env,
    );
    res.writeHead(r.status, { "Content-Type": "application/json" }).end(await r.text());
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await new Promise((r) => server.close(r));
});

function runScript(args: string[], token = ADMIN_TOKEN): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      { env: { ...process.env, FORGE_URL: base, MIGRATION_ADMIN_TOKEN: token }, timeout: 30000 },
      (err, stdout, stderr) => resolve({ code: err ? Number((err as { code?: number }).code ?? 1) : 0, out: stdout + stderr }),
    );
  });
}

describe("scripts/cutover.mjs", () => {
  it("runs every default step, retries a 503 and prints the verify table", async () => {
    failFirstCalls = 1;
    const { code, out } = await runScript(["--rehearsal"]);
    expect(out).toContain("REHEARSAL");
    expect(out).toContain("retry 1/");
    expect(out).toContain("✓ files:screening-documents done");
    expect(out).toMatch(/client_data\s+6\s+6\s+OK/);
    expect(out).not.toContain("send-password-setup:");
    expect(code, out).toBe(0);
    expect(ctx.DB.rows("SELECT id FROM clients")).toHaveLength(5);
  }, 30000);

  it("exits non-zero on a bad token or bad flags", async () => {
    expect((await runScript(["--steps=clients"], "z".repeat(40))).code).toBe(1);
    expect((await runScript(["--rehearsal", "--send-emails"])).code).toBe(1);
    expect((await runScript(["--steps=send-password-setup"])).code).toBe(1);
  }, 30000);
});
