import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { VideoPlayerModal } from "../../components/ui/VideoPlayerModal.jsx";
import { InjuryBanner } from "../../components/ui/InjuryBanner.jsx";
import { SetLogRows } from "./SetLogRows.jsx";
import { SupersetLogger } from "./SupersetLogger.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog, promptDialog } from "../../components/ui/ConfirmDialog.jsx";
import { useIsMobile, isTimedExercise } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { isoDate, startOfWeek, addDays } from "../../lib/dateUtils.js";
import { upsertSection, upsertTrainerData, loadTrainerTemplates } from "../../lib/clientData.js";
import { buildPdfDoc, downloadBlob, sharePdfBlob, safeFilename } from "../../lib/pdf.js";
import { updateClientRow } from "../../lib/cache.js";
import { getVideoThumb, DEFAULT_EXERCISE_VIDEOS } from "../../lib/exerciseVideos.js";
import { GOAL_OPTIONS } from "../../lib/constants.js";
import {
  fmtLoad, fmtSetTarget, fmtExerciseSummary, blockTitle, exerciseTag, parseSeconds, fmtClock,
  emptyTrainingLogs, startSession, sessionForWorkout, upsertSessionInLogs, setScoreV2, fmtLoggedSet,
  suggestProgression, lastSessionSetsFor, exerciseHistoryV2, sessionStatsV2, detectSessionPBs, groupSessionSteps,
} from "../../lib/trainingLogs.js";
import {
  newSet, newExercise, newBlock, newWorkout, newProgWeek, newProgram, cloneWithNewIds,
  DOW_LETTER, DOW_LABEL, programStart, dayDate, restNoteFor, weekDayMap, workoutForDay,
  unassignedWorkouts, normalizeProgramDays, buildProgramDays, currentProgramWeek,
  exerciseCountOf, findPrescribedExercise,
} from "../../lib/programModel.js";
import { EXERCISE_LIBRARY } from "./exerciseLibraryData.js";

async function loadExerciseLibraryData(trainerId) {
  if (!trainerId) return [];
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "custom_exercise_library").maybeSingle();
  return Array.isArray(data?.data?.items) ? data.data.items : [];
}

export async function downloadProgramPDF2(client, program) {
  if (!program) return;
  const sections = (program.weeks || []).map((w) => ({
    heading: `Week ${w.weekNum}${w.label ? ` — ${w.label}` : ""}${w.focus ? `  ·  ${w.focus}` : ""}${w.targetRpe ? `  ·  Target RPE ${w.targetRpe}` : ""}`,
    lines: (w.workouts || []).map((wo) => `${wo.name}`),
    table: (w.workouts || []).flatMap((wo) => (wo.blocks || []).flatMap((b, bi) => (b.exercises || []).map((ex, ei) => [exerciseTag(b, bi, ei), ex.name, fmtExerciseSummary(ex), ex.note || ""]))),
  }));
  const subtitle = `Client: ${client?.name || ""}  ·  Goal: ${program.goal || ""}  ·  ${program.weeks?.length || 0} weeks`;
  const programTitle = `${client?.name || "Client"}'s Program`;
  const blob = await buildPdfDoc(programTitle, subtitle, sections);
  return { blob, filename: `${safeFilename(programTitle)}.pdf` };
}

