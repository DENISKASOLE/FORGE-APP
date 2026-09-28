// Forge v2: a drop-in, supabase-js-shaped client backed by the Cloudflare
// Worker API (/api/*). Every feature file keeps importing `supabase` from
// here unchanged; see docs/cloudflare/CONTRACTS.md.
import { from, rpc } from "./lib/forge/db.js";
import { auth } from "./lib/forge/auth.js";
import { storage } from "./lib/forge/storage.js";
import { functions } from "./lib/forge/functions.js";

export const supabase = { from, rpc, auth, storage, functions };
export default supabase;
