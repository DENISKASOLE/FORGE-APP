// "Swap exercise" control used by the workout logger (single and superset).
// Client: only the coach's chosen substitutes. Coach: no limit.
import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { inputStyle } from "../../components/ui/Field.jsx";
import { swapOptions } from "../../lib/substitutes.js";

const pill = { background: BRAND.panel, color: BRAND.text, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "8px 12px", fontWeight: 500, cursor: "pointer", fontSize: 13 };

export function SwapExercise({ entry, library, programSubs, isCoach, open, onToggle, onPick }) {
  const [query, setQuery] = useState("");
  const { options, allowTyped, total } = swapOptions({ originalName: entry.name, library, programSubs, isCoach, query });
  const showSearch = isCoach || total > 6;
  return (
    <div>
      <button onClick={() => { onToggle(); setQuery(""); }} style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, color: BRAND.muted, fontWeight: 500, cursor: "pointer", fontSize: 12, padding: "9px 14px" }}>{open ? "Cancel" : "Swap exercise"}</button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {!isCoach && total === 0 ? (
            <div style={{ fontSize: 13, color: BRAND.muted, lineHeight: 1.5 }}>Your coach hasn't set any swaps for this exercise. Message your coach if you can't do it today.</div>
          ) : (
            <>
              {!isCoach && <div style={{ fontSize: 12, color: BRAND.muted, marginBottom: 6 }}>Swaps your coach approved for {entry.name}:</div>}
              {showSearch && <input placeholder={isCoach ? "Search any exercise..." : "Search swaps..."} value={query} onChange={(e) => setQuery(e.target.value)} style={inputStyle()} />}
            </>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {entry.substitutedName && <button onClick={() => onPick("")} style={pill}>Use original: {entry.name}</button>}
            {options.map((n) => <button key={n} onClick={() => onPick(n)} style={{ ...pill, ...(entry.substitutedName === n ? { borderColor: "var(--accent)", color: "var(--accent)" } : null) }}>{n}</button>)}
            {isCoach && allowTyped && query.trim() && <button onClick={() => onPick(query.trim())} style={{ ...pill, background: BRAND.gold, color: BRAND.btnInk, border: "none" }}>Use “{query.trim()}”</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// Chip picker for choosing substitute exercises (library + program builder).
export function SubstitutePicker({ value = [], onChange, names = [], exclude = "", hint }) {
  const [q, setQ] = useState("");
  const chosen = value || [];
  const lower = (x) => String(x || "").toLowerCase();
  const matches = q.trim() ? names.filter((n) => lower(n).includes(lower(q)) && !chosen.includes(n) && lower(n) !== lower(exclude)).slice(0, 8) : [];
  return (
    <div>
      {hint && <div style={{ color: BRAND.dim, fontSize: 11, marginBottom: 6, lineHeight: 1.4 }}>{hint}</div>}
      {chosen.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {chosen.map((n) => (
            <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "color-mix(in srgb, var(--accent) 10%, var(--card))", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 999, padding: "5px 6px 5px 10px", fontSize: 12, fontWeight: 600 }}>
              {n}
              <button type="button" aria-label={`Remove ${n}`} onClick={() => onChange(chosen.filter((x) => x !== n))} style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 13, padding: "0 2px" }}>✕</button>
            </span>
          ))}
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an exercise to add as a swap..." style={inputStyle()} />
      {matches.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {matches.map((n) => <button key={n} type="button" onClick={() => { onChange([...chosen, n]); setQ(""); }} style={pill}>+ {n}</button>)}
        </div>
      )}
    </div>
  );
}
