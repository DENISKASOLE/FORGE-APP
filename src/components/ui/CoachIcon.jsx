import {
  UsersThree,
  SquaresFour,
  Calendar,
  ChartBar,
  Trophy,
  VideoCamera,
  Bell,
  LinkSimple,
  Newspaper,
  CreditCard,
  Package,
  ClipboardText,
  Megaphone,
  Lightning,
} from "@phosphor-icons/react";

const COACH_ICON_COMPONENTS = {
  clients: UsersThree,
  templates: SquaresFour,
  calendar: Calendar,
  analytics: ChartBar,
  trials: Trophy,
  exlib: VideoCamera,
  bell: Bell,
  buddypairs: LinkSimple,
  content: Newspaper,
  payments: CreditCard,
  packages: Package,
  forms: ClipboardText,
  broadcast: Megaphone,
  automations: Lightning,
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
