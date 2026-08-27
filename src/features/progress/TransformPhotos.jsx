import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { useIsMobile } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { isoDate } from "../../lib/dateUtils.js";
import { PHOTO_TYPES } from "../../lib/constants.js";
import { upsertSection } from "../../lib/clientData.js";
import { compressImage } from "../../lib/compressImage.js";
import { uploadClientPhoto, deleteClientPhoto, usePhotoUrl, isStoragePath } from "../../lib/storage.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";

function PhotoImg({ photo, alt, style }) {
  const url = usePhotoUrl(photo?.image || photo?.url);
  if (!url) return null;
  return <img src={url} alt={alt} style={style} />;
}

function PhotoUploadModal({ onClose, onSave }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [form, setForm] = useState({ type: "Progress", weight: "", notes: "", date: isoDate() });
  const [saving, setSaving] = useState(false);
  function pickImage(f) {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }
  async function save() {
    if (!file) { showToast("Choose a photo from your device first.", "warn"); return; }
    setSaving(true);
    await onSave({ file, ...form });
    setSaving(false);
  }
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 1000 }}>Add Photo</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        {previewUrl ? (
          <div style={{ position: "relative", marginBottom: 14 }}>
            <img src={previewUrl} alt="preview" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 16 }} />
            <button onClick={() => { setFile(null); setPreviewUrl(""); }} style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,.7)", border: "none", color: "#fff", borderRadius: 999, width: 30, height: 30, fontWeight: 900, cursor: "pointer" }}>x</button>
          </div>
        ) : (
          <label style={{ display: "grid", placeItems: "center", height: 180, background: BRAND.card2, border: `2px dashed ${BRAND.line}`, borderRadius: 16, marginBottom: 14, cursor: "pointer", color: BRAND.muted, fontWeight: 800 }}>
            + Choose a photo
            <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} style={{ display: "none" }} />
          </label>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <label><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: "uppercase" }}>Type</div><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle()}>{PHOTO_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
        </div>
        <Field label="Weight (optional)" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
        <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} textarea />
        <Button onClick={save} disabled={saving} style={{ width: "100%", marginTop: 12 }}>{saving ? "Uploading..." : "Save Photo"}</Button>
      </Card>
    </div>
  );
}
function PhotoLightbox({ photos, index, onClose, onNavigate, onDelete }) {
  const photo = photos[index];
  if (!photo) return null;
  return (
    <div style={{ ...modalBackdrop(), padding: 0 }}>
      <div style={{ position: "absolute", top: 14, right: 14, zIndex: 2, display: "flex", gap: 8 }}>
        <Button variant="red" onClick={async () => { if (await confirmDialog("Delete this photo? This cannot be undone.", { danger: true, confirmLabel: "Delete" })) onDelete(photo.id); }}>Delete</Button>
        <Button variant="ghost" onClick={onClose}>X</Button>
      </div>
      {index > 0 && <button onClick={() => onNavigate(index - 1)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", zIndex: 2, background: "rgba(0,0,0,.6)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, fontWeight: 900, cursor: "pointer" }}>&lsaquo;</button>}
      {index < photos.length - 1 && <button onClick={() => onNavigate(index + 1)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", zIndex: 2, background: "rgba(0,0,0,.6)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, fontWeight: 900, cursor: "pointer" }}>&rsaquo;</button>}
      <div style={{ maxWidth: 480, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <PhotoImg photo={photo} alt={photo.type} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 12 }} />
        <div style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, marginTop: 12, width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: BRAND.text, fontWeight: 800 }}><span>{photo.type}</span><span style={{ color: BRAND.muted, fontWeight: 600 }}>{photo.date}</span></div>
          {photo.weight && <div style={{ color: BRAND.gold, fontWeight: 700, fontSize: 13, marginTop: 4 }}>{photo.weight}kg</div>}
          {photo.notes && <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 6 }}>{photo.notes}</div>}
        </div>
      </div>
    </div>
  );
}
function PhotoCompareSlot({ label, photo, onPick }) {
  return (
    <button onClick={onPick} style={{ background: BRAND.card, border: `1px solid ${BRAND.line}`, borderRadius: 20, overflow: "hidden", cursor: "pointer", padding: 0, textAlign: "left", width: "100%" }}>
      <div style={{ padding: "10px 12px", color: BRAND.gold, fontWeight: 900, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {photo?.image || photo?.url ? <PhotoImg photo={photo} alt={label} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover" }} /> : <div style={{ aspectRatio: "3/4", display: "grid", placeItems: "center", color: BRAND.dim, fontSize: 13, fontWeight: 700 }}>No photo</div>}
      {photo && <div style={{ padding: "8px 12px 12px" }}><div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 700 }}>{photo.date}{photo.weight ? ` · ${photo.weight}kg` : ""}</div></div>}
      <div style={{ padding: "0 12px 12px", color: BRAND.dim, fontSize: 11, fontWeight: 700 }}>Tap to change</div>
    </button>
  );
}
function PhotoPickerModal({ photos, onPick, onClose }) {
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Choose a Photo</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {photos.map((p) => (
            <button key={p.id} onClick={() => onPick(p.id)} style={{ padding: 0, border: `1px solid ${BRAND.line}`, borderRadius: 12, overflow: "hidden", cursor: "pointer", background: "none" }}>
              <PhotoImg photo={p} alt={p.type} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
export function TransformPhotos({ client, updateClient, isCoach }) {
  const isMobile = useIsMobile(520);
  const [photos, setPhotos] = useState(client.transformPhotos || []);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [picking, setPicking] = useState(null); // "left" | "right" | null
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("client_data").select("data").eq("client_id", client.id).eq("section", "transformPhotos").maybeSingle();
      if (cancelled) return;
      const fetched = data?.data || [];
      setPhotos(fetched);
      setLoadingPhotos(false);
      updateClient({ ...client, transformPhotos: fetched });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);
  const sorted = [...photos].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const [compareIds, setCompareIds] = useState(() => [sorted[0]?.id, sorted[sorted.length - 1]?.id]);
  const leftPhoto = photos.find((p) => p.id === compareIds[0]);
  const rightPhoto = photos.find((p) => p.id === compareIds[1]);
  const gridPhotos = [...photos].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  async function persist(next) { setPhotos(next); await upsertSection(client.id, "transformPhotos", next); updateClient({ ...client, transformPhotos: next }); }
  async function addPhoto({ file, ...form }) {
    const blob = await compressImage(file);
    const path = await uploadClientPhoto(client.id, "transform", blob);
    await persist([{ id: uid(), image: path, ...form }, ...photos]);
    setShowUpload(false);
  }
  async function delPhoto(id) {
    const removed = photos.find((p) => p.id === id);
    await persist(photos.filter((p) => p.id !== id));
    setLightboxIndex(null);
    if (removed && isStoragePath(removed.image)) await deleteClientPhoto(removed.image);
  }
  function pickCompare(id) { setCompareIds((prev) => (picking === "left" ? [id, prev[1]] : [prev[0], id])); setPicking(null); }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800 }}>Transformation Photos</div>
        <Button onClick={() => setShowUpload(true)}>+ Add Photo</Button>
      </div>

      {photos.length >= 2 && (
        <div>
          <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>Compare</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PhotoCompareSlot label="Before" photo={leftPhoto} onPick={() => setPicking("left")} />
            <PhotoCompareSlot label="After" photo={rightPhoto} onPick={() => setPicking("right")} />
          </div>
        </div>
      )}

      <div>
        <div style={{ color: BRAND.gold, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 }}>All Photos</div>
        {loadingPhotos ? (
          <Card><div style={{ color: BRAND.muted }}>Loading photos...</div></Card>
        ) : photos.length === 0 ? (
          <Card><div style={{ color: BRAND.muted }}>{isCoach ? "No photos yet. Add the first one to start tracking visual progress." : "No photos yet. Tap + Add Photo to log your first one."}</div></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
            {gridPhotos.map((p) => {
              const realIndex = gridPhotos.indexOf(p);
              return (
                <button key={p.id} onClick={() => setLightboxIndex(realIndex)} style={{ padding: 0, border: `1px solid ${BRAND.line}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", background: BRAND.card2, position: "relative" }}>
                  {p.image || p.url ? <PhotoImg photo={p} alt={p.type} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} /> : <div style={{ aspectRatio: "1/1", display: "grid", placeItems: "center", color: BRAND.dim, fontSize: 11 }}>No image</div>}
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(0deg, rgba(0,0,0,.85), transparent)", padding: "12px 8px 6px", textAlign: "left" }}>
                    <div style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>{p.date}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showUpload && <PhotoUploadModal onClose={() => setShowUpload(false)} onSave={addPhoto} />}
      {lightboxIndex !== null && <PhotoLightbox photos={gridPhotos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} onDelete={delPhoto} />}
      {picking && <PhotoPickerModal photos={sorted} onPick={pickCompare} onClose={() => setPicking(null)} />}
    </div>
  );
}