export function ExerciseLibraryScreen({ trainerId, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => { loadExerciseLibraryData(trainerId).then((data) => { setItems(data); setLoading(false); }); }, [trainerId]);

  async function persist(next) {
    setItems(next);
    await upsertTrainerData(trainerId, "custom_exercise_library", { items: next });
  }
  async function saveItem(form) {
    if (editingItem) await persist(items.map((it) => (it.id === editingItem.id ? { ...it, ...form } : it)));
    else await persist([{ id: uid(), ...form }, ...items]);
    setShowAdd(false); setEditingItem(null);
  }
  async function remove(id) { await persist(items.filter((it) => it.id !== id)); }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px" }}>‹ Back</Button>
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 500 }}>Exercise Library</div>
        <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>Add your own exercises with a video link, so they're ready to pick - with the video attached - whenever you're building a program.</div>
      </div>
      <Button onClick={() => { setEditingItem(null); setShowAdd(true); }} style={{ width: "100%" }}>+ Add Exercise</Button>

      {loading ? (
        <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>
      ) : items.length === 0 ? (
        <Card><div style={{ color: BRAND.muted }}>No custom exercises yet. Add your first one above.</div></Card>
      ) : (
        items.map((it) => {
          const t = getVideoThumb(it.videoUrl);
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, background: BRAND.card, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 12 }}>
              {t ? <img src={t.thumb} alt="Exercise video" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: BRAND.radiusControl, flexShrink: 0 }} /> : <div style={{ width: 52, height: 52, borderRadius: BRAND.radiusControl, background: BRAND.card2, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{it.name}</div>
                <div style={{ color: it.videoUrl ? BRAND.blue : BRAND.dim, fontSize: 11, fontWeight: 400 }}>{it.videoUrl ? "Video attached" : "No video"}</div>
              </div>
              <button onClick={() => { setEditingItem(it); setShowAdd(true); }} style={{ background: "transparent", border: "none", color: BRAND.gold, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>Edit</button>
              <button onClick={() => remove(it.id)} style={{ background: "transparent", border: "none", color: BRAND.yellow, fontWeight: 500, fontSize: 15, cursor: "pointer" }}>x</button>
            </div>
          );
        })
      )}
      {showAdd && <AddCustomExerciseModal initial={editingItem} onClose={() => { setShowAdd(false); setEditingItem(null); }} onSave={saveItem} />}
    </div>
  );
}
export function AddCustomExerciseModal({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || "");
  const [saving, setSaving] = useState(false);
  const thumb = getVideoThumb(videoUrl);
  async function save() {
    if (!name.trim()) { showToast("Give this exercise a name.", "warn"); return; }
    setSaving(true);
    await onSave({ name: name.trim(), videoUrl: videoUrl.trim() });
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{initial ? "Edit Exercise" : "New Exercise"}</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <Field label="Exercise name" value={name} onChange={setName} placeholder="e.g. Cable Crossover" />
        <div style={{ marginTop: 10 }}><Field label="Video link" value={videoUrl} onChange={setVideoUrl} placeholder="https://..." /></div>
        {thumb && <img src={thumb.thumb} alt="Exercise video" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: BRAND.radiusControl, border: `${BRAND.hairline} solid ${BRAND.line}`, marginTop: 8 }} />}
        <Button onClick={save} disabled={saving} style={{ width: "100%", marginTop: 14 }}>{saving ? "Saving..." : initial ? "Save Changes" : "+ Add Exercise"}</Button>
      </Card>
    </div>
  );
}
export function ExerciseLibraryEditor({ trainerId, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => { loadExerciseLibraryData(trainerId).then((data) => { setItems(data); setLoading(false); }); }, [trainerId]);

  async function persist(next) {
    setItems(next);
    await upsertTrainerData(trainerId, "custom_exercise_library", { items: next });
  }
  async function addOrUpdate() {
    if (!name.trim()) { showToast("Enter an exercise name.", "warn"); return; }
    setSaving(true);
    if (editingId) {
      await persist(items.map((it) => (it.id === editingId ? { ...it, name: name.trim(), videoUrl: videoUrl.trim() } : it)));
    } else {
      await persist([{ id: uid(), name: name.trim(), videoUrl: videoUrl.trim() }, ...items]);
    }
    setName(""); setVideoUrl(""); setEditingId(null); setSaving(false);
  }
  function startEdit(it) { setEditingId(it.id); setName(it.name); setVideoUrl(it.videoUrl || ""); }
  function cancelEdit() { setEditingId(null); setName(""); setVideoUrl(""); }
  async function remove(id) { await persist(items.filter((it) => it.id !== id)); if (editingId === id) cancelEdit(); }

  const draftThumb = getVideoThumb(videoUrl);

  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 500 }}>Exercise Library</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 14 }}>Add an exercise with a video link here, and it'll show up ready to pick - with the video already attached - whenever you're building a program.</div>

        <Field label="Exercise name" value={name} onChange={setName} placeholder="e.g. Cable Crossover" />
        <div style={{ marginTop: 10 }}>
          <Field label="Video link" value={videoUrl} onChange={setVideoUrl} placeholder="https://..." />
        </div>
        {draftThumb && <img src={draftThumb.thumb} alt="Exercise video" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: BRAND.radiusControl, border: `${BRAND.hairline} solid ${BRAND.line}`, marginTop: 8 }} />}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button onClick={addOrUpdate} disabled={saving} style={{ flex: 1 }}>{saving ? "Saving..." : editingId ? "Update Exercise" : "+ Add Exercise"}</Button>
          {editingId && <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>}
        </div>

        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500, margin: "18px 0 8px", textTransform: "uppercase" }}>Your Exercises ({items.length})</div>
        {loading ? <div style={{ color: BRAND.dim }}>Loading...</div> : items.length === 0 ? <div style={{ color: BRAND.dim, fontSize: 13 }}>No custom exercises yet.</div> : (
          items.map((it) => {
            const t = getVideoThumb(it.videoUrl);
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, background: BRAND.card2, borderRadius: BRAND.radiusControl, padding: 10, marginBottom: 8 }}>
                {t ? <img src={t.thumb} alt="Exercise video" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: BRAND.radiusControl, flexShrink: 0 }} /> : <div style={{ width: 52, height: 52, borderRadius: BRAND.radiusControl, background: BRAND.panel, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{it.name}</div>
                  <div style={{ color: BRAND.dim, fontSize: 11 }}>{it.videoUrl ? "Video attached" : "No video"}</div>
                </div>
                <button onClick={() => startEdit(it)} style={{ background: "transparent", border: "none", color: BRAND.gold, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>Edit</button>
                <button onClick={() => remove(it.id)} style={{ background: "transparent", border: "none", color: BRAND.yellow, fontWeight: 500, fontSize: 15, cursor: "pointer" }}>x</button>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
export function BlockEditor({ block, index, onChange, onDelete, onMoveUp, onMoveDown, isMobile, trainerId }) {
  const [addSearch, setAddSearch] = useState("");
  const [openEx, setOpenEx] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [pickSource, setPickSource] = useState("library");
  const [customLibrary, setCustomLibrary] = useState([]);
  useEffect(() => { if (trainerId) loadExerciseLibraryData(trainerId).then(setCustomLibrary); }, [trainerId, showLibrary]);
  const customVideoMap = Object.fromEntries(customLibrary.filter((it) => it.videoUrl).map((it) => [it.name, it.videoUrl]));
  const exerciseLibrary = useExerciseLibrary();
  const customNames = customLibrary.map((it) => it.name);
  const suggestions = !addSearch ? [] : (pickSource === "mine" ? customNames : exerciseLibrary).filter((n) => n.toLowerCase().includes(addSearch.toLowerCase())).slice(0, 20);
  function patch(p) { onChange({ ...block, ...p }); }
  function patchEx(ei, p) { patch({ exercises: block.exercises.map((e, i) => (i === ei ? { ...e, ...p } : e)) }); }
  function addExercise(name) { const ex = newExercise(name); if (customVideoMap[name]) ex.videoUrl = customVideoMap[name]; patch({ exercises: [...block.exercises, ex] }); setAddSearch(""); }
  function deleteEx(ei) { patch({ exercises: block.exercises.filter((_, i) => i !== ei) }); }
  function moveEx(ei, dir) { const j = ei + dir; if (j < 0 || j >= block.exercises.length) return; const next = [...block.exercises]; [next[ei], next[j]] = [next[j], next[ei]]; patch({ exercises: next }); }
  function patchSet(ei, si, p) { patchEx(ei, { sets: block.exercises[ei].sets.map((s, i) => (i === si ? { ...s, ...p } : s)) }); }
  function addSet(ei) { const sets = block.exercises[ei].sets; const last = sets[sets.length - 1]; patchEx(ei, { sets: [...sets, { id: uid(), targetReps: last?.targetReps || "", targetLoad: last?.targetLoad || "", targetRpe: last?.targetRpe || "" }] }); }
  function removeSet(ei, si) { const sets = block.exercises[ei].sets; if (sets.length <= 1) return; patchEx(ei, { sets: sets.filter((_, i) => i !== si) }); }
  return (
    <>
    <div style={{ background: BRAND.card2, border: `1px solid ${block.type === "straight" ? BRAND.line : BRAND.gold}`, borderRadius: BRAND.radiusCard, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: BRAND.gold, fontWeight: 500 }}>{blockTitle(block, index)}</div>
          <select value={block.type} onChange={(e) => patch({ type: e.target.value })} style={inputStyle({ padding: "6px 8px", width: "auto" })}>
            <option value="straight">Straight sets</option><option value="superset">Superset</option><option value="circuit">Circuit</option>
          </select>
          {block.type === "circuit" && <input value={block.rounds || ""} onChange={(e) => patch({ rounds: Number(e.target.value || 1) })} placeholder="Rounds" style={inputStyle({ width: 70 })} />}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowLibrary(true)} style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "5px 10px", color: BRAND.gold, fontWeight: 500, fontSize: 11, cursor: "pointer" }}>Exercise Library</button>
          <button onClick={onMoveUp} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 500, cursor: "pointer", padding: "2px 5px" }}>▲</button>
          <button onClick={onMoveDown} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 500, cursor: "pointer", padding: "2px 5px" }}>▼</button>
          <button onClick={onDelete} style={{ background: "transparent", border: "none", color: BRAND.yellow, fontWeight: 500, cursor: "pointer", padding: "2px 5px" }}>x</button>
        </div>
      </div>
      {showLibrary && <ExerciseLibraryEditor trainerId={trainerId} onClose={() => setShowLibrary(false)} />}
      {block.exercises.map((ex, ei) => {
        const open = openEx === ei;
        return (
          <div key={ex.id} style={{ borderTop: `${BRAND.hairline} solid ${BRAND.line}`, marginTop: 10, paddingTop: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
              <div style={{ background: BRAND.gold, color: BRAND.btnInk, borderRadius: BRAND.radiusControl, padding: "4px 8px", fontWeight: 500, fontSize: 12 }}>{exerciseTag(block, index, ei)}</div>
              <input value={ex.name} onChange={(e) => patchEx(ei, { name: e.target.value })} style={inputStyle({ fontWeight: 500 })} />
              <div style={{ display: "flex" }}>
                <button onClick={() => moveEx(ei, -1)} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 500, cursor: "pointer", padding: "2px 5px" }}>▲</button>
                <button onClick={() => moveEx(ei, 1)} style={{ background: "transparent", border: "none", color: BRAND.muted, fontWeight: 500, cursor: "pointer", padding: "2px 5px" }}>▼</button>
                <button onClick={() => setOpenEx(open ? null : ei)} style={{ background: "transparent", border: "none", color: BRAND.gold, fontWeight: 500, cursor: "pointer", padding: "2px 5px" }}>{open ? "-" : "..."}</button>
                <button onClick={() => deleteEx(ei)} style={{ background: "transparent", border: "none", color: BRAND.yellow, fontWeight: 500, cursor: "pointer", padding: "2px 5px" }}>x</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, minmax(90px, 160px))", gap: 8, marginTop: 8 }}>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, marginBottom: 3 }}>Load type</div><select value={ex.loadType || "kg"} onChange={(e) => patchEx(ei, { loadType: e.target.value })} style={inputStyle()}>{["kg", "%1RM", "RPE", "BW"].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, marginBottom: 3 }}>Tempo</div><input value={ex.tempo || ""} onChange={(e) => patchEx(ei, { tempo: e.target.value })} placeholder="3010" style={inputStyle()} /></label>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, marginBottom: 3 }}>Rest</div><input value={ex.rest || ""} onChange={(e) => patchEx(ei, { rest: e.target.value })} placeholder="90s" style={inputStyle()} /></label>
            </div>
            <div style={{ marginTop: 8 }}>
              {ex.sets.map((s, si) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "34px 1fr 1fr 64px 26px" : "44px 1fr 1fr 90px 30px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <div style={{ color: BRAND.muted, fontWeight: 500 }}>S{si + 1}</div>
                  <input value={s.targetReps || ""} onChange={(e) => patchSet(ei, si, { targetReps: e.target.value })} placeholder="Reps / time" style={inputStyle()} />
                  <input value={s.targetLoad || ""} onChange={(e) => patchSet(ei, si, { targetLoad: e.target.value })} placeholder={ex.loadType === "BW" ? "+kg" : ex.loadType || "kg"} style={inputStyle()} />
                  <input value={s.targetRpe || ""} onChange={(e) => patchSet(ei, si, { targetRpe: e.target.value })} placeholder="RPE" style={inputStyle()} />
                  <button onClick={() => removeSet(ei, si)} style={{ background: "transparent", border: "none", color: BRAND.yellow, fontWeight: 500, cursor: "pointer" }}>x</button>
                </div>
              ))}
              <Button variant="dark" onClick={() => addSet(ei)} style={{ padding: "6px 12px", fontSize: 12 }}>+ Set</Button>
            </div>
            {open && <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginTop: 8 }}>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, marginBottom: 3 }}>Coach note (client sees this)</div><input value={ex.note || ""} onChange={(e) => patchEx(ei, { note: e.target.value })} placeholder="Cue, setup, intent..." style={inputStyle()} /></label>
              <label><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, marginBottom: 3 }}>Video link</div><input value={ex.videoUrl || ""} onChange={(e) => patchEx(ei, { videoUrl: e.target.value })} placeholder="https://..." style={inputStyle()} />
                {getVideoThumb(ex.videoUrl) && (() => { const t = getVideoThumb(ex.videoUrl); return <button onClick={() => setPlayingVideo({ videoId: t.videoId, title: ex.name })} style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", display: "inline-block", position: "relative", marginTop: 8 }}><img src={t.thumb} alt="Exercise video" style={{ width: 140, height: 79, objectFit: "cover", borderRadius: BRAND.radiusControl, border: `${BRAND.hairline} solid ${BRAND.line}` }} /><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", color: "#fff", fontSize: 12 }}>▶</div></div></button>; })()}
              </label>
            </div>}
          </div>
        );
      })}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", gap: 6, background: BRAND.panel, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: 3, marginBottom: 8 }}>
          <button onClick={() => setPickSource("library")} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", background: pickSource === "library" ? BRAND.gold : "transparent", color: pickSource === "library" ? BRAND.btnInk : BRAND.muted, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>Exercise Library</button>
          <button onClick={() => setPickSource("mine")} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", background: pickSource === "mine" ? BRAND.gold : "transparent", color: pickSource === "mine" ? BRAND.btnInk : BRAND.muted, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>My Exercises{customLibrary.length ? ` (${customLibrary.length})` : ""}</button>
        </div>
        <input placeholder={pickSource === "mine" ? "Search your exercises..." : (block.exercises.length ? "Add exercise to this block..." : "Search first exercise...")} value={addSearch} onChange={(e) => setAddSearch(e.target.value)} style={inputStyle()} />
        {pickSource === "mine" && customLibrary.length === 0 && (
          <div style={{ marginTop: 8, textAlign: "center", padding: 12 }}>
            <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 8 }}>No custom exercises yet.</div>
            <button onClick={() => setShowLibrary(true)} style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "8px 14px", color: BRAND.gold, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>+ Add your first exercise</button>
          </div>
        )}
        {addSearch && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {suggestions.map((n) => <button key={n} onClick={() => addExercise(n)} style={{ background: BRAND.panel, color: BRAND.text, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 500, cursor: "pointer" }}>+ {n}</button>)}
          {pickSource === "library" && <button onClick={() => addExercise(addSearch.trim())} style={{ background: BRAND.gold, color: BRAND.btnInk, border: "none", borderRadius: 999, padding: "6px 10px", fontWeight: 500, cursor: "pointer" }}>+ Custom: {addSearch.trim()}</button>}
        </div>}
      </div>
      {showLibrary && <ExerciseLibraryEditor trainerId={trainerId} onClose={() => setShowLibrary(false)} />}
    </div>
    {playingVideo && <VideoPlayerModal videoId={playingVideo.videoId} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}
    </>
  );
}

