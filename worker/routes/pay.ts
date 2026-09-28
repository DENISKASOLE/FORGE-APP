// Route group /api/pay - see docs/cloudflare/CONTRACTS.md for ownership.
import { Hono } from "hono";
import type { AppContext } from "../lib/env";

const app = new Hono<AppContext>();

export default app;
