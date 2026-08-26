const NAV_ICON_PATHS = {
  home: <path d="M3 11L12 3L21 11V21H15V14H9V21H3V11Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  food: <><path d="M6 2V10C6 11.6569 7.34315 13 9 13V13C10.6569 13 12 11.6569 12 10V2M9 13V22M6 2V6M12 2V6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M18 2C16 4 16 8 18 10V22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
  train: <path d="M6 7V17M18 7V17M2 10V14M22 10V14M6 12H18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  me: <><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M4 21C4 16.5 7.5 14 12 14C16.5 14 20 16.5 20 21" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
  back: <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
  program: <><rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M9 4V2H15V4M8 10H16M8 14H16M8 18H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  progress: <><path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 7H15M21 7V13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  photo: <><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="9" cy="10" r="1.6" fill="currentColor" /><path d="M21 15L16 10L7 19" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
  msg: <path d="M21 12C21 16.4183 16.9706 20 12 20C10.5 20 9.1 19.7 7.9 19.1L3 20L4.3 15.9C3.5 14.8 3 13.5 3 12C3 7.58172 7.02944 4 12 4C16.9706 4 21 7.58172 21 12Z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M2 10H22" stroke="currentColor" strokeWidth="2" /></>,
  gear: <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" fill="none" /></>,
  check: <><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
};

export function NavIcon({ name, size = 21, color = "currentColor", rotate = 0 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ color, display: "block", transform: rotate ? `rotate(${rotate}deg)` : undefined }}>{NAV_ICON_PATHS[name]}</svg>;
}
