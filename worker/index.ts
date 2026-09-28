// Forge v2 Worker: serves the built Vite app from static assets and the
// /api/* routes below. Only /api/* runs this code (run_worker_first in
// wrangler.jsonc); every other path is answered by the assets binding.
import { Hono } from "hono";
import type { AppContext } from "./lib/env";
import { HttpError, fail } from "./lib/http";
import auth from "./routes/auth";
import db from "./routes/db";
import files from "./routes/files";
import ai from "./routes/ai";
import food from "./routes/food";
import pay from "./routes/pay";
import admin from "./routes/admin";

const app = new Hono<AppContext>();

app.get("/api/health", (c) => c.json({ ok: true, env: c.env.APP_ENV }));

// Same-origin app: reject cross-site state-changing requests (CSRF guard for
// the cookie session). Browsers always send Origin on POST/PUT/PATCH/DELETE.
app.use("/api/*", async (c, next) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = c.req.header("Origin");
    if (origin && origin !== new URL(c.req.url).origin) {
      return fail(c, 403, "Cross-origin request blocked", "bad_origin");
    }
  }
  await next();
});

app.route("/api/auth", auth);
app.route("/api/db", db);
app.route("/api/files", files);
app.route("/api/ai", ai);
app.route("/api/food", food);
app.route("/api/pay", pay);
app.route("/api/admin", admin);

app.notFound((c) => fail(c, 404, "Not found", "not_found"));

app.onError((err, c) => {
  if (err instanceof HttpError) return fail(c, err.status, err.message, err.code);
  console.error("Unhandled API error", c.req.method, c.req.path, err);
  return fail(c, 500, "Something went wrong. Please try again.", "internal");
});

export default app;