// ---------- Coach: Program Builder ----------
export function ProgramBuilder({ client, program, onClose, onSave }) {
  const isMobile = useIsMobile(520);
  const [p, setP] = useState(() => normalizeProgramDays(program?.version === 2 ? JSON.parse(JSON.stringify(program)) : newProgram(`${client.name?.split(" ")[0] || "Client"}'s Program`, client.goal || "General Fitness", 4)));
  const [wk, setWk] = useState(0);
  const [wo, setWo] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [savingTpl, setSavingTpl] = useState(false);
  const trainerId = client.trainer_id;
  useEffect(() => {
    let active = true;
    if (!trainerId) return;
    loadTrainerTemplates(trainerId).then((list) => { if (active) setTemplates(list); });
    return () => { active = false; };
  }, [trainerId]);
  async function loadTemplate(t) {
    if (!await confirmDialog(`Load "${t.name}"? This replaces the program you're editing. Logs are never touched.`, { confirmLabel: "Load" })) return;
    const copy = cloneWithNewIds(t.program);
    setP({ ...copy, id: uid(), name: p.name || copy.name, startDate: p.startDate || copy.startDate || isoDate(), templateId: t.id });
    setWk(0); setWo(0);
  }
  async function saveAsTemplate() {
    if (!trainerId) { showToast("No trainer linked to this client, so the template can't be saved.", "warn"); return; }
    const name = await promptDialog("Template name", p.name || "New Template", { title: "Save as Template" });
    if (!name) return;
    setSavingTpl(true);
    const entry = { id: uid(), name, goal: p.goal, weeks: p.weeks.length, savedAt: new Date().toISOString(), program: cloneWithNewIds(p) };
    const next = [entry, ...templates];
    setTemplates(next);
    await upsertTrainerData(trainerId, "templates", { templates: next });
    setSavingTpl(false);
    showToast(`Saved "${name}" to Templates.`, "success");
  }
  const week = p.weeks[Math.min(wk, p.weeks.length - 1)];
  const workout = week?.workouts[Math.min(wo, Math.max(0, (week?.workouts.length || 1) - 1))];
  const safeWk = p.weeks.indexOf(week);
  const safeWo = week ? week.workouts.indexOf(workout) : 0;
  function patchProgram(patch) { setP((prev) => ({ ...prev, ...patch })); }
  function patchWeek(patch) { setP((prev) => ({ ...prev, weeks: prev.weeks.map((w, i) => (i === safeWk ? { ...w, ...patch } : w)) })); }
  function patchWorkout(patch) { patchWeek({ workouts: week.workouts.map((w, i) => (i === safeWo ? { ...w, ...patch } : w)) }); }
  function addWeek() { setP((prev) => ({ ...prev, weeks: [...prev.weeks, newProgWeek(prev.weeks.length + 1)].map((w, i) => ({ ...w, weekNum: i + 1 })) })); setWk(p.weeks.length); }
  function duplicateWeek(i) { setP((prev) => { const copy = cloneWithNewIds(prev.weeks[i]); const weeks = [...prev.weeks.slice(0, i + 1), copy, ...prev.weeks.slice(i + 1)].map((w, j) => ({ ...w, weekNum: j + 1 })); return { ...prev, weeks }; }); }
  function deleteWeek(i) { setP((prev) => { const weeks = prev.weeks.filter((_, j) => j !== i).map((w, j) => ({ ...w, weekNum: j + 1 })); return { ...prev, weeks: weeks.length ? weeks : [newProgWeek(1)] }; }); setWk(0); setWo(0); }
  function copyWeekForward() { setP((prev) => ({ ...prev, weeks: prev.weeks.map((w, i) => (i > safeWk ? { ...cloneWithNewIds(prev.weeks[safeWk]), id: w.id, weekNum: w.weekNum, label: w.label, focus: w.focus, targetRpe: w.targetRpe } : w)) })); }
  function assignDay(dow, workoutId) {
    // One workout per day. Assigning a workout to a day pulls it off whatever day it was on.
    patchWeek({
      workouts: week.workouts.map((w) => {
        if (workoutId && w.id === workoutId) return { ...w, dayOfWeek: dow };
        if (Number(w.dayOfWeek) === dow) return { ...w, dayOfWeek: null };
        return w;
      }),
    });
  }
  function setRestNote(dow, note) { patchWeek({ restDays: { ...(week.restDays || {}), [dow]: note } }); }
  function addWorkout() { patchWeek({ workouts: [...week.workouts, newWorkout(`Workout ${week.workouts.length + 1}`)] }); setWo(week.workouts.length); }
  function duplicateWorkout(i) { const copy = cloneWithNewIds(week.workouts[i]); copy.name = `${copy.name} (copy)`; patchWeek({ workouts: [...week.workouts.slice(0, i + 1), copy, ...week.workouts.slice(i + 1)] }); }
  function deleteWorkout(i) { patchWeek({ workouts: week.workouts.filter((_, j) => j !== i) }); setWo(0); }
  function copyWorkoutToAllWeeks() { const src = week.workouts[safeWo]; setP((prev) => ({ ...prev, weeks: prev.weeks.map((w, i) => (i === safeWk ? w : { ...w, workouts: [...w.workouts, cloneWithNewIds(src)] })) })); }
  function addBlock(type) { patchWorkout({ blocks: [...workout.blocks, newBlock(type)] }); }
  function patchBlock(bi, next) { patchWorkout({ blocks: workout.blocks.map((b, i) => (i === bi ? next : b)) }); }
  function deleteBlock(bi) { patchWorkout({ blocks: workout.blocks.filter((_, i) => i !== bi) }); }
  function moveBlock(bi, dir) { const j = bi + dir; if (j < 0 || j >= workout.blocks.length) return; const next = [...workout.blocks]; [next[bi], next[j]] = [next[j], next[bi]]; patchWorkout({ blocks: next }); }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 1100, maxHeight: "94vh", overflow: "auto", padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 12 }}>
          <div><div style={{ fontSize: 24, fontWeight: 500, color: BRAND.gold }}>Program Builder</div><div style={{ color: BRAND.muted }}>Weeks → Workouts → Blocks. Logs live separately, so edit freely.</div></div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <InjuryBanner client={client} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 10 }}>
          <Field label="Program name (client sees this)" value={p.name} onChange={(v) => patchProgram({ name: v })} />
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.14em" }}>Goal</div><select value={p.goal} onChange={(e) => patchProgram({ goal: e.target.value })} style={inputStyle()}>{GOAL_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}</select></label>
          <Field label="Start date (drives the calendar)" type="date" value={p.startDate || ""} onChange={(v) => patchProgram({ startDate: v })} />
        </div>
        {templates.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) loadTemplate(t); }} style={inputStyle({ maxWidth: 260 })}>
              <option value="">Load from template...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.goal ? ` · ${t.goal}` : ""}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 12, paddingBottom: 4, alignItems: "center" }}>
          {p.weeks.map((w, i) => <Button key={w.id} variant={i === safeWk ? "gold" : "dark"} onClick={() => { setWk(i); setWo(0); }} style={{ flexShrink: 0 }}>W{w.weekNum}{w.label ? ` · ${w.label}` : ""}</Button>)}
          <Button variant="ghost" onClick={addWeek} style={{ flexShrink: 0 }}>+ Week</Button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Button variant="dark" onClick={() => duplicateWeek(safeWk)} style={{ fontSize: 12 }}>Duplicate W{week.weekNum}</Button>
          <Button variant="dark" onClick={copyWeekForward} style={{ fontSize: 12 }}>Copy W{week.weekNum} to following weeks</Button>
          <Button variant="dark" onClick={() => deleteWeek(safeWk)} style={{ fontSize: 12, color: BRAND.yellow }}>Delete W{week.weekNum}</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 2fr 100px", gap: 8, marginTop: 10 }}>
          <Field label="Phase label" value={week.label} onChange={(v) => patchWeek({ label: v })} />
          <Field label="Week focus" value={week.focus} onChange={(v) => patchWeek({ focus: v })} />
          <Field label="Target RPE" value={week.targetRpe} onChange={(v) => patchWeek({ targetRpe: v })} />
        </div>
        <div style={{ marginTop: 14, background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 12 }}>
          <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>Week {week.weekNum} schedule</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
              const assigned = workoutForDay(week, dow);
              const d = dayDate(p, week.weekNum, dow);
              return (
                <div key={dow} style={{ background: assigned ? BRAND.card : "transparent", border: `${BRAND.hairline} ${assigned ? "solid" : "dashed"} ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 7, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 500, letterSpacing: "0.14em" }}>{DOW_LABEL[dow - 1].toUpperCase()}</div>
                    <div style={{ fontWeight: 500, fontSize: 13, color: BRAND.text }}>{d.getDate()}</div>
                  </div>
                  <select value={assigned?.id || ""} onChange={(e) => assignDay(dow, e.target.value)} style={inputStyle({ padding: "6px 3px", fontSize: 11, borderRadius: BRAND.radiusControl, background: BRAND.panel })}>
                    <option value="">Rest</option>
                    {week.workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  {!assigned && <input value={restNoteFor(week, dow)} onChange={(e) => setRestNote(dow, e.target.value)} placeholder="Recovery" style={inputStyle({ padding: "6px 4px", fontSize: 10, borderRadius: BRAND.radiusControl, background: BRAND.panel })} />}
                </div>
              );
            })}
          </div>
          <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 400, marginTop: 8 }}>
            Any day without a workout is a rest day. Add a recovery note (steps, mobility, walk) and the client sees it on their calendar.
            {unassignedWorkouts(week).length > 0 && <span style={{ color: BRAND.gold }}> {unassignedWorkouts(week).length} workout{unassignedWorkouts(week).length === 1 ? " is" : "s are"} not on a day yet.</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 12, paddingBottom: 4, alignItems: "center" }}>
          {week.workouts.map((w, i) => <Button key={w.id} variant={i === safeWo ? "gold" : "dark"} onClick={() => setWo(i)} style={{ flexShrink: 0 }}>{w.name}</Button>)}
          <Button variant="ghost" onClick={addWorkout} style={{ flexShrink: 0 }}>+ Workout</Button>
        </div>
        {workout ? <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <Button variant="dark" onClick={() => duplicateWorkout(safeWo)} style={{ fontSize: 12 }}>Duplicate</Button>
            <Button variant="dark" onClick={copyWorkoutToAllWeeks} style={{ fontSize: 12 }}>Copy to all other weeks</Button>
            <Button variant="dark" onClick={() => deleteWorkout(safeWo)} style={{ fontSize: 12, color: BRAND.yellow }}>Delete workout</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 8, marginTop: 10 }}>
            <Field label="Workout name" value={workout.name} onChange={(v) => patchWorkout({ name: v })} />
            <Field label="Workout note (warm-up, intent...)" value={workout.note} onChange={(v) => patchWorkout({ note: v })} />
          </div>
          <div style={{ marginTop: 12 }}>
            {workout.blocks.map((b, bi) => <BlockEditor key={b.id} block={b} index={bi} isMobile={isMobile} trainerId={client.trainer_id} onChange={(next) => patchBlock(bi, next)} onDelete={() => deleteBlock(bi)} onMoveUp={() => moveBlock(bi, -1)} onMoveDown={() => moveBlock(bi, 1)} />)}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="dark" onClick={() => addBlock("straight")}>+ Exercise</Button>
              <Button variant="dark" onClick={() => addBlock("superset")}>+ Superset</Button>
              <Button variant="dark" onClick={() => addBlock("circuit")}>+ Circuit</Button>
            </div>
          </div>
        </> : <Card style={{ background: BRAND.card2, marginTop: 12 }}><div style={{ color: BRAND.muted }}>No workouts in week {week.weekNum} yet. Add one above, or duplicate another week.</div></Card>}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <Button onClick={() => onSave(p)} style={{ flex: 1, minWidth: 140 }}>Save Program</Button>
          <Button variant="dark" disabled={savingTpl} onClick={saveAsTemplate}>{savingTpl ? "Saving..." : "Save as Template"}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}

// ---------- Client: Live Workout Session ----------
export function WorkoutSession({ client, program, week, workout, session, logsBefore, onUpdate, onFinish, onExit }) {
  const isMobile = useIsMobile(520);
  const exerciseLibrary = useExerciseLibrary();
  const [subFor, setSubFor] = useState(null);
  const [subQuery, setSubQuery] = useState("");
  const [rest, setRest] = useState(null);
  const [finished, setFinished] = useState(() => (session.status === "completed" ? session : null));
  const [rpePickerFor, setRpePickerFor] = useState(null); // `${entryId}:${si}` of the set currently choosing an RPE, or null
  const [playingVideo, setPlayingVideo] = useState(null); // { videoId, title } or null
  const [current, setCurrent] = useState(0);
  const [, forceTick] = useState(0);
  useEffect(() => { const t = setInterval(() => forceTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const exById = {};
  (workout?.blocks || []).forEach((b) => (b.exercises || []).forEach((ex) => { exById[ex.id] = { ex, block: b }; }));
  function patchEntry(entryId, patch) { onUpdate({ ...session, entries: session.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) }); }
  function patchSet(entryId, si, patch) { onUpdate({ ...session, entries: session.entries.map((e) => (e.id === entryId ? { ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)) } : e)) }); }
  function addSet(entryId) {
    const entry = session.entries.find((e) => e.id === entryId);
    if (!entry) return;
    patchEntry(entryId, { sets: [...entry.sets, { setId: null, reps: "", load: "", duration: "", rpe: "", done: false }] });
  }
  function toggleDone(entry, si) {
    const meta = exById[entry.exerciseId];
    const target = meta?.ex.sets[si];
    const timed = isTimedExercise(entry.substitutedName || entry.name);
    const s = entry.sets[si];
    if (s.done) { patchSet(entry.id, si, { done: false }); setRest(null); return; }
    const patch = { done: true };
    const lastSets = lastSessionSetsFor(logsBefore, entry.substitutedName || entry.name);
    const prev = lastSets[si] || {};
    if (timed) { if (!s.duration) patch.duration = prev.duration || target?.targetReps || ""; }
    else { if (!s.reps) patch.reps = prev.reps || target?.targetReps || ""; if (!s.load && (meta?.ex.loadType || "kg") === "kg") patch.load = prev.load || target?.targetLoad || ""; }
    patchSet(entry.id, si, patch);
    const restSec = parseSeconds(meta?.ex.rest || "");
    if (restSec > 0) setRest({ until: Date.now() + restSec * 1000, total: restSec });
  }
  function finish() { const completed = { ...session, status: "completed", completedAt: new Date().toISOString() }; setFinished(completed); onUpdate(completed); }
  function handleExit() { if (session.startedAt && session.status !== "completed") { const e = Math.round((Date.now() - new Date(session.startedAt)) / 1000); onUpdate({ ...session, startedAt: null, elapsedSec: e }); } onExit(); }
  function adjustRest(delta) { if (rest && restLeft > 0) { const nl = Math.max(5, restLeft + delta); setRest({ until: Date.now() + nl * 1000, total: Math.max(rest.total, nl) }); } else { const base = Math.max(15, restTotal + delta); setRest({ until: Date.now() + base * 1000, total: base }); } }
  const sessionRef = useRef(session); sessionRef.current = session;
  useEffect(() => () => { const sn = sessionRef.current; if (sn && sn.startedAt && sn.status !== "completed") { const e = Math.round((Date.now() - new Date(sn.startedAt)) / 1000); onUpdate({ ...sn, startedAt: null, elapsedSec: e }); } }, []);
  const elapsed = session.startedAt ? Math.round((Date.now() - new Date(session.startedAt)) / 1000) : (session.elapsedSec || 0);
  const stats = sessionStatsV2(session);
  const restLeft = rest ? Math.ceil((rest.until - Date.now()) / 1000) : 0;
  if (rest && restLeft <= 0) setTimeout(() => setRest(null), 0);
  if (finished) {
    const fStats = sessionStatsV2(finished);
    const pbs = detectSessionPBs(finished, logsBefore);
    return (
      <Card style={{ padding: isMobile ? 14 : 18 }}>
        <div style={{ textAlign: "center", marginBottom: 14 }}><div style={{ fontSize: 30, fontWeight: 500, color: BRAND.gold }}>Session Complete</div><div style={{ color: BRAND.muted }}>{finished.workoutName} · Week {finished.weekNum}</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
          <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 12, textAlign: "center", overflow: "hidden" }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500 }}>DURATION</div><div style={{ fontWeight: 500, fontSize: 20 }}>{fStats.durationSec ? fmtClock(fStats.durationSec) : "-"}</div></div>
          <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 12, textAlign: "center", overflow: "hidden" }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500 }}>VOLUME</div><div style={{ fontWeight: 500, fontSize: 20 }}>{fStats.volume.toLocaleString()}kg</div></div>
          <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, padding: 12, textAlign: "center", overflow: "hidden" }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500 }}>SETS</div><div style={{ fontWeight: 500, fontSize: 20 }}>{fStats.setsDone}/{fStats.setsTotal}</div></div>
        </div>
        {pbs.length > 0 && <div style={{ background: BRAND.greenBg, border: `${BRAND.hairline} solid ${BRAND.green}`, borderRadius: BRAND.radiusCard, padding: 12, marginBottom: 14 }}><div style={{ color: BRAND.green, fontWeight: 500, marginBottom: 6 }}>Personal bests</div>{pbs.map((pb) => <div key={pb.name} style={{ fontWeight: 500 }}>{pb.name}: <span style={{ color: BRAND.green }}>{pb.detail}</span></div>)}</div>}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
          <Field label="Session RPE (1-10)" value={finished.sessionRpe} onChange={(v) => { const next = { ...finished, sessionRpe: v }; setFinished(next); onUpdate(next); }} />
          <Field label="Kcals" value={finished.metrics?.kcal || ""} onChange={(v) => { const next = { ...finished, metrics: { ...finished.metrics, kcal: v } }; setFinished(next); onUpdate(next); }} type="number" />
          <Field label="Max HR" value={finished.metrics?.maxHR || ""} onChange={(v) => { const next = { ...finished, metrics: { ...finished.metrics, maxHR: v } }; setFinished(next); onUpdate(next); }} type="number" />
          <Field label="Avg HR" value={finished.metrics?.avgHR || ""} onChange={(v) => { const next = { ...finished, metrics: { ...finished.metrics, avgHR: v } }; setFinished(next); onUpdate(next); }} type="number" />
        </div>
        <Field label="How did it feel?" value={finished.notes} onChange={(v) => { const next = { ...finished, notes: v }; setFinished(next); onUpdate(next); }} textarea />
        <Button onClick={() => onFinish(finished)} style={{ width: "100%", marginTop: 12 }}>Done</Button>
      </Card>
    );
  }
  const steps = groupSessionSteps(session, workout);
  const total = steps.length;
  const cur = Math.min(current, Math.max(0, total - 1));
  const step = steps[cur];
  if (!step) return <Card style={{ padding: 18 }}><div style={{ color: BRAND.muted }}>No exercises in this session.</div><Button onClick={handleExit} style={{ marginTop: 12 }}>Exit</Button></Card>;
  const isSuperset = step.type === "superset";
  const entry = isSuperset ? step.entries[0] : step.entry;
  const meta = exById[entry.exerciseId];
  const ex = isSuperset ? {} : (meta?.ex || {});
  const block = (workout?.blocks || []).find((b) => b.id === entry.blockId);
  const effectiveName = entry.substitutedName || entry.name;
  const timed = isTimedExercise(effectiveName);
  const lastSets = lastSessionSetsFor(logsBefore, effectiveName);
  const thumb = getVideoThumb(ex.videoUrl);
  const subbing = subFor === entry.id;
  const suggestions = subQuery ? exerciseLibrary.filter((n) => n.toLowerCase().includes(subQuery.toLowerCase())).slice(0, 10) : [];
  const prog = suggestProgression(lastSets);
  const restTotal = (rest?.total) || parseSeconds(ex.rest || "") || 120;
  const ringC = 2 * Math.PI * 26;
  const restPct = rest && restLeft > 0 ? restLeft / rest.total : 1;
  const chip = { fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", borderRadius: BRAND.radiusControl, padding: "6px 10px" };
  return (
    <>
    <InjuryBanner client={client} />
    <div style={{ display: "grid", gap: 14, maxWidth: "100%", overflowX: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={handleExit} style={{ background: "none", border: "none", color: BRAND.gold, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", cursor: "pointer", padding: 0 }}>‹ Exit</button>
        <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: "5px 11px", fontWeight: 500, color: BRAND.gold, fontSize: 13 }}>{elapsed > 0 ? fmtClock(elapsed) : "0:00"}</div>
      </div>
      {isSuperset ? (
        <SupersetLogger
          group={step.entries}
          exById={exById}
          logsBefore={logsBefore}
          rpePickerFor={rpePickerFor}
          setRpePickerFor={setRpePickerFor}
          patchSet={patchSet}
          addSet={addSet}
          toggleDone={toggleDone}
          onPlayVideo={(videoId, title) => setPlayingVideo({ videoId, title })}
          onExit={handleExit}
        />
      ) : (
      <>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>Exercise {cur + 1} of {total}</div>
          <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", textAlign: "right" }}>{workout?.name || session.workoutName}</div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 500, textTransform: "uppercase", lineHeight: 1.05, marginTop: 6 }}>{effectiveName}</div>
        {entry.substitutedName && <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 400, marginTop: 3 }}>Substituted for {entry.name}</div>}
        {block && block.type !== "straight" && <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 500, textTransform: "uppercase", marginTop: 4 }}>{entry.tag} · {block.type}</div>}
      </div>
      {thumb ? <button onClick={() => setPlayingVideo({ videoId: thumb.videoId, title: effectiveName })} style={{ width: "100%", padding: 0, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, overflow: "hidden", cursor: "pointer", display: "block", position: "relative", background: BRAND.card2 }}>
        <div style={{ position: "relative", height: 168 }}><img src={thumb.thumb} alt="Exercise" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} /><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: `2px solid ${BRAND.gold}`, display: "grid", placeItems: "center", color: BRAND.gold, fontSize: 20 }}>▶</div></div></div>
        {(ex.tempo || week?.targetRpe || ex.rest) && <div style={{ display: "flex", gap: 8, padding: 12, flexWrap: "wrap" }}>{ex.tempo && <span style={{ ...chip, color: BRAND.btnInk, background: BRAND.gold }}>Tempo {ex.tempo}</span>}{week?.targetRpe && <span style={{ ...chip, color: BRAND.gold, border: `${BRAND.hairline} solid ${BRAND.gold}` }}>Target RPE {week.targetRpe}</span>}{ex.rest && <span style={{ ...chip, color: BRAND.muted, border: `${BRAND.hairline} solid ${BRAND.line}` }}>Rest {ex.rest}</span>}</div>}
      </button> : (ex.tempo || week?.targetRpe || ex.rest) ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ex.tempo && <span style={{ ...chip, color: BRAND.btnInk, background: BRAND.gold }}>Tempo {ex.tempo}</span>}{week?.targetRpe && <span style={{ ...chip, color: BRAND.gold, border: `${BRAND.hairline} solid ${BRAND.gold}` }}>Target RPE {week.targetRpe}</span>}{ex.rest && <span style={{ ...chip, color: BRAND.muted, border: `${BRAND.hairline} solid ${BRAND.line}` }}>Rest {ex.rest}</span>}</div> : null}
      {ex.note && <div style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 10, fontSize: 13 }}><span style={{ color: BRAND.gold, fontWeight: 500 }}>Coach: </span>{ex.note}</div>}
      <SetLogRows entry={entry} timed={timed} lastSets={lastSets} prog={prog} rpePickerFor={rpePickerFor} setRpePickerFor={setRpePickerFor} patchSet={patchSet} addSet={addSet} toggleDone={toggleDone} />
      <div>
        <button onClick={() => { setSubFor(subbing ? null : entry.id); setSubQuery(""); }} style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, color: BRAND.muted, fontWeight: 500, cursor: "pointer", fontSize: 12, padding: "9px 14px" }}>{subbing ? "Cancel" : "Swap exercise"}</button>
        {subbing && <div style={{ marginTop: 8 }}>
          <input placeholder="Search a substitute..." value={subQuery} onChange={(e) => setSubQuery(e.target.value)} style={inputStyle()} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {entry.substitutedName && <button onClick={() => { patchEntry(entry.id, { substitutedName: "" }); setSubFor(null); }} style={{ background: BRAND.panel, color: BRAND.text, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 500, cursor: "pointer" }}>Use original: {entry.name}</button>}
            {suggestions.map((n) => <button key={n} onClick={() => { patchEntry(entry.id, { substitutedName: n }); setSubFor(null); }} style={{ background: BRAND.panel, color: BRAND.text, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 500, cursor: "pointer" }}>{n}</button>)}
          </div>
        </div>}
      </div>
      </>
      )}
      <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}><svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}><circle cx="30" cy="30" r="26" fill="none" stroke={BRAND.card2} strokeWidth="5" /><circle cx="30" cy="30" r="26" fill="none" stroke={BRAND.gold} strokeWidth="5" strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - restPct)} /></svg><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 500 }}>{rest && restLeft > 0 ? fmtClock(restLeft) : fmtClock(restTotal)}</div></div>
        <div style={{ flex: 1 }}><div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>Rest timer</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => adjustRest(-30)} style={{ flex: 1, padding: "10px 0", borderRadius: BRAND.radiusControl, cursor: "pointer", color: BRAND.text, background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, fontWeight: 500, fontSize: 12 }}>-30s</button>
            {rest && restLeft > 0
              ? <button onClick={() => setRest(null)} style={{ flex: 1.5, padding: "10px 0", borderRadius: BRAND.radiusControl, cursor: "pointer", color: BRAND.btnInk, background: BRAND.gold, border: "none", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>Skip</button>
              : <button onClick={() => setRest({ until: Date.now() + restTotal * 1000, total: restTotal })} style={{ flex: 1.5, padding: "10px 0", borderRadius: BRAND.radiusControl, border: "none", background: BRAND.gold, color: BRAND.btnInk, fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", cursor: "pointer" }}>Start {fmtClock(restTotal)}</button>}
            <button onClick={() => adjustRest(30)} style={{ flex: 1, padding: "10px 0", borderRadius: BRAND.radiusControl, cursor: "pointer", color: BRAND.text, background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, fontWeight: 500, fontSize: 12 }}>+30s</button>
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 8 }}>
        {cur > 0 && <Button variant="dark" onClick={() => { setCurrent(cur - 1); setRest(null); }} style={{ flex: 1 }}>Back</Button>}
        {cur < total - 1 ? <Button onClick={() => { setCurrent(cur + 1); setRest(null); }} style={{ flex: 2 }}>Next exercise ›</Button> : <Button onClick={finish} style={{ flex: 2 }}>Finish workout</Button>}
      </div>
      <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", textAlign: "center" }}>{total - cur - 1 > 0 ? `${total - cur - 1} exercise${total - cur - 1 === 1 ? "" : "s"} left` : "Last exercise"}</div>
    </div>
    {playingVideo && <VideoPlayerModal videoId={playingVideo.videoId} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}
    </>
  );
}



// ---------- Program calendar: shared bits ----------
export function DayPill({ day, compact = false }) {
  const base = { fontSize: compact ? 8 : 9, fontWeight: 500, borderRadius: 6, padding: compact ? "3px 2px" : "4px 3px", width: "100%", textAlign: "center", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", boxSizing: "border-box" };
  if (day.isRest) return <div style={{ ...base, background: "transparent", color: BRAND.dim, border: `${BRAND.hairline} solid ${BRAND.line}` }}>Rest</div>;
  if (day.state === "completed") return <div style={{ ...base, background: "transparent", color: BRAND.green, border: `1px solid color-mix(in srgb, ${BRAND.green} 40%, transparent)` }}><span style={{ color: BRAND.green }}>✓</span> {day.workout.name}</div>;
  if (day.state === "missed") return <div style={{ ...base, background: "transparent", color: BRAND.yellow, border: `1px solid color-mix(in srgb, ${BRAND.yellow} 40%, transparent)` }}>{day.workout.name}</div>;
  if (day.state === "in_progress") return <div style={{ ...base, background: "transparent", color: BRAND.gold, border: `${BRAND.hairline} solid ${BRAND.gold}` }}>{day.workout.name}</div>;
  return <div style={{ ...base, background: BRAND.gold, color: BRAND.btnInk }}>{day.workout.name}</div>;
}
export function dayBorder(day) {
  if (day.state === "today" || day.state === "in_progress") return BRAND.gold;
  if (day.state === "completed") return `color-mix(in srgb, ${BRAND.green} 33%, transparent)`;
  if (day.state === "missed") return `color-mix(in srgb, ${BRAND.yellow} 33%, transparent)`;
  return BRAND.line;
}
export function ProgramWeekView({ program, days, weekNum, setWeekNum, onOpen }) {
  const isMobile = useIsMobile(520);
  const week = program.weeks.find((w) => w.weekNum === weekNum) || program.weeks[0];
  const weekDaysList = days.filter((d) => d.weekNum === week.weekNum).sort((a, b) => a.dow - b.dow);
  const training = weekDaysList.filter((d) => !d.isRest);
  const done = training.filter((d) => d.state === "completed").length;
  const todayISO = isoDate(new Date());
  const today = weekDaysList.filter((d) => d.dateISO === todayISO);
  const upcoming = weekDaysList.filter((d) => d.dateISO > todayISO);
  const past = weekDaysList.filter((d) => d.dateISO < todayISO && !d.isRest);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {program.weeks.map((w) => {
          const wd = days.filter((d) => d.weekNum === w.weekNum && !d.isRest);
          const allDone = wd.length > 0 && wd.every((d) => d.state === "completed");
          return <Button key={w.id} variant={w.weekNum === week.weekNum ? "gold" : "dark"} onClick={() => setWeekNum(w.weekNum)} style={{ fontSize: 13, padding: "8px 14px", flexShrink: 0 }}>W{w.weekNum}{allDone ? " ✓" : ""}</Button>;
        })}
      </div>
      {(week.label || week.focus || week.targetRpe) && (
        <Card style={{ background: BRAND.card2, padding: 12 }}>
          <div style={{ color: BRAND.gold, fontWeight: 500 }}>Week {week.weekNum}{week.label ? `: ${week.label}` : ""}</div>
          {(week.focus || week.targetRpe) && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{[week.focus, week.targetRpe && `Target RPE ${week.targetRpe}`].filter(Boolean).join(" · ")}</div>}
        </Card>
      )}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", color: BRAND.dim, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>
          <span>This week</span><span>{done} of {training.length}</span>
        </div>
        <div style={{ height: 4, background: BRAND.card2, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${training.length ? (done / training.length) * 100 : 0}%`, background: BRAND.gold }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: isMobile ? 4 : 6 }}>
        {weekDaysList.map((d) => (
          <button key={d.key} onClick={() => onOpen(d)} style={{ background: d.isRest ? "transparent" : BRAND.card, border: `${BRAND.hairline} ${d.isRest ? "dashed" : "solid"} ${dayBorder(d)}`, borderRadius: BRAND.radiusControl, padding: "8px 3px", minHeight: 88, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", minWidth: 0 }}>
            <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 500 }}>{DOW_LETTER[d.dow - 1]}</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: d.state === "today" ? BRAND.gold : BRAND.text }}>{d.date.getDate()}</div>
            <DayPill day={d} compact />
          </button>
        ))}
      </div>
      {today.length > 0 && <DaySection title="Today" days={today} onOpen={onOpen} />}
      {upcoming.length > 0 && <DaySection title="Coming up" days={upcoming} onOpen={onOpen} />}
      {past.length > 0 && <DaySection title="Done this week" days={past} onOpen={onOpen} />}
    </div>
  );
}
export function DaySection({ title, days, onOpen }) {
  return (
    <div>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>{title}</div>
      {days.map((d) => {
        const stats = d.session?.status === "completed" ? sessionStatsV2(d.session) : null;
        return (
          <button key={d.key} onClick={() => onOpen(d)} style={{ width: "100%", textAlign: "left", background: d.isRest ? "transparent" : BRAND.card, border: `${BRAND.hairline} ${d.isRest ? "dashed" : "solid"} ${dayBorder(d)}`, borderRadius: BRAND.radiusCard, padding: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <div style={{ width: 38, textAlign: "center", flexShrink: 0 }}>
              <div style={{ color: BRAND.dim, fontSize: 9, fontWeight: 500 }}>{DOW_LABEL[d.dow - 1].toUpperCase()}</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: d.state === "today" ? BRAND.gold : BRAND.text }}>{d.date.getDate()}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 15, color: d.isRest ? BRAND.muted : BRAND.text }}>{d.isRest ? "Rest day" : d.workout.name}</div>
              <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400, marginTop: 2 }}>
                {d.isRest
                  ? (d.note || "Recovery")
                  : d.state === "completed"
                    ? `Completed · ${stats.setsDone} sets · ${stats.volume.toLocaleString()}kg`
                    : `${exerciseCountOf(d.workout)} exercises`}
              </div>
            </div>
            {d.state === "today" && <span style={{ background: BRAND.gold, color: BRAND.btnInk, fontSize: 10, fontWeight: 500, borderRadius: 999, padding: "4px 10px" }}>Start</span>}
            {d.state === "in_progress" && <span style={{ border: `${BRAND.hairline} solid ${BRAND.gold}`, color: BRAND.gold, fontSize: 10, fontWeight: 500, borderRadius: 999, padding: "4px 10px" }}>Resume</span>}
            {d.state === "completed" && <span style={{ color: BRAND.green, fontSize: 16, fontWeight: 500 }}>✓</span>}
            {d.state === "missed" && <span style={{ border: `1px solid ${BRAND.yellow}`, color: BRAND.yellow, fontSize: 10, fontWeight: 500, borderRadius: 999, padding: "4px 10px" }}>MISSED</span>}
          </button>
        );
      })}
    </div>
  );
}
export function ProgramMonthView({ days, cursor, setCursor, currentWeek, onOpen }) {
  const byDate = new Map(days.map((d) => [d.dateISO, d]));
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = [];
  const cur = addDays(first, -lead);
  for (let i = 0; i < 42; i++) {
    const date = addDays(cur, i);
    cells.push({ date, inMonth: date.getMonth() === cursor.getMonth(), day: byDate.get(isoDate(date)) || null });
  }
  const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="dark" onClick={() => shift(-1)} style={{ padding: "8px 14px" }}>‹</Button>
        <div style={{ fontWeight: 500, fontSize: 16 }}>{cursor.toLocaleString("en-GB", { month: "long", year: "numeric" })}</div>
        <Button variant="dark" onClick={() => shift(1)} style={{ padding: "8px 14px" }}>›</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4 }}>
        {DOW_LETTER.map((l, i) => <div key={i} style={{ textAlign: "center", color: BRAND.dim, fontSize: 9, fontWeight: 500, paddingBottom: 4 }}>{l}</div>)}
        {cells.map(({ date, inMonth, day }, i) => (
          <button key={i} disabled={!day} onClick={() => day && onOpen(day)} style={{
            aspectRatio: "1 / 1.2", minWidth: 0, boxSizing: "border-box",
            background: day && !day.isRest ? BRAND.card : "transparent",
            border: `${BRAND.hairline} ${day?.isRest ? "dashed" : "solid"} ${day ? dayBorder(day) : BRAND.line}`,
            borderRadius: BRAND.radiusControl, padding: 4, display: "flex", flexDirection: "column", justifyContent: "space-between",
            opacity: inMonth ? 1 : 0.28, cursor: day ? "pointer" : "default",
            boxShadow: day && day.weekNum === currentWeek ? `inset 0 0 0 1px ${BRAND.card2}` : "none",
          }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: day?.state === "today" ? BRAND.gold : BRAND.muted, textAlign: "left" }}>{date.getDate()}</div>
            {day && <DayPill day={day} compact />}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: BRAND.dim, fontSize: 10, fontWeight: 400 }}>
        <span><span style={{ color: BRAND.green }}>✓</span> Completed</span>
        <span style={{ color: BRAND.gold }}>■ Scheduled</span>
        <span>▢ Rest</span>
      </div>
    </div>
  );
}
// ---------- Completed day: the session report ----------
// A record of what was actually done, not a place to log. Prescribed sits next
// to actual, because the gap between them is the coaching.
export function SessionReport({ client, day, logs, onBack, onStart, onSaveCoachNote, isCoach }) {
  const session = day.session;
  const [note, setNote] = useState(session?.coachNote || "");
  const [saved, setSaved] = useState(false);
  const stats = sessionStatsV2(session);
  const logsBefore = { ...logs, sessions: (logs?.sessions || []).filter((s) => s.id !== session.id) };
  const pbs = detectSessionPBs(session, logsBefore);
  const pbNames = new Set(pbs.map((p) => String(p.name).toLowerCase()));
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <Card>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>
          {day.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · Week {day.weekNum}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 500 }}>{day.workout.name}</div>
          {onStart && <Button variant="dark" onClick={() => onStart(day)}>Log again</Button>}
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>
          Completed{stats.durationSec > 0 ? ` · ${fmtClock(stats.durationSec)}` : ""}{session.sessionRpe ? ` · Session RPE ${session.sessionRpe}` : ""}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
          <Mini label="Volume" value={`${stats.volume.toLocaleString()} kg`} />
          <Mini label="Sets" value={`${stats.setsDone} / ${stats.setsTotal}`} />
          <Mini label="PBs" value={String(pbs.length)} />
        </div>
      </Card>
      <div>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>What was done</div>
        {(session.entries || []).map((e) => {
          const name = e.substitutedName || e.name;
          const timed = isTimedExercise(name);
          const prescribed = findPrescribedExercise(day.workout, e);
          const loggedSets = (e.sets || []).filter((s) => s.done || s.reps || s.load || s.duration);
          const isPb = pbNames.has(String(name).toLowerCase());
          const short = prescribed && loggedSets.length > 0 && loggedSets.length < (prescribed.sets?.length || 0);
          if (!loggedSets.length) return null;
          return (
            <Card key={e.id} style={{ padding: 13, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 500, fontSize: 15 }}>{e.tag ? <span style={{ color: BRAND.gold, marginRight: 6 }}>{e.tag}</span> : null}{name}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {isPb && <span style={{ background: BRAND.green, color: "#000", fontSize: 9, fontWeight: 500, borderRadius: 999, padding: "3px 8px" }}>PB</span>}
                  {short && <span style={{ color: BRAND.yellow, fontSize: 10, fontWeight: 500 }}>{loggedSets.length} of {prescribed.sets.length} sets</span>}
                </div>
              </div>
              {prescribed && <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 400, marginTop: 4 }}>Prescribed {fmtExerciseSummary(prescribed)}</div>}
              <div style={{ marginTop: 8 }}>
                {loggedSets.map((s, i) => {
                  const prev = loggedSets[i - 1];
                  const up = !timed && prev && (parseFloat(s.load) || 0) > (parseFloat(prev.load) || 0) ? (parseFloat(s.load) || 0) - (parseFloat(prev.load) || 0) : 0;
                  const target = prescribed?.sets?.[i];
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i === 0 ? "none" : `${BRAND.hairline} solid ${BRAND.lineSoft}`, fontSize: 13 }}>
                      <span style={{ color: BRAND.dim, fontSize: 10, fontWeight: 500 }}>{i + 1}</span>
                      <span style={{ fontWeight: 500 }}>
                        {fmtLoggedSet(s, timed)}
                        {up > 0 && <span style={{ color: BRAND.green, fontSize: 11, marginLeft: 6 }}>↑ +{up}</span>}
                        {target && <span style={{ color: BRAND.dim, fontWeight: 400, fontSize: 11, marginLeft: 8 }}>target {fmtSetTarget(target, prescribed)}</span>}
                      </span>
                      <span style={{ color: BRAND.gold, fontSize: 11, fontWeight: 500 }}>{s.rpe ? `RPE ${s.rpe}` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      {session.notes && (
        <Card style={{ borderLeft: `3px solid ${BRAND.gold}` }}>
          <div style={{ color: BRAND.gold, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>{client.name}</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.5 }}>{session.notes}</div>
        </Card>
      )}
      {!isCoach && session.coachNote && (
        <Card style={{ borderLeft: `3px solid ${BRAND.blue}` }}>
          <div style={{ color: BRAND.blue, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>Coach</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.5 }}>{session.coachNote}</div>
        </Card>
      )}
      {isCoach && (
        <Card>
          <Field label="Coach note on this session" value={note} onChange={(v) => { setNote(v); setSaved(false); }} textarea />
          <Button onClick={() => { onSaveCoachNote(session, note); setSaved(true); }} style={{ marginTop: 10, width: "100%" }}>{saved ? "Saved" : "Save note"}</Button>
        </Card>
      )}
    </div>
  );
}
// ---------- Upcoming / rest day detail ----------
export function DayDetail({ day, onBack, onStart, canStart }) {
  const isFuture = day.dateISO > isoDate(new Date());
  if (day.isRest) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
        <Card>
          <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>
            {day.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, marginTop: 4 }}>Rest day</div>
          <div style={{ color: BRAND.muted, fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>{day.note || "No session scheduled. Recover well."}</div>
        </Card>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <Card>
        <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>
          {day.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · Week {day.weekNum}
        </div>
        <div style={{ fontSize: 24, fontWeight: 500, marginTop: 4 }}>{day.workout.name}</div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>{exerciseCountOf(day.workout)} exercises</div>
        {day.workout.note && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 8 }}>{day.workout.note}</div>}
      </Card>
      <Card>
        {(day.workout.blocks || []).map((b, bi) => (b.exercises || []).map((ex, ei) => (
          <div key={ex.id} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", borderTop: bi === 0 && ei === 0 ? "none" : `${BRAND.hairline} solid ${BRAND.lineSoft}` }}>
            <span style={{ color: BRAND.gold, fontWeight: 500, minWidth: 26, fontSize: 12 }}>{exerciseTag(b, bi, ei)}</span>
            <span style={{ fontWeight: 500, flex: 1 }}>{ex.name}</span>
            <span style={{ color: BRAND.muted, fontSize: 12 }}>{fmtExerciseSummary(ex)}</span>
          </div>
        )))}
        {exerciseCountOf(day.workout) === 0 && <div style={{ color: BRAND.muted }}>Empty workout.</div>}
      </Card>
      {canStart
        ? <Button onClick={() => onStart(day)} style={{ width: "100%" }}>{day.state === "in_progress" ? "Continue session" : "Start session"}</Button>
        : isFuture
          ? <Card style={{ background: BRAND.card2, textAlign: "center" }}><div style={{ color: BRAND.dim, fontSize: 13 }}>Opens {day.date.toLocaleDateString("en-GB", { day: "numeric", month: "long" })} — this week comes first.</div></Card>
          : null}
    </div>
  );
}
// ---------- ProgramTab: coach + client entry point ----------
export function isVacationActive(vacation) {
  if (!vacation?.startDate || !vacation?.endDate) return false;
  const today = isoDate();
  return today >= vacation.startDate && today <= vacation.endDate;
}
export function VacationModeModal({ client, vacation, onClose, onSave, onEnd }) {
  const [startDate, setStartDate] = useState(vacation?.startDate || isoDate());
  const [endDate, setEndDate] = useState(vacation?.endDate || isoDate(addDays(new Date(), 6)));
  const [workoutName, setWorkoutName] = useState(vacation?.workout?.name || "Bodyweight Full Body");
  const [exercises, setExercises] = useState(vacation?.workout?.exercises?.length ? vacation.workout.exercises : [
    { id: uid(), name: "Goblet Squat", sets: "3", reps: "15", videoUrl: DEFAULT_EXERCISE_VIDEOS["Goblet Squat"] || "" },
    { id: uid(), name: "Push-Up", sets: "3", reps: "12", videoUrl: DEFAULT_EXERCISE_VIDEOS["Push-Up"] || "" },
    { id: uid(), name: "Plank", sets: "3", reps: "45s", videoUrl: DEFAULT_EXERCISE_VIDEOS["Plank"] || "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [pickSource, setPickSource] = useState("library");
  const [addSearch, setAddSearch] = useState("");
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customLibrary, setCustomLibrary] = useState([]);
  const exerciseLibrary = useExerciseLibrary();
  useEffect(() => { if (client.trainer_id) loadExerciseLibraryData(client.trainer_id).then(setCustomLibrary); }, [client.trainer_id]);
  const customVideoMap = Object.fromEntries(customLibrary.filter((it) => it.videoUrl).map((it) => [it.name, it.videoUrl]));
  const customNames = customLibrary.map((it) => it.name);
  const suggestions = !addSearch ? [] : (pickSource === "mine" ? customNames : exerciseLibrary).filter((n) => n.toLowerCase().includes(addSearch.toLowerCase())).slice(0, 12);

  function updateEx(id, patch) { setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))); }
  function removeEx(id) { setExercises((prev) => prev.filter((e) => e.id !== id)); }
  function addExercise(name) {
    const videoUrl = customVideoMap[name] || DEFAULT_EXERCISE_VIDEOS[name] || "";
    setExercises((prev) => [...prev, { id: uid(), name, sets: "3", reps: "12", videoUrl }]);
    setAddSearch("");
  }
  async function save() {
    if (!startDate || !endDate || startDate > endDate) { showToast("Check the dates - start must be before end.", "warn"); return; }
    if (exercises.length === 0) { showToast("Add at least one exercise.", "warn"); return; }
    setSaving(true);
    await onSave({ startDate, endDate, workout: { name: workoutName, exercises } });
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 500 }}>Set Vacation Mode</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 14 }}>{client.name?.split(" ")[0]}'s regular program stays exactly where it is - this just sits on top temporarily, then hands back automatically.</div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: "uppercase" }}>Dates</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle()} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle()} />
        </div>
        <Field label="Workout name" value={workoutName} onChange={setWorkoutName} placeholder="e.g. Bodyweight Full Body" />
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500, margin: "14px 0 8px", textTransform: "uppercase" }}>Home Workout Plan</div>
        {exercises.map((ex) => {
          const thumb = getVideoThumb(ex.videoUrl);
          return (
            <div key={ex.id} style={{ background: BRAND.card2, borderRadius: BRAND.radiusControl, padding: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {thumb ? <img src={thumb.thumb} alt="Exercise video" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: BRAND.radiusControl, flexShrink: 0 }} /> : <div style={{ width: 40, height: 40, borderRadius: BRAND.radiusControl, background: BRAND.panel, flexShrink: 0 }} />}
                <div style={{ flex: 1, fontWeight: 500, fontSize: 13, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</div>
                <button onClick={() => removeEx(ex.id)} style={{ background: "transparent", border: "none", color: BRAND.yellow, fontWeight: 500, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>x</button>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input value={ex.sets} onChange={(e) => updateEx(ex.id, { sets: e.target.value })} placeholder="sets" style={inputStyle()} />
                <input value={ex.reps} onChange={(e) => updateEx(ex.id, { reps: e.target.value })} placeholder="reps" style={inputStyle()} />
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 6, background: BRAND.panel, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: 3, marginTop: 10, marginBottom: 8 }}>
          <button onClick={() => setPickSource("library")} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", background: pickSource === "library" ? BRAND.gold : "transparent", color: pickSource === "library" ? BRAND.btnInk : BRAND.muted, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>Exercise Library</button>
          <button onClick={() => setPickSource("mine")} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", background: pickSource === "mine" ? BRAND.gold : "transparent", color: pickSource === "mine" ? BRAND.btnInk : BRAND.muted, fontWeight: 500, fontSize: 12, cursor: "pointer" }}>My Exercises{customLibrary.length ? ` (${customLibrary.length})` : ""}</button>
        </div>
        <input placeholder={pickSource === "mine" ? "Search your exercises..." : "Search exercises to add..."} value={addSearch} onChange={(e) => setAddSearch(e.target.value)} style={inputStyle()} />
        {addSearch && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {suggestions.map((n) => <button key={n} onClick={() => addExercise(n)} style={{ background: BRAND.panel, color: BRAND.text, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "6px 10px", fontWeight: 500, cursor: "pointer" }}>+ {n}</button>)}
            {pickSource === "library" && suggestions.length === 0 && <button onClick={() => addExercise(addSearch.trim())} style={{ background: BRAND.gold, color: BRAND.btnInk, border: "none", borderRadius: 999, padding: "6px 10px", fontWeight: 500, cursor: "pointer" }}>+ Custom: {addSearch.trim()}</button>}
          </div>
        )}
        <Button onClick={save} disabled={saving} style={{ width: "100%", marginTop: 16 }}>{saving ? "Saving..." : "Activate Vacation Mode"}</Button>
        {vacation && <Button variant="red" onClick={onEnd} style={{ width: "100%", marginTop: 8 }}>End Vacation Mode Now</Button>}
      </Card>
    </div>
  );
}
export function VacationBanner({ vacation, isCoach, onEdit, onToggleDone, doneToday }) {
  const [playingVideo, setPlayingVideo] = useState(null);
  const active = isVacationActive(vacation);
  if (!active) return null;
  const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <Card style={{ padding: 14, background: BRAND.yellowBg, border: `1px solid ${BRAND.yellow}`, marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 20 }}>🏖️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: BRAND.yellow, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>Vacation Mode Active</div>
          <div style={{ color: BRAND.text, fontWeight: 400, fontSize: 12, marginTop: 2 }}>{fmt(vacation.startDate)} - {fmt(vacation.endDate)} · Regular program paused, resumes automatically</div>
        </div>
        {isCoach && <button onClick={onEdit} style={{ background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: 999, padding: "6px 12px", color: BRAND.text, fontWeight: 500, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Edit</button>}
      </div>
      <div style={{ background: BRAND.card2, borderRadius: BRAND.radiusControl, padding: 12, marginTop: 12 }}>
        <div style={{ color: BRAND.yellow, fontSize: 10, fontWeight: 500, textTransform: "uppercase", marginBottom: 6 }}>Today's Home Workout</div>
        <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>{vacation.workout?.name}</div>
        {(vacation.workout?.exercises || []).map((ex) => {
          const thumb = getVideoThumb(ex.videoUrl);
          return (
            <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `${BRAND.hairline} solid ${BRAND.line}` }}>
              {thumb ? (
                <button onClick={() => setPlayingVideo({ videoId: thumb.videoId, title: ex.name })} style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", position: "relative", flexShrink: 0 }}>
                  <img src={thumb.thumb} alt="Exercise video" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: BRAND.radiusControl, border: `${BRAND.hairline} solid ${BRAND.line}` }} />
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", color: "#fff", fontSize: 9 }}>▶</div></div>
                </button>
              ) : <div style={{ width: 44, height: 44, borderRadius: BRAND.radiusControl, background: BRAND.panel, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 400, fontSize: 13 }}>{ex.name}</div>
                <div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 400 }}>{ex.sets} x {ex.reps}</div>
              </div>
            </div>
          );
        })}
        {!isCoach && (
          <button onClick={onToggleDone} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 999, border: "none", background: doneToday ? BRAND.green : BRAND.yellow, color: "#000", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>{doneToday ? "✓ Marked Done Today" : "Mark Today's Workout Done"}</button>
        )}
      </div>
      {playingVideo && <VideoPlayerModal videoId={playingVideo.videoId} title={playingVideo.title} onClose={() => setPlayingVideo(null)} />}
    </Card>
  );
}
export function ProgramTab({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [program, setProgram] = useState(client.program?.version === 2 ? client.program : null);
  const [logs, setLogs] = useState(client.trainingLogs || emptyTrainingLogs());
  const [builder, setBuilder] = useState(false);
  const [live, setLive] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [mode, setMode] = useState("week");
  const [openKey, setOpenKey] = useState(null);
  const [weekNum, setWeekNum] = useState(() => currentProgramWeek(client.program));
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [vacation, setVacation] = useState(client.vacation || null);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const days = useMemo(() => buildProgramDays(program, logs), [program, logs]);
  async function persist(nextProgram, nextLogs) {
    updateClient({ ...client, program: nextProgram, trainingLogs: nextLogs });
    let failed = null;
    if (nextProgram) { const r = await upsertSection(client.id, "program", nextProgram); if (r?.error) failed = r.error; }
    if (nextLogs) { const r = await upsertSection(client.id, "training_logs", nextLogs); if (r?.error) failed = r.error; }
    if (failed) showToast(`Heads up: the server rejected this save (${failed.message || failed}). It's kept safely on this device and will keep retrying, but if you see this repeatedly, the database needs attention - don't clear your browser data in the meantime.`, "error");
  }
  function saveProgram(p) { setProgram(p); persist(p, logs); setBuilder(false); setWeekNum(currentProgramWeek(p)); }
  async function saveVacation(data) {
    const next = { ...vacation, ...data, completedDates: vacation?.completedDates || [] };
    setVacation(next);
    updateClient({ ...client, vacation: next });
    await upsertSection(client.id, "vacation_mode", next);
    setShowVacationModal(false);
  }
  async function endVacation() {
    const next = { ...vacation, endDate: isoDate(addDays(new Date(), -1)) };
    setVacation(next);
    updateClient({ ...client, vacation: next });
    await upsertSection(client.id, "vacation_mode", next);
    setShowVacationModal(false);
  }
  async function toggleVacationDoneToday() {
    const today = isoDate();
    const completedDates = vacation.completedDates || [];
    const next = { ...vacation, completedDates: completedDates.includes(today) ? completedDates.filter((d) => d !== today) : [...completedDates, today] };
    setVacation(next);
    updateClient({ ...client, vacation: next });
    await upsertSection(client.id, "vacation_mode", next);
  }
  function saveLogs(l) { setLogs(l); persist(program, l); }
  function startOrContinue(day) {
    const existing = sessionForWorkout(logs, day.week.id, day.workout.id);
    if (existing && existing.status === "in_progress") { setLive(existing); return; }
    const fresh = startSession(program, day.week, day.workout);
    setLive(fresh);
    saveLogs(upsertSessionInLogs(logs, fresh));
  }
  function updateLive(session) { setLive(session); saveLogs(upsertSessionInLogs(logs, session)); }
  function saveCoachNote(session, coachNote) { saveLogs(upsertSessionInLogs(logs, { ...session, coachNote })); }
  if (live && program) {
    const liveWeek = program.weeks.find((w) => w.id === live.weekId);
    const liveWorkout = liveWeek?.workouts.find((w) => w.id === live.workoutId);
    const logsBefore = { ...logs, sessions: (logs?.sessions || []).filter((s) => s.id !== live.id) };
    return <WorkoutSession client={client} program={program} week={liveWeek} workout={liveWorkout} session={live} logsBefore={logsBefore} onUpdate={updateLive} onFinish={() => { setLive(null); setOpenKey(null); }} onExit={() => setLive(null)} />;
  }
  const openDay = openKey ? days.find((d) => d.key === openKey) : null;
  const todayISO = isoDate(new Date());
  return (
    <div style={{ display: "grid", gap: isMobile ? 10 : 14 }}>
      <Card style={{ padding: isMobile ? 12 : 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>{program ? `${client.name}'s Program` : "No program yet"}</div>
            {program && <div style={{ color: BRAND.muted, fontSize: 13 }}>{program.goal} · {program.weeks?.length || 0} weeks{program.startDate ? ` · starts ${program.startDate}` : ""}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {program && isCoach && <Button variant="dark" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); const { blob, filename } = await downloadProgramPDF2(client, program); await sharePdfBlob(blob, filename, `${client.name}'s Program`); setPdfBusy(false); }}>{pdfBusy ? "..." : "Share"}</Button>}
            {isCoach && <Button variant="dark" onClick={() => setShowVacationModal(true)}>{isVacationActive(vacation) ? "Vacation Mode" : "Set Vacation Mode"}</Button>}
            {isCoach && <Button variant="dark" onClick={() => setBuilder(true)}>{program ? "Edit Program" : "Build Program"}</Button>}
          </div>
        </div>
      </Card>
      <VacationBanner vacation={vacation} isCoach={isCoach} onEdit={() => setShowVacationModal(true)} onToggleDone={toggleVacationDoneToday} doneToday={(vacation?.completedDates || []).includes(isoDate())} />
      {showVacationModal && <VacationModeModal client={client} vacation={vacation} onClose={() => setShowVacationModal(false)} onSave={saveVacation} onEnd={endVacation} />}
      {!program && <Card><div style={{ color: BRAND.muted }}>{isCoach ? "No program assigned. Click Build Program to design one." : "Your coach hasn't assigned a program yet."}</div></Card>}
      {program && openDay && (
        openDay.state === "completed"
          ? <SessionReport client={client} day={openDay} logs={logs} isCoach={isCoach} onBack={() => setOpenKey(null)} onSaveCoachNote={saveCoachNote} onStart={startOrContinue} />
          : <DayDetail day={openDay} onBack={() => setOpenKey(null)} onStart={startOrContinue} canStart={!openDay.isRest && (isCoach || (openDay.dateISO >= isoDate(startOfWeek(new Date())) && openDay.dateISO <= isoDate(addDays(startOfWeek(new Date()), 6))))} />
      )}
      {program && !openDay && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em" }}>
              Week {weekNum} of {program.weeks.length}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant={mode === "week" ? "gold" : "dark"} onClick={() => setMode("week")} style={{ fontSize: 12, padding: "7px 14px" }}>Week</Button>
              <Button variant={mode === "month" ? "gold" : "dark"} onClick={() => setMode("month")} style={{ fontSize: 12, padding: "7px 14px" }}>Month</Button>
            </div>
          </div>
          {mode === "week"
            ? <ProgramWeekView program={program} days={days} weekNum={weekNum} setWeekNum={setWeekNum} onOpen={(d) => setOpenKey(d.key)} />
            : <ProgramMonthView days={days} cursor={monthCursor} setCursor={setMonthCursor} currentWeek={currentProgramWeek(program)} onOpen={(d) => setOpenKey(d.key)} />}
        </>
      )}
      {builder && <ProgramBuilder client={client} program={program} onClose={() => setBuilder(false)} onSave={saveProgram} />}
    </div>
  );
}

export function useExerciseLibrary() {
  const [library, setLibrary] = useState(EXERCISE_LIBRARY);
  useEffect(() => {
    let active = true;
    async function loadExercises() {
      try {
        const { data, error } = await supabase
          .from("exercise_library")
          .select("name")
          .order("name", { ascending: true });
        if (!active) return;
        if (!error && Array.isArray(data) && data.length) {
          const dbNames = data.map((r) => r?.name).filter(Boolean);
          const merged = Array.from(new Set([...dbNames, ...EXERCISE_LIBRARY])).sort((a, b) => a.localeCompare(b));
          setLibrary(merged);
        }
      } catch (_) {
        // If the exercise_library table does not exist, Forge uses the built-in library.
      }
    }
    loadExercises();
    return () => { active = false; };
  }, []);
  return library;
}
