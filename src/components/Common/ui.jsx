import React from "react";
import { BRAND } from "./constants.js";

function isTabletLike() {
  return typeof window !== "undefined" && window.innerWidth >= 768;
}

function responsivePadding(defaultPadding, tabletPadding) {
  return isTabletLike() ? tabletPadding : defaultPadding;
}

export const textareaStyle = (extra = {}) => ({
  width: "100%",
  minHeight: 90,
  background: "#111",
  border: "1px solid #333",
  borderRadius: 12,
  color: "#fff",
  padding: responsivePadding("12px", "14px"),
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  fontSize: isTabletLike() ? 15 : 14,
  ...extra,
});

export function inputStyle(extra = {}) {
  return { width: "100%", minWidth: 0, boxSizing: "border-box", background: "#0b0c10", border: `1px solid ${BRAND.line}`, color: BRAND.text, borderRadius: 12, padding: responsivePadding("11px 12px", "12px 14px"), outline: "none", fontSize: isTabletLike() ? 15 : 14, minHeight: isTabletLike() ? 46 : 42, ...extra };
}

export function Button({ children, onClick, variant = "gold", type = "button", disabled = false, style = {} }) {
  const bg = variant === "ghost" ? "transparent" : variant === "red" ? BRAND.red : variant === "dark" ? BRAND.card2 : BRAND.gold;
  const color = variant === "ghost" ? BRAND.text : variant === "red" ? "#fff" : variant === "dark" ? BRAND.text : "#050505";
  return React.createElement("button", { type, disabled, onClick, style: { background: bg, color, border: variant === "ghost" ? `1px solid ${BRAND.line}` : "none", borderRadius: 12, padding: responsivePadding("10px 14px", "12px 16px"), fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, minHeight: isTabletLike() ? 46 : 40, fontSize: isTabletLike() ? 15 : 14, ...style } }, children);
}

export function Field({ label, value, onChange, type = "text", placeholder = "", textarea = false }) {
  return React.createElement("label", { style: { display: "block" } },
    React.createElement("div", { style: { fontSize: 11, color: BRAND.muted, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 } }, label),
    textarea
      ? React.createElement("textarea", { value: value || "", onChange: (e) => onChange(e.target.value), placeholder, style: inputStyle({ minHeight: 95, resize: "vertical" }) })
      : React.createElement("input", { type, value: value || "", onChange: (e) => onChange(e.target.value), placeholder, style: inputStyle() })
  );
}

export function Card({ children, style = {}, onClick }) {
  return React.createElement("div", { onClick, style: { width: "100%", minWidth: 0, boxSizing: "border-box", background: `linear-gradient(180deg, ${BRAND.card}, #101116)`, border: `1px solid ${BRAND.line}`, borderRadius: isTabletLike() ? 20 : 18, padding: responsivePadding(16, 20), boxShadow: "0 16px 40px rgba(0,0,0,.25)", ...style } }, children);
}
