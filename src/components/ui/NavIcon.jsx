import {
  House,
  ForkKnife,
  Barbell,
  User,
  ArrowLeft,
  ClipboardText,
  ChartLineUp,
  Image as ImageIcon,
  ChatCircle,
  CreditCard,
  Gear,
  CheckSquare,
} from "@phosphor-icons/react";

const NAV_ICON_COMPONENTS = {
  home: House,
  food: ForkKnife,
  train: Barbell,
  me: User,
  back: ArrowLeft,
  program: ClipboardText,
  progress: ChartLineUp,
  photo: ImageIcon,
  msg: ChatCircle,
  card: CreditCard,
  gear: Gear,
  check: CheckSquare,
};

export function NavIcon({ name, size = 21, color = "currentColor", rotate = 0 }) {
  const Icon = NAV_ICON_COMPONENTS[name];
  if (!Icon) return null;
  return (
    <span style={{ display: "inline-flex", color, transform: rotate ? `rotate(${rotate}deg)` : undefined }}>
      <Icon size={size} weight="bold" />
    </span>
  );
}
