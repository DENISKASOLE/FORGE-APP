import { useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { useIsMobile } from "../../lib/browser.js";

function inviteCodeFromUrl() {
  if (typeof window === "undefined") return "";
  return new URL(window.location.href).searchParams.get("invite") || "";
}

// Text box for the sign-in screens (Nov 2026 redesign, after the UP login):
// sentence-case label above a rounded pill field; the border turns teal
// while the field has focus. Password fields get a show/hide eye.
function AuthField({ label, value, onChange, type = "text", placeholder = "", autoComplete }) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontFamily: BRAND.sans, fontSize: 15, fontWeight: 500, color: BRAND.text, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", background: BRAND.card, border: `1.5px solid ${focused ? BRAND.gold : "var(--line-strong)"}`, borderRadius: 999, padding: "0 18px", height: 54, transition: "border-color .15s ease" }}>
        <input
          type={isPw && !show ? "password" : isPw ? "text" : type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: BRAND.text, fontFamily: BRAND.sans, fontWeight: 400, fontSize: 16, padding: 0 }}
        />
        {isPw && (
          <button type="button" onClick={(e) => { e.preventDefault(); setShow((v) => !v); }} aria-label={show ? "Hide password" : "Show password"}
            style={{ background: "none", border: "none", padding: 4, marginLeft: 8, cursor: "pointer", color: BRAND.dim, display: "grid", placeItems: "center" }}>
            <EyeIcon off={!show} />
          </button>
        )}
      </div>
    </label>
  );
}
function EyeIcon({ off }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function LoginScreen({ onReady, onBack }) {
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
    if (!email.trim()) { setMsg("Enter your email first, then tap Forgot Password."); return; }
    setLoading(true); setMsg("");
    const redirectTo = "https://forgeappbydenis.vercel.app/";
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMsg(error ? error.message : "Password reset link sent to your email.");
    setLoading(false);
  }
  const isInvite = mode === "invite";
  const msgIsGood = msg.includes("sent") || msg.includes("created") || msg.includes("connected");
  const linkBtn = { background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: BRAND.sans, color: BRAND.text, fontWeight: 600, fontSize: 15 };
  return (
    <div className="fx-screen" style={{ minHeight: "100dvh", background: BRAND.bg, color: BRAND.text, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", padding: "calc(env(safe-area-inset-top) + 14px) 28px calc(env(safe-area-inset-bottom) + 32px)", boxSizing: "border-box", position: "relative" }}>
        {onBack ? (
          <button onClick={onBack} aria-label="Back" style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 6, marginLeft: -6, cursor: "pointer", color: BRAND.text }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        ) : <div style={{ height: 34 }} />}

        <div style={{ textAlign: "center", marginTop: isMobile ? 46 : 64 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: BRAND.text }}>Forge Performance</div>
          <div style={{ fontFamily: BRAND.sans, fontSize: 28, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1.25, color: BRAND.dim, marginTop: 40 }}>
            {isInvite ? <>Create your<br />account</> : <>Results that<br />matter</>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: isMobile ? 52 : 64 }}>
          <AuthField label="Email" value={email} onChange={setEmail} placeholder="Enter your email" autoComplete="email" />
          <AuthField label="Password" value={password} onChange={setPassword} type="password" placeholder={isInvite ? "Choose a password" : "Enter your password"} autoComplete={isInvite ? "new-password" : "current-password"} />
          {isInvite && <AuthField label="Invite code" value={inviteCode} onChange={setInviteCode} placeholder="ABC123" autoComplete="off" />}
        </div>

        {msg && (
          <div style={{ fontFamily: BRAND.sans, marginTop: 16, color: msgIsGood ? BRAND.green : BRAND.red, fontSize: 14, fontWeight: 500, lineHeight: 1.5, textAlign: "center" }}>{msg}</div>
        )}

        <button
          disabled={loading}
          onClick={isInvite ? acceptInvite : login}
          className="pressable"
          style={{
            width: "100%", height: 56, background: BRAND.btnBg, border: "none", borderRadius: 999,
            fontFamily: BRAND.sans, fontWeight: 600, fontSize: 17, letterSpacing: "0.02em", textTransform: "uppercase", color: BRAND.btnInk,
            cursor: loading ? "not-allowed" : "pointer", marginTop: 34, opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "…" : isInvite ? "Create account" : "Continue"}
        </button>

        <div style={{ marginTop: 28, textAlign: "center" }}>
          {isInvite
            ? <button onClick={() => setMode("login")} style={linkBtn}>Already have an account? Log in</button>
            : <button onClick={forgotPassword} style={linkBtn}>Forgot Password?</button>}
        </div>
        {!isInvite && (
          <div style={{ marginTop: 14, textAlign: "center", fontFamily: BRAND.sans, fontSize: 14, color: BRAND.muted }}>
            New here? <button onClick={() => setMode("invite")} style={{ ...linkBtn, fontSize: 14, color: BRAND.gold }}>Create your account</button>
          </div>
        )}
      </div>
    </div>
  );
}
