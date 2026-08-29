import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { isTimedExercise } from "../../lib/browser.js";
import { getVideoThumb } from "../../lib/exerciseVideos.js";
import { fmtExerciseSummary, lastSessionSetsFor, suggestProgression } from "../../lib/trainingLogs.js";
import { SetLogRows } from "./SetLogRows.jsx";

const GROUP_LETTERS = "ABCDEFGH";

// A superset step: 2+ exercises sharing a block, logged by alternating
// between them. Each exercise keeps its own entry/sets exactly like a normal
// exercise (see groupSessionSteps in lib/trainingLogs.js) - this component
// only changes which entry is currently visible, and that choice is local,
// unsaved screen state.
export function SupersetLogger({ group, exById, logsBefore, rpePickerFor, setRpePickerFor, patchSet, addSet, toggleDone, onPlayVideo, onExit }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const active = Math.min(activeIdx, group.length - 1);
  const entry = group[active];
  const meta = exById[entry.exerciseId];
  const ex = meta?.ex || {};
  const effectiveName = entry.substitutedName || entry.name;
  const timed = isTimedExercise(effectiveName);
  const lastSets = lastSessionSetsFor(logsBefore, effectiveName);
  const prog = suggestProgression(lastSets);
  const thumb = getVideoThumb(ex.videoUrl);
  const letters = group.map((_, i) => GROUP_LETTERS[i] || String(i + 1));

  function selectTab(i) { setActiveIdx(i); setJustCompleted(false); }
  function handleToggleDone(en, si) {
    const marking = !en.sets[si].done;
    toggleDone(en, si);
    setJustCompleted(marking);
  }

  const nextLabel = letters[(active + 1) % group.length];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onExit} style={{ background: "none", border: "none", color: BRAND.text, fontSize: 20, fontWeight: 500, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.16em" }}>Superset</div>
        <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "5px 11px", fontWeight: 500, fontSize: 12, color: BRAND.text }}>{letters.join(" + ")}</div>
      </div>

      {thumb ? (
        <button onClick={() => onPlayVideo(thumb.videoId, effectiveName)} style={{ width: "100%", padding: 0, border: "none", borderRadius: BRAND.radiusCard, overflow: "hidden", cursor: "pointer", display: "block", position: "relative", background: "#ffffff" }}>
          <div style={{ position: "relative", height: 168 }}>
            <img src={thumb.thumb} alt="Exercise" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,.75)", border: "2px solid #000", display: "grid", placeItems: "center", color: "#000", fontSize: 20 }}>▶</div>
            </div>
          </div>
        </button>
      ) : (
        <div style={{ width: "100%", height: 168, borderRadius: BRAND.radiusCard, background: "#ffffff", display: "grid", placeItems: "center" }}>
          <div style={{ fontFamily: BRAND.sans, color: "#000", fontWeight: 500, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.4 }}>No media</div>
        </div>
      )}

      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.1 }}>{effectiveName}</div>
        <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 4 }}>{fmtExerciseSummary(ex) || "—"}</div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {group.map((en, i) => {
          const enActive = i === active;
          const done = en.sets.filter((s) => s.done).length;
          return (
            <button key={en.id} onClick={() => selectTab(i)} style={{ flex: 1, minWidth: 0, display: "grid", gap: 6, justifyItems: "center", padding: "10px 8px", borderRadius: BRAND.radiusControl, cursor: "pointer", background: enActive ? `color-mix(in srgb, ${BRAND.blue} 18%, transparent)` : BRAND.card2, border: `1.5px solid ${enActive ? BRAND.blue : BRAND.line}` }}>
              <div style={{ fontFamily: BRAND.sans, color: enActive ? BRAND.blue : BRAND.muted, fontWeight: 500, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{letters[i]} · {en.substitutedName || en.name}</div>
              <div style={{ display: "flex", gap: 4 }}>
                {en.sets.map((s, si) => (
                  <div key={si} style={{ width: 6, height: 6, borderRadius: "50%", background: s.done ? BRAND.green : BRAND.line }} />
                ))}
              </div>
              <div style={{ fontFamily: BRAND.sans, color: BRAND.dim, fontSize: 10, fontWeight: 500 }}>{done}/{en.sets.length}</div>
            </button>
          );
        })}
      </div>

      <SetLogRows entry={entry} timed={timed} lastSets={lastSets} prog={prog} rpePickerFor={rpePickerFor} setRpePickerFor={setRpePickerFor} patchSet={patchSet} addSet={addSet} toggleDone={handleToggleDone} doneColor={BRAND.green} />

      {justCompleted && (
        <div style={{ fontFamily: BRAND.sans, textAlign: "center", color: BRAND.blue, fontSize: 12, fontWeight: 500 }}>Tap {nextLabel} for the next set</div>
      )}
    </div>
  );
}
