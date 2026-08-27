import { useEffect, useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "./Button.jsx";
import { inputStyle } from "./Field.jsx";
import { modalBackdrop } from "./modal.js";

// Promise-based replacements for window.confirm()/window.prompt(): await
// confirmDialog("...") resolves true/false, await promptDialog("...", "default")
// resolves the typed string or null, once the user acts in the in-app modal
// rendered by <ConfirmHost />. Both fall back to the native dialog if the
// host isn't mounted yet, so neither is a hard dependency.
let listener = null;
export function confirmDialog(message, opts = {}) {
  return new Promise((resolve) => {
    if (!listener) { resolve(window.confirm(message)); return; }
    listener({ mode: "confirm", message, opts, resolve });
  });
}
export function promptDialog(message, defaultValue = "", opts = {}) {
  return new Promise((resolve) => {
    if (!listener) { resolve(window.prompt(message, defaultValue)); return; }
    listener({ mode: "prompt", message, defaultValue, opts, resolve });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState(null);
  const [text, setText] = useState("");
  useEffect(() => {
    listener = (p) => { setPending(p); setText(p.mode === "prompt" ? (p.defaultValue || "") : ""); };
    return () => { listener = null; };
  }, []);
  if (!pending) return null;
  const isPrompt = pending.mode === "prompt";
  function choose(result) {
    pending.resolve(isPrompt ? (result ? text.trim() || null : null) : result);
    setPending(null);
  }
  const { message, opts } = pending;
  return (
    <div style={modalBackdrop()} onClick={() => choose(false)}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 20, padding: 20 }}>
        {opts.title && <div style={{ fontSize: 18, fontWeight: 1000, textTransform: "uppercase", marginBottom: 8 }}>{opts.title}</div>}
        <div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{message}</div>
        {isPrompt && <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") choose(true); }} style={{ ...inputStyle(), marginTop: 12 }} />}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Button variant="dark" onClick={() => choose(false)} style={{ flex: 1 }}>{opts.cancelLabel || "Cancel"}</Button>
          <Button variant={opts.danger ? "red" : "gold"} onClick={() => choose(true)} style={{ flex: 1 }}>{opts.confirmLabel || (isPrompt ? "Save" : "Confirm")}</Button>
        </div>
      </div>
    </div>
  );
}
