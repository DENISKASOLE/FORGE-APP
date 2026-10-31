import { useLocation, useNavigate } from "react-router-dom";
import { BRAND } from "../../theme/tokens.js";
import { NavIcon } from "../../components/ui/NavIcon.jsx";
import { CoachIcon } from "../../components/ui/CoachIcon.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { COACH_NAV, TOOLS } from "./coachNav.js";

// Real desktop width only - reuses CoachDashboard's own isTablet ceiling
// (useIsMobile(1180)) as the sidebar's floor rather than inventing a new
// breakpoint. Below this, CoachBottomNav / the Tools tile grid /
// ClientView's tab-pill row are completely untouched - mobile and
// tablet see exactly what they always have (DECISIONS.md "Coach
// desktop web layout").
const DESKTOP_SIDEBAR_MIN = 1180;

function hrefFor(key) {
  if (key === "home") return "/coach";
  if (key === "clients") return "/coach/clients";
  return `/coach/${key}`;
}
// Same icon-family split CoachBottomNav already uses (home/gear are
// NavIcon, everything else is CoachIcon) - kept consistent rather than
// picking a new rule.
function iconFor(item) {
  return item.icon === "gear" || item.icon === "home"
    ? <NavIcon name={item.icon} size={17} color="currentColor" />
    : <CoachIcon name={item.icon} size={17} color="currentColor" />;
}
function linkStyle(active) {
  return {
    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
    padding: "9px 10px", borderRadius: BRAND.radiusControl, border: "none", cursor: "pointer",
    background: active ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
    color: active ? BRAND.text : BRAND.muted,
    fontFamily: BRAND.sans, fontSize: 13, fontWeight: active ? 600 : 500,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  };
}

// Persistent left nav for the coach app at real desktop widths -
// replaces having to go Home -> Tools -> tile -> screen with every
// section one click away, and stays mounted across both CoachDashboard
// and a client's own profile (ClientView.jsx's coach branch), so
// switching sections never requires hitting Back first. Self-derives
// the active item from the URL (both CoachDashboardRoute and
// CoachClientRoute are already param-driven - App.jsx) instead of
// requiring every caller to compute and pass one.
export function CoachSidebarShell({ children }) {
  const isDesktop = !useIsMobile(DESKTOP_SIDEBAR_MIN);
  const location = useLocation();
  const navigate = useNavigate();
  if (!isDesktop) return <>{children}</>;
  const seg = location.pathname.replace(/^\/coach\/?/, "").split("/")[0];
  const activeKey = seg || "home";
  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      <nav style={{
        width: 228, flexShrink: 0, position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh",
        overflowY: "auto", borderRight: `${BRAND.hairline} solid ${BRAND.line}`, padding: "18px 12px",
        display: "flex", flexDirection: "column", gap: 2, boxSizing: "border-box",
      }}>
        {/* No brand lockup here - CoachDashboard's/ClientView's own sticky
            header already shows "Forge", duplicating it would look sloppy. */}
        {COACH_NAV.filter((item) => item.key !== "tools").map((item) => (
          <button key={item.key} onClick={() => navigate(hrefFor(item.key))} style={linkStyle(activeKey === item.key)}>
            <span style={{ display: "grid", placeItems: "center", width: 17, height: 17, flexShrink: 0, color: activeKey === item.key ? BRAND.gold : BRAND.dim }}>{iconFor(item)}</span>
            {item.label}
          </button>
        ))}
        <div style={{ marginTop: 16, padding: "0 10px 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: BRAND.dim }}>Tools</div>
        {TOOLS.map((item) => (
          <button key={item.key} onClick={() => navigate(hrefFor(item.key))} style={linkStyle(activeKey === item.key)}>
            <span style={{ display: "grid", placeItems: "center", width: 17, height: 17, flexShrink: 0, color: activeKey === item.key ? item.color : BRAND.dim }}>{iconFor(item)}</span>
            {item.name}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
