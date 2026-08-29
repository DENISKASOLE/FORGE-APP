import { useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { useIsMobile } from "../../lib/browser.js";

function inviteCodeFromUrl() {
  if (typeof window === "undefined") return "";
  return new URL(window.location.href).searchParams.get("invite") || "";
}

export function LoginScreen({ onReady }) {
  const isMobile = useIsMobile(520);
  const urlInvite = inviteCodeFromUrl();
  const [mode, setMode] = useState(urlInvite ? "invite" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(urlInvite);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  async function login() {
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else onReady?.();
    setLoading(false);
  }
  async function acceptInvite() {
    setLoading(true); setMsg("");
    const code = inviteCode.trim().toUpperCase();
    const { data: found, error: findErr } = await supabase.from("clients").select("*").eq("invite_code", code).maybeSingle();
    if (findErr || !found) { setMsg("Invite code not found."); setLoading(false); return; }
    const { data, error } = await supabase.auth.signUp({ email: found.email || email, password, options: { data: { name: found.name, role: "client" } } });
    if (error) { setMsg(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("clients").update({ client_user_id: data.user.id, invite_status: "accepted", email: found.email || email }).eq("id", found.id);
      setMsg("Client account connected. Log in with the password you created.");
      setMode("login");
    }
    setLoading(false);
  }
  async function forgotPassword() {
    setLoading(true); setMsg("");
    const redirectTo = "https://forgeappbydenis.vercel.app/";
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMsg(error ? error.message : "Password reset link sent to your email.");
    setLoading(false);
  }
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <Card style={{ width: "100%", maxWidth: 430, padding: 26 }}>
        <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 24 : 30, fontWeight: 500, letterSpacing: "0.06em", color: BRAND.text }}>FORGE</div>
        <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 26 : 28, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginTop: 10 }}>Welcome back</div>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, fontWeight: 400, lineHeight: 1.6, marginTop: 6, marginBottom: 22 }}>{urlInvite ? "You've been invited. Enter your email and choose a password to finish setting up your account." : "Log in, or use an invite code your coach sent you."}</div>
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" />
        <div style={{ height: 10 }} />
        <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Password" />
        {mode === "invite" && <><div style={{ height: 10 }} /><Field label="Invite code" value={inviteCode} onChange={setInviteCode} placeholder="ABC123" /></>}
        {msg && <div style={{ fontFamily: BRAND.sans, marginTop: 12, color: msg.includes("sent") || msg.includes("created") || msg.includes("connected") ? BRAND.green : BRAND.yellow, fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{msg}</div>}
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {mode === "login" && <Button disabled={loading} onClick={login}>Log in</Button>}
          {mode === "invite" && <Button disabled={loading} onClick={acceptInvite}>Accept invite</Button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <Button variant="ghost" onClick={() => setMode("login")} style={{ flex: 1 }}>Login</Button>
          <Button variant="ghost" onClick={() => setMode("invite")} style={{ flex: 1 }}>Have an invite code?</Button>
        </div>
        <button onClick={forgotPassword} style={{ fontFamily: BRAND.sans, marginTop: 14, background: "transparent", border: "none", color: BRAND.blue, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0 }}>Forgot password?</button>
      </Card>
    </div>
  );
}
