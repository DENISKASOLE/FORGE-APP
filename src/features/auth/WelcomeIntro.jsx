import { useEffect, useRef, useState } from "react";

// Logged-out welcome (Nov 2026): three full-bleed video slides with the
// exact wording Denis asked for (footage and copy from UP, used with their
// OK per Denis), then "Login". Always dark, like the reference. Videos are
// muted, play inline, and each slide moves on when its clip ends; swipe or
// tap the dots to move by hand.
const SLIDES = [
  { key: "goal", kicker: "Set your", title: "Goal", body: "Set goals that create lasting habits. With insights from your sleep, nutrition, and exercise, build a healthier routine that's designed for real, sustainable change." },
  { key: "diet", kicker: "Perfect your", title: "Diet", body: "Support metabolic health and reach your body composition goals with a nutrition plan tailored to you." },
  { key: "results", kicker: "See your", title: "Results", body: "Stay on top of your goals with insights from over 50 data points, helping you see real changes and stay accountable every step of the way." },
];

export function WelcomeIntro({ onLogin }) {
  const [i, setI] = useState(0);
  const vids = useRef([]);
  const touch = useRef(null);

  useEffect(() => {
    vids.current.forEach((v, n) => {
      if (!v) return;
      if (n === i) { try { v.currentTime = 0; } catch { /* not loaded yet */ } v.play?.().catch(() => {}); }
      else v.pause?.();
    });
  }, [i]);

  const go = (n) => setI((n + SLIDES.length) % SLIDES.length);
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
  };
  const s = SLIDES[i];

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      style={{ position: "fixed", inset: 0, background: "#000", color: "#fff", overflow: "hidden", fontFamily: "var(--sans)", userSelect: "none" }}>
      {/* Video, top ~62% of the screen, fading into black */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "62%" }}>
        {SLIDES.map((sl, n) => (
          <video key={sl.key} ref={(el) => { vids.current[n] = el; }} src={`/intro/${sl.key}.mp4`} poster={`/intro/${sl.key}.jpg`}
            muted playsInline autoPlay={n === 0} preload={n === 0 ? "auto" : "metadata"} onEnded={() => { if (n === i) go(i + 1); }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: n === i ? 1 : 0, transition: "opacity .6s ease" }} />
        ))}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, #000 100%)" }} />
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 24px calc(env(safe-area-inset-bottom) + 28px)", boxSizing: "border-box" }}>
        <div key={s.key} className="fx-screen">
          <div style={{ color: "var(--gold)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.kicker}</div>
          <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.05, textTransform: "uppercase", marginTop: 6 }}>{s.title}</div>
          <div style={{ fontSize: 16, lineHeight: 1.5, color: "rgba(255,255,255,.62)", marginTop: 12, textAlign: "justify", minHeight: 96 }}>{s.body}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "30px 0 22px" }}>
          {SLIDES.map((sl, n) => (
            <button key={sl.key} onClick={() => go(n)} aria-label={`Slide ${n + 1}`}
              style={{ width: 8, height: 8, padding: 0, borderRadius: "50%", border: "none", cursor: "pointer", background: n === i ? "#fff" : "rgba(255,255,255,.35)", transition: "background .2s" }} />
          ))}
        </div>
        <button onClick={onLogin} className="pressable"
          style={{ width: "100%", height: 54, borderRadius: 999, border: "none", background: "#fff", color: "#000", fontSize: 17, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
          Login
        </button>
      </div>
    </div>
  );
}
