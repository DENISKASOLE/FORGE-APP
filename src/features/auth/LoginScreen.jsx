import { useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { useIsMobile } from "../../lib/browser.js";

function inviteCodeFromUrl() {
  if (typeof window === "undefined") return "";
  return new URL(window.location.href).searchParams.get("invite") || "";
}

function AuthField({ label, value, onChange, type = "text", placeholder = "", right = null, focused = false }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontFamily: BRAND.sans, fontSize: 10, fontWeight: 600, color: BRAND.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
        {right}
      </div>
      <div style={{
        background: focused ? BRAND.card2 : BRAND.card,
        border: `1px solid ${focused ? "color-mix(in srgb, var(--accent) 35%, transparent)" : BRAND.line}`,
        borderRadius: 13,
        padding: "15px 14px",
        boxShadow: focused ? "0 0 0 3px color-mix(in srgb, var(--accent) 8%, transparent)" : "none",
      }}>
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: BRAND.text, fontFamily: BRAND.sans, fontWeight: 500, fontSize: 15, padding: 0 }}
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
    <div className="cinematic-bg" style={{ minHeight: "100vh", color: BRAND.text, display: "flex", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -130, right: -90, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 66%)", pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 430, display: "flex", flexDirection: "column", padding: isMobile ? "56px 24px 40px" : "72px 24px 48px", position: "relative", minHeight: "100vh", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 40 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 15, fontWeight: 800, letterSpacing: "0.1em", color: BRAND.text }}>FORGE</div>
          <div style={{ fontFamily: BRAND.sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: BRAND.muted }}>PERFORMANCE</div>
        </div>

        <div style={{ fontFamily: BRAND.display, fontSize: isMobile ? 28 : 32, fontWeight: 800, letterSpacing: "-0.9px", lineHeight: 1.05, color: BRAND.text }}>
          {isInvite ? "Create your account." : "Good to see you."}
        </div>
        <div style={{ fontFamily: BRAND.sans, fontSize: 13, color: BRAND.muted, marginTop: 9, lineHeight: 1.5 }}>
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
            focused
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
            marginTop: 24, boxShadow: "0 8px 28px color-mix(in srgb, var(--accent) 26%, transparent)", opacity: loading ? 0.6 : 1,
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
