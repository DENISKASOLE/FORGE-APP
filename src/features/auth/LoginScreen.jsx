import { useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { useIsMobile } from "../../lib/browser.js";

function inviteCodeFromUrl() {
  if (typeof window === "undefined") return "";
  return new URL(window.location.href).searchParams.get("invite") || "";
}

// Text box for the sign-in screens. Crisp by design (Nov 2026: the light
// login looked blurry): solid card, hairline border, and a sharp accent
// border only while the box actually has focus - no glow, no tint.
function AuthField({ label, value, onChange, type = "text", placeholder = "", right = null }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontFamily: BRAND.sans, fontSize: 11, fontWeight: 600, color: BRAND.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
        {right}
      </div>
      <div style={{
        background: BRAND.card,
        border: `1.5px solid ${focused ? BRAND.gold : BRAND.line}`,
        borderRadius: 13,
        padding: "14px 14px",
        transition: "border-color .15s ease",
      }}>
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={type === "password" ? "current-password" : label.toLowerCase().includes("email") ? "email" : "off"}
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: BRAND.text, fontFamily: BRAND.sans, fontWeight: 500, fontSize: 16, padding: 0 }}
        />
      </div>
    </div>
  );
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
    const { data: rows, error: findErr } = await supabase.rpc("lookup_invite", { p_code: code });
    const found = rows?.[0];
    if (findErr || !found) { setMsg("Invite code not found."); setLoading(false); return; }
    const { data, error } = await supabase.auth.signUp({ email: found.email || email, password, options: { data: { name: found.name, role: "client" } } });
    if (error) { setMsg(error.message); setLoading(false); return; }
    if (data.user) {
      const { error: claimErr } = await supabase.rpc("claim_invite", { p_code: code, p_email: found.email || email });
      if (claimErr) { setMsg(claimErr.message); setLoading(false); return; }
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
  const isInvite = mode === "invite";
  const msgIsGood = msg.includes("sent") || msg.includes("created") || msg.includes("connected");
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", padding: isMobile ? "56px 24px 40px" : "72px 24px 48px", position: "relative", minHeight: "100vh", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 40 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 15, fontWeight: 800, letterSpacing: "0.1em", color: BRAND.text }}>FORGE</div>
          <div style={{ fontFamily: BRAND.sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: BRAND.muted }}>PERFORMANCE</div>
        </div>

        <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 28 : 32, fontWeight: 800, letterSpacing: "-0.9px", lineHeight: 1.05, color: BRAND.text }}>
          {isInvite ? "Create your account." : "Good to see you."}
        </div>
        <div style={{ fontFamily: BRAND.sans, fontSize: 15, color: BRAND.muted, marginTop: 9, lineHeight: 1.5 }}>
          {isInvite ? "Enter your email and choose a password to finish setting up your account." : "Pick up where you left off."}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 30 }}>
          <AuthField label="Email" value={email} onChange={setEmail} placeholder="you@email.com" />
          <AuthField
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="Password"
            right={!isInvite ? (
              <button onClick={forgotPassword} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: BRAND.sans, fontSize: 11, fontWeight: 600, color: BRAND.gold }}>Forgot password?</button>
            ) : null}
          />
          {isInvite && <AuthField label="Invite code" value={inviteCode} onChange={setInviteCode} placeholder="ABC123" />}
        </div>

        {msg && (
          <div style={{ fontFamily: BRAND.sans, marginTop: 14, color: msgIsGood ? BRAND.green : BRAND.red, fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{msg}</div>
        )}

        <button
          disabled={loading}
          onClick={isInvite ? acceptInvite : login}
          style={{
            width: "100%", background: BRAND.gold, border: "none", borderRadius: 14, padding: 17,
            fontFamily: BRAND.sans, fontWeight: 700, fontSize: 15, color: BRAND.btnInk, cursor: loading ? "not-allowed" : "pointer",
            marginTop: 24, boxShadow: "0 1px 2px rgba(0,0,0,.08)", opacity: loading ? 0.6 : 1,
          }}
        >
          {isInvite ? "Accept invite" : "Sign in"}
        </button>

        <div style={{ marginTop: 16, textAlign: "center", fontFamily: BRAND.sans, fontSize: 13, color: BRAND.muted }}>
          {isInvite ? (
            <>Already have an account?{" "}
              <button onClick={() => setMode("login")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: BRAND.sans, color: BRAND.gold, fontWeight: 700, fontSize: 13 }}>Sign in instead</button>
            </>
          ) : (
            <>New here?{" "}
              <button onClick={() => setMode("invite")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: BRAND.sans, color: BRAND.gold, fontWeight: 700, fontSize: 13 }}>Create your account</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
