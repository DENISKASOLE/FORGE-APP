// Shared screen building blocks (Nov 2026) so Home, Train, Fuel and
// Progress look and feel the same: page header, pill switches, the Home-
// style day strip and the flat card. Colour rule (Denis): the deep teal is
// used sparingly - solid only for today's date and one main button per
// screen; selected switches and tags use a light teal tint.
import { BRAND } from "../../theme/tokens.js";
import { screenLabel, tint } from "./screenStyles.js";


export function PageHeader({ kicker, title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        {kicker && <div style={screenLabel}>{kicker}</div>}
        <div style={{ fontFamily: BRAND.display, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: BRAND.text, margin: "4px 0 2px", lineHeight: 1.1 }}>{title}</div>
        {sub && <div style={{ fontSize: 14, color: BRAND.muted }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// Pill switches, same as Progress' Trends / Photos / Check-in row.
export function PillSwitch({ items, value, onChange, style }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", minWidth: 0, paddingBottom: 2, ...style }}>
      {items.map(([k, label, extra]) => {
        const on = k === value;
        return (
          <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={on} ref={extra?.ref}
            style={{ flexShrink: 0, fontFamily: BRAND.sans, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".12em", whiteSpace: "nowrap", padding: "9px 14px", borderRadius: 999, cursor: "pointer",
              color: on ? "var(--accent)" : BRAND.muted, background: on ? tint() : BRAND.card2, border: `1px solid ${on ? "var(--accent)" : BRAND.line}` }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Home-style day strip: Mon..Sun, the selected day in a teal box, an
// optional status dot under each day.
export function DayStrip({ days, value, onSelect, todayISO }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
      {days.map((d) => {
        const on = d.iso === value;
        const future = d.iso > todayISO;
        return (
          <button key={d.iso} type="button" onClick={() => onSelect && onSelect(d)} aria-pressed={on} aria-label={d.label || d.iso}
            style={{ padding: "8px 0 7px", borderRadius: 14, border: "none", cursor: onSelect ? "pointer" : "default", fontFamily: "inherit", background: on ? BRAND.btnBg : "transparent", color: on ? BRAND.btnInk : BRAND.muted, opacity: future && !on ? 0.5 : 1, fontSize: 12, fontWeight: 600 }}>
            {d.name}
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: on ? BRAND.btnInk : BRAND.text }}>{d.num}</div>
            <div style={{ width: 6, height: 6, borderRadius: 9, margin: "5px auto 0", background: d.dot ? (on ? BRAND.btnInk : d.dot) : "transparent" }} />
          </button>
        );
      })}
    </div>
  );
}
