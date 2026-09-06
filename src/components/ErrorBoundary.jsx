import { Component } from "react";
import { BRAND } from "../theme/tokens.js";

// The app had no error boundary anywhere - a single uncaught render error in
// ANY screen (a null field on unexpected data, a bad API response shape,
// etc.) unmounts React's entire tree with no warning, which from a client's
// side looks exactly like "the app closed" - it's just gone, no message.
// This catches that class of crash and offers a reload instead of a blank
// screen. It cannot catch errors in event handlers or async code (React's
// error boundaries never do - see main.jsx for the sibling fixes covering
// those: a stale-deploy reload-once and a window "error"/"unhandledrejection"
// fallback for anything a render-time catch can't reach).
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Forge crashed:", error, info?.componentStack);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 700, marginBottom: 10 }}>Something went wrong</div>
          <div style={{ color: BRAND.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>Forge hit a snag and needs to reload. Your data is saved - nothing should be lost.</div>
          <button onClick={() => window.location.reload()} style={{ width: "100%", background: BRAND.gold, color: BRAND.btnInk, border: "none", borderRadius: 14, padding: 14, fontFamily: BRAND.sans, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Reload Forge
          </button>
        </div>
      </div>
    );
  }
}
