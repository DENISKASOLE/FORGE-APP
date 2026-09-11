import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { modalBackdrop } from "../../components/ui/modal.js";
import { VideoPlayerModal } from "../../components/ui/VideoPlayerModal.jsx";
import { getVideoThumb } from "../../lib/exerciseVideos.js";
import { MuscleGroupTag, MovementPatternTag } from "./ExerciseTag.jsx";

// Read-only exercise detail: the two taxonomy tags, primary muscle, and the
// 3 coaching cues as a numbered list. Reuses Card/Button/modalBackdrop and
// the existing video-thumbnail pattern rather than inventing new UI.
export function ExerciseDetailModal({ name, videoUrl, meta, onClose }) {
  const [playingVideo, setPlayingVideo] = useState(false);
  const thumb = getVideoThumb(videoUrl);
  const cues = meta?.cues || [];
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 440, maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 19, fontWeight: 500 }}>{name}</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>

        {thumb && (
          <button onClick={() => setPlayingVideo(true)} style={{ width: "100%", padding: 0, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusCard, overflow: "hidden", cursor: "pointer", display: "block", position: "relative", background: BRAND.card2, marginBottom: 12 }}>
            <div style={{ position: "relative", height: 160 }}>
              <img src={thumb.thumb} alt="Exercise" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: `2px solid ${BRAND.gold}`, display: "grid", placeItems: "center", color: BRAND.gold, fontSize: 18 }}>▶</div></div>
            </div>
          </button>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <MuscleGroupTag muscleGroup={meta?.muscleGroup} needsReview={meta?.needsReview} />
          <MovementPatternTag movementPattern={meta?.movementPattern} />
        </div>

        {meta?.muscleGroup && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 3 }}>Primary Muscle</div>
            <div style={{ fontWeight: 500, fontSize: 15 }}>{meta.muscleGroup}</div>
          </div>
        )}

        {cues.length > 0 ? (
          <div>
            <div style={{ color: BRAND.muted, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>Coaching Cues</div>
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
              {cues.map((c, i) => <li key={i} style={{ color: BRAND.text, fontSize: 14, lineHeight: 1.45 }}>{c}</li>)}
            </ol>
          </div>
        ) : (
          <div style={{ color: BRAND.dim, fontSize: 13 }}>No coaching cues yet.</div>
        )}

        {meta?.needsReview && (
          <div style={{ marginTop: 14, background: BRAND.card2, border: `${BRAND.hairline} solid ${BRAND.line}`, borderRadius: BRAND.radiusControl, padding: 10, color: BRAND.muted, fontSize: 12 }}>
            Flagged for coach review — best-effort tagging, double-check before relying on it.
          </div>
        )}
      </Card>
      {playingVideo && thumb && <VideoPlayerModal videoId={thumb.videoId} title={name} onClose={() => setPlayingVideo(false)} />}
    </div>
  );
}
