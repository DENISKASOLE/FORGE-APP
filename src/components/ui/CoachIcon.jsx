import {
  UsersThree,
  SquaresFour,
  Calendar,
  ChartBar,
  Trophy,
  VideoCamera,
  Bell,
} from "@phosphor-icons/react";

const COACH_ICON_COMPONENTS = {
  clients: UsersThree,
  templates: SquaresFour,
  calendar: Calendar,
  analytics: ChartBar,
  trials: Trophy,
  exlib: VideoCamera,
  bell: Bell,
};

export function CoachIcon({ name, size = 22, color = "currentColor" }) {
  const Icon = COACH_ICON_COMPONENTS[name];
  if (!Icon) return null;
  return (
    <span style={{ display: "inline-flex", color }}>
      <Icon size={size} weight="bold" />
    </span>
  );
}
