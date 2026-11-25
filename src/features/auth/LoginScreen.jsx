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
  const [resetCode, setResetCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  async function login() {
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else onReady?.();
    setLoading(false);
  }
  // Sign-up and coach-code reset go through the forge-auth function, which
  // confirms the login straight away - no email to wait for (Nov 2026).
  async function callAuth(body) {
    const { data, error } = await supabase.functions.invoke("forge-auth", { body });
    if (error) {
      let text = "";
      try { text = (await error.context?.json())?.error || ""; } catch { /* not JSON */ }
      throw new Error(text || "Couldn't reach Forge. Check your connection and try again.");
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function signInAfter(emailToUse) {
    const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password });
    if (error) throw error;
    onReady?.();
  }
  async function acceptInvite() {
    setLoading(true); setMsg("");
    try {
      const res = await callAuth({ action: "signup", code: inviteCode, password });
      await signInAfter(res.email);
    } catch (e) { setMsg(e.message); }
    setLoading(false);
  }
  async function resetWithCode() {
    if (!email.trim()) { setMsg("Enter your email."); return; }
    setLoading(true); setMsg("");
    try {
      const res = await callAuth({ action: "reset", email, code: resetCode, password });
      await signInAfter(res.email || email);
    } catch (e) { setMsg(e.message); }
    setLoading(false);
  }
  async function forgotPassword() {
    if (!email.trim()) { setMsg("Enter your email first, then tap Email me a reset link."); return; }
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
    setMsg(error ? error.message : "Reset link sent - check your inbox and spam. No email? Ask your coach for a reset code.");
    setLoading(false);
  }
  const isInvite = mode === "invite";
  const isForgot = mode === "forgot";
  const isCode = mode === "code";
  const msgIsGood = msg.startsWith("Reset link sent");
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
            {isInvite ? <>Create your<br />account</> : isForgot ? <>Forgot your<br />password?</> : isCode ? <>Set a new<br />password</> : <>Results that<br />matter</>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: isMobile ? 52 : 64 }}>
          {isInvite && <AuthField label="Invite code" value={inviteCode} onChange={setInviteCode} placeholder="ABC123" autoComplete="off" />}
          {!isInvite && <AuthField label="Email" value={email} onChange={setEmail} placeholder="Enter your email" autoComplete="email" />}
          {isCode && <AuthField label="Code from your coach" value={resetCode} onChange={(v) => setResetCode(v.toUpperCase())} placeholder="8 characters" autoComplete="one-time-code" />}
          {!isForgot && <AuthField label={isCode ? "New password" : "Password"} value={password} onChange={setPassword} type="password" placeholder={isInvite || isCode ? "At least 6 characters" : "Enter your password"} autoComplete={isInvite || isCode ? "new-password" : "current-password"} />}
        </div>

        {msg && (
          <div style={{ fontFamily: BRAND.sans, marginTop: 16, color: msgIsGood ? BRAND.green : BRAND.red, fontSize: 14, fontWeight: 500, lineHeight: 1.5, textAlign: "center" }}>{msg}</div>
        )}

        <button
          disabled={loading}
          onClick={isInvite ? acceptInvite : isForgot ? forgotPassword : isCode ? resetWithCode : login}
          className="pressable"
          style={{
            width: "100%", height: 56, background: BRAND.btnBg, border: "none", borderRadius: 999,
            fontFamily: BRAND.sans, fontWeight: 600, fontSize: 17, letterSpacing: "0.02em", textTransform: "uppercase", color: BRAND.btnInk,
            cursor: loading ? "not-allowed" : "pointer", marginTop: 34, opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "…" : isInvite ? "Create account" : isForgot ? "Email me a reset link" : isCode ? "Save & log in" : "Continue"}
        </button>

        <div style={{ marginTop: 28, textAlign: "center" }}>
          {isForgot ? (
            <button onClick={() => { setMode("code"); setMsg(""); }} style={{ ...linkBtn, color: BRAND.gold }}>I have a code from my coach</button>
          ) : isInvite || isCode ? (
            <button onClick={() => { setMode("login"); setMsg(""); }} style={linkBtn}>{isInvite ? "Already have an account? Log in" : "Back to log in"}</button>
          ) : (
            <button onClick={() => { setMode("forgot"); setMsg(""); }} style={linkBtn}>Forgot Password?</button>
          )}
        </div>
        {isForgot && (
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button onClick={() => { setMode("login"); setMsg(""); }} style={{ ...linkBtn, fontSize: 14, color: BRAND.muted }}>Back to log in</button>
          </div>
        )}
        {mode === "login" && (
          <div style={{ marginTop: 14, textAlign: "center", fontFamily: BRAND.sans, fontSize: 14, color: BRAND.muted }}>
            New here? <button onClick={() => setMode("invite")} style={{ ...linkBtn, fontSize: 14, color: BRAND.gold }}>Create your account</button>
          </div>
        )}
      </div>
    </div>
  );
}
