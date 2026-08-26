import { BRAND } from "../../theme/tokens.js";
import { Button } from "./Button.jsx";
import { Card } from "./Card.jsx";
import { modalBackdrop } from "./modal.js";

export function VideoPlayerModal({ videoId, title, onClose }) {
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 420, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${BRAND.line}`, aspectRatio: "16/9", background: "#000" }}>
          <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} title={title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 600, marginTop: 10, textAlign: "center" }}>Form demonstration</div>
      </Card>
    </div>
  );
}
