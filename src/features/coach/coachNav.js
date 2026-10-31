// Shared coach navigation data - split out from CoachDashboard.jsx so
// CoachSidebarShell.jsx can import it without a circular dependency
// (CoachDashboard.jsx renders CoachSidebarShell, which needs this list).
import { BRAND } from "../../theme/tokens.js";

// The 5 top-level sections CoachBottomNav shows on mobile/tablet, and
// CoachSidebarShell shows directly on desktop (minus "tools", whose
// contents - TOOLS below - are listed as direct links there instead).
export const COACH_NAV = [
  { key: "home", label: "Home", icon: "home" },
  { key: "clients", label: "Clients", icon: "clients" },
  { key: "tools", label: "Tools", icon: "templates" },
  { key: "alerts", label: "Alerts", icon: "bell" },
  { key: "settings", label: "Settings", icon: "gear" },
];
// Every tool destination reachable from the "Tools" tab's tile grid on
// mobile/tablet (CoachToolsTab) - module-level so CoachSidebarShell can
// list them directly as desktop sidebar links without duplicating this
// list or the mobile tile grid having to change.
export const TOOLS = [
  { key: "templates", name: "Programs", meta: "Templates & builder", icon: "templates", color: BRAND.blue },
  { key: "exercise_library", name: "Exercise Library", meta: "Custom moves & video", icon: "exlib", color: BRAND.yellow },
  { key: "calendar", name: "Calendar", meta: "Sessions & bookings", icon: "calendar", color: BRAND.violet },
  { key: "analytics", name: "Analytics", meta: "Adherence & trends", icon: "analytics", color: BRAND.green },
  { key: "trials", name: "Trials", meta: "Consults & assessments", icon: "trials", color: BRAND.red },
  { key: "buddypairs", name: "Buddy Pairs", meta: "Two clients, one slot", icon: "buddypairs", color: BRAND.orange },
  { key: "content", name: "Content", meta: "Forge Academy articles", icon: "content", color: BRAND.blue },
  { key: "payments", name: "Payments", meta: "Plans & invoices", icon: "payments", color: BRAND.green },
  { key: "packages", name: "Packages", meta: "Design your offers", icon: "packages", color: BRAND.violet },
  { key: "forms", name: "Intake Forms", meta: "Onboarding & health", icon: "forms", color: BRAND.yellow },
  { key: "broadcast", name: "Broadcast", meta: "Message every client", icon: "broadcast", color: BRAND.red },
  { key: "automations", name: "Automations", meta: "Reminders & nudges", icon: "automations", color: BRAND.orange },
  { key: "foods", name: "Foods", meta: "Food library for nutrition plans", icon: "foods", color: BRAND.green },
  { key: "nutrition_dashboard", name: "Nutrition", meta: "Who needs attention today", icon: "foods", color: BRAND.red },
];
