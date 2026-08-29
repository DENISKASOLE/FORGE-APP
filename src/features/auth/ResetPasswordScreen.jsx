import { useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";

export function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  async function save() {
    if (password.length < 6) { setMsg("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setMsg("Passwords don't match."); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setMsg(error.message); setSaving(false); return; }
    setMsg("Password updated. Redirecting to login...");
    setTimeout(() => { window.location.href = window.location.origin; }, 1500);
  }
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <Card style={{ width: "100%", maxWidth: 430, padding: 26 }}>
        <div style={{ fontFamily: BRAND.display, color: BRAND.text, fontSize: 26, fontWeight: 500, letterSpacing: "0.06em", textAlign: "center" }}>FORGE</div>
        <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginTop: 12, textAlign: "center" }}>Set a new password</div>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, fontWeight: 400, lineHeight: 1.6, marginTop: 6, marginBottom: 20, textAlign: "center" }}>Choose a new password for your account.</div>
        <Field label="New password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" />
        <div style={{ height: 10 }} />
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} />
        {msg && <div style={{ fontFamily: BRAND.sans, color: msg.includes("updated") ? BRAND.green : BRAND.yellow, fontWeight: 500, marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>{msg}</div>}
        <Button disabled={saving} onClick={save} style={{ width: "100%", marginTop: 16 }}>{saving ? "Saving..." : "Update password"}</Button>
      </Card>
    </div>
  );
}
