// Supabase Edge Function: forge-auth
// Sign-up and password reset WITHOUT waiting for an email (Nov 2026): the
// built-in Supabase mailer is rate-limited and often lands in spam, so
// clients got stuck. The coach's invite code (sent on WhatsApp) proves who
// the client is instead.
//
// Actions (POST JSON body, called signed-out with the anon key):
//   { action: "signup", code, password }
//      Creates the client's login for the invite with that code, already
//      confirmed, and links it to the client profile. The app then signs in.
//   { action: "reset", email, code, password }
//      The coach pressed "Reset password" (which put a fresh code on the
//      client). Sets the new password for that client's login, then
//      replaces the code so it only works once.
//
// Uses the built-in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secrets; no
// setup needed. Never touches coach (trainer) accounts.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (error: string, status = 400) => json({ error }, status);

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cleanCode = (c: unknown) => String(c ?? "").trim().toUpperCase();
const cleanEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
// Invite codes are 6 characters; reset codes (made by the coach's "Reset
// password" button) are 8, so an old invite code can never reset a password.
const RESET_LEN = 8;
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");

async function isTrainer(userId: string) {
  const { data } = await admin.from("trainers").select("id").eq("id", userId).maybeSingle();
  return !!data;
}
async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function signup(code: string, password: string) {
  const { data: client } = await admin.from("clients").select("id, name, email, client_user_id, invite_status").eq("invite_code", code).maybeSingle();
  if (!client) return fail("That invite code wasn't found. Check it with your coach.");
  if (client.client_user_id) return fail("This invite is already used. Log in instead, or ask your coach for a password reset code.");
  const email = cleanEmail(client.email);
  if (!email) return fail("Your coach hasn't added your email yet. Ask them to add it, then try again.");

  let userId: string;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: client.name, role: "client" } });
  if (created.data?.user) {
    userId = created.data.user.id;
  } else {
    // Usually an earlier sign-up whose confirmation email never arrived.
    const existing = await findUserByEmail(email);
    if (!existing) return fail(created.error?.message || "Couldn't create your account. Try again.");
    if (await isTrainer(existing.id)) return fail("This email belongs to a coach account.");
    if (existing.email_confirmed_at) return fail("You already have an account. Log in, or ask your coach for a password reset code.");
    const upd = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (upd.error) return fail(upd.error.message);
    userId = existing.id;
  }
  const { error } = await admin.from("clients").update({ client_user_id: userId, invite_status: "accepted", invite_code: newCode() }).eq("id", client.id);
  if (error) return fail(error.message, 500);
  return json({ ok: true, email });
}

async function reset(email: string, code: string, password: string) {
  if (code.length !== RESET_LEN) return fail("That's not a reset code. Ask your coach to tap Reset password and send you the new code.");
  const { data: client } = await admin.from("clients").select("id, email, client_user_id").eq("invite_code", code).maybeSingle();
  if (!client || cleanEmail(client.email) !== email || !client.client_user_id) return fail("That email and code don't match. Check the code your coach sent you.");
  if (await isTrainer(client.client_user_id)) return fail("This is a coach account.");
  const upd = await admin.auth.admin.updateUserById(client.client_user_id, { password, email_confirm: true });
  if (upd.error) return fail(upd.error.message);
  await admin.from("clients").update({ invite_code: newCode() }).eq("id", client.id); // one use only
  return json({ ok: true, email: upd.data.user?.email || email });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);
  let body: any;
  try { body = await req.json(); } catch { return fail("Bad request"); }
  const code = cleanCode(body?.code);
  const password = String(body?.password ?? "");
  if (code.length < 4) return fail("Enter the code from your coach.");
  if (password.length < 6) return fail("Choose a password with at least 6 characters.");
  try {
    if (body?.action === "signup") return await signup(code, password);
    if (body?.action === "reset") {
      const email = cleanEmail(body?.email);
      if (!email) return fail("Enter your email.");
      return await reset(email, code, password);
    }
    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error)?.message || "Something went wrong", 500);
  }
});
