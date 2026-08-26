const COACH_ICON_PATHS = {
  clients: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M22 20v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
  templates: <><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" /><rect x="14" y="3" width="7" height="4" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" /><rect x="14" y="11" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  analytics: <><path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M7 15l4-5 3 3 5-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  trials: <path d="M12 2.5l2.6 6.3 6.9.5-5.3 4.5 1.7 6.7L12 16.9 6.1 20.5l1.7-6.7L2.5 9.3l6.9-.5z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  exlib: <><rect x="2" y="6" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M17 9.5l5-3v11l-5-3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" /><path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
};

export function CoachIcon({ name, size = 22, color = "currentColor" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ color, display: "block" }}>{COACH_ICON_PATHS[name]}</svg>;
}
