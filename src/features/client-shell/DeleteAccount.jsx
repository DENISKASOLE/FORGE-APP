import { useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";

// Client-only "Delete my account" (Nov 19 2026). Full screen, explains what
// goes, and needs the word DELETE typed to enable the button. Progress photos
// are removed through the Storage API, then the delete_my_account() database
// function removes the client's data and login (see the migration of the
// same date), and the app signs out to the welcome screen.
async function removeFolder(bucket, prefix) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return;
  const files = data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
  const folders = data.filter((f) => !f.id).map((f) => `${prefix}/${f.name}`);
  for (const sub of folders) await removeFolder(bucket, sub);
  if (files.length) await supabase.storage.from(bucket).remove(files);
}

export function DeleteAccountScreen({ client, onClose }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ready = typed.trim().toUpperCase() === "DELETE" && !busy;

  async function run() {
    if (!ready) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) { setMsg("You're offline. Connect to the internet to delete your account."); return; }
    setBusy(true); setMsg("");
    try { await removeFolder("client-photos", `clients/${client.id}`); } catch { /* photos are best effort */ }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      setMsg(/function|PGRST202|schema cache/i.test(`${error.code} ${error.message}`)
        ? "Account deletion isn't switched on yet. Please contact your coach and they'll delete it for you."
        : `Couldn't delete your account: ${error.message}`);
      return;
    }
    try { localStorage.removeItem("forge_outbox_v2"); } catch { /* ignore */ }
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/");
  }

  const item = (t) => <li style={{ marginBottom: 6 }}>{t}</li>;
  return (
    <div className="fx-push" style={{ position: "fixed", inset: 0, zIndex: 1300, background: "var(--page)", color: BRAND.text, overflowY: "auto",
      padding: "calc(env(safe-area-inset-top) + 14px) 24px calc(env(safe-area-inset-bottom) + 28px)", boxSizing: "border-box", fontFamily: BRAND.sans }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <button onClick={onClose} disabled={busy} style={{ background: "none", border: "none", padding: "6px 0", color: BRAND.muted, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>‹ Back</button>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 18 }}>Delete my account</div>
        <div style={{ fontSize: 15, lineHeight: 1.55, color: BRAND.muted, marginTop: 10 }}>
          This permanently deletes your Forge account and everything in it. It can't be undone, and your coach won't be able to get it back.
        </div>
        <div style={{ background: BRAND.card, border: "1px solid var(--line-strong)", borderRadius: 16, padding: "14px 16px", marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.text, marginBottom: 8 }}>What gets deleted</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.45, color: BRAND.muted }}>
            {item("Your login (email and password)")}
            {item("Your profile, training program and every workout you've logged")}
            {item("Nutrition plan, food logs, check-ins and measurements")}
            {item("Progress photos")}
            {item("Payment history and signed agreements")}
          </ul>
        </div>
        <label style={{ display: "block", marginTop: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Type <b>DELETE</b> to confirm</div>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="DELETE"
            style={{ width: "100%", boxSizing: "border-box", height: 52, borderRadius: 999, border: "1.5px solid var(--line-strong)", background: BRAND.card, color: BRAND.text, padding: "0 18px", fontSize: 16, fontFamily: "inherit", outline: "none" }} />
        </label>
        {msg && <div style={{ marginTop: 14, color: BRAND.red, fontSize: 14, lineHeight: 1.5 }}>{msg}</div>}
        <button onClick={run} disabled={!ready}
          style={{ width: "100%", height: 54, marginTop: 20, borderRadius: 999, border: "none", background: ready ? "var(--red)" : "var(--chip)", color: ready ? "#fff" : BRAND.dim,
            fontSize: 16, fontWeight: 600, fontFamily: "inherit", cursor: ready ? "pointer" : "not-allowed", transition: "background .15s" }}>
          {busy ? "Deleting…" : "Delete my account permanently"}
        </button>
      </div>
    </div>
  );
}
