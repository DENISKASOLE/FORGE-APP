import { BRAND } from "../../theme/tokens.js";

// Small neutral pill for a muscle-group/movement-pattern tag, matching the
// existing Tempo/RPE/Rest chip style used in WorkoutSession (TrainScreens.jsx)
// rather than introducing a new visual language.
const chipStyle = { fontFamily: BRAND.sans, fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", borderRadius: BRAND.radiusControl, padding: "4px 8px", whiteSpace: "nowrap" };

export function MuscleGroupTag({ muscleGroup, needsReview = false, style }) {
  if (!muscleGroup) return null;
  return (
    <span style={{ ...chipStyle, color: BRAND.muted, border: `${BRAND.hairline} solid ${BRAND.line}`, ...style }}>
      {muscleGroup}{needsReview ? " · Review" : ""}
    </span>
  );
}

export function MovementPatternTag({ movementPattern, style }) {
  if (!movementPattern) return null;
  return (
    <span style={{ ...chipStyle, color: BRAND.gold, border: `${BRAND.hairline} solid ${BRAND.gold}`, ...style }}>
      {movementPattern}
    </span>
  );
}
