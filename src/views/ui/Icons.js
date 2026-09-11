// SVG sprite shared by every screen. Rendered once in the root layout; use <Icon name="grid" />.
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="i-grid" viewBox="0 0 24 24"><path fill="currentColor" d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" opacity=".9" /></symbol>
        <symbol id="i-users" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></symbol>
        <symbol id="i-brief" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" d="M3 8h18v12H3zM8 8V5h8v3M3 13h18" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4zM8 12l3 3 5-6" /></symbol>
        <symbol id="i-build" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" d="M3 21h18M5 21V5l7-2 7 2v16M9 9h2M13 9h2M9 13h2M13 13h2M9 17h2M13 17h2" /></symbol>
        <symbol id="i-alert" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0M9 3l-2 2M15 3l2 2" /></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></symbol>
        <symbol id="i-folder" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M3 6h6l2 2h10v12H3z" /></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></symbol>
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></symbol>
        <symbol id="i-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="i-tasks" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4 7l2 2 4-4M4 15l2 2 4-4M13 7h7M13 15h7" /></symbol>
        <symbol id="i-flag" viewBox="0 0 24 24"><path fill="currentColor" d="M5 3v18h2v-7h11l-3-4 3-4H7V3z" /></symbol>
        <symbol id="i-leaf" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M5 19c0-8 6-13 14-13-1 8-6 13-14 13zM5 19l6-6" /></symbol>
        <symbol id="i-file" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" d="M6 3h8l4 4v14H6zM14 3v4h4" /></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></symbol>
        <symbol id="i-filter" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" d="M3 5h18l-7 8v6l-4-2v-4z" /></symbol>
        <symbol id="i-down" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4v11M7 10l5 5 5-5M4 20h16" /></symbol>
        <symbol id="i-chart" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M5 20V10M12 20V4M19 20v-7" /></symbol>
        <symbol id="i-circle-check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="i-login" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5M15 12H3M13 3h6v18h-6" /></symbol>
        <symbol id="i-logout" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5M21 12H9M11 3H5v18h6" /></symbol>
        <symbol id="i-dots" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2" fill="currentColor" /><circle cx="12" cy="12" r="2" fill="currentColor" /><circle cx="12" cy="19" r="2" fill="currentColor" /></symbol>
        <symbol id="i-mark" viewBox="0 0 48 48"><path d="M6 14 C3 11 5 6 10 6.5 L41 3 C45 2.6 47.5 6.5 45.5 10 L31 43 C29 47 24 46.5 22.5 43 Z" fill="#FFD21F" stroke="#FFD21F" strokeWidth="3" strokeLinejoin="round" /></symbol>
        <symbol id="i-mascot" viewBox="0 0 70 74">
          <ellipse cx="35" cy="14" rx="20" ry="8" fill="#FFE38A" opacity=".35" />
          <path d="M35 14 L4 6 L4 22 Z" fill="#FFE38A" opacity=".5" /><path d="M35 14 L66 6 L66 22 Z" fill="#FFE38A" opacity=".5" />
          <rect x="27" y="8" width="16" height="10" rx="3" fill="#FFD84D" stroke="#0A0A0B" strokeWidth="2" />
          <path d="M25 8 L35 2 L45 8 Z" fill="#1F1F23" stroke="#0A0A0B" strokeWidth="2" strokeLinejoin="round" />
          <path d="M27 18 H43 L47 64 H23 Z" fill="#FFFFFF" stroke="#0A0A0B" strokeWidth="2" strokeLinejoin="round" />
          <path d="M26.2 27 H43.8 L44.4 34 H25.6 Z" fill="#FFD21F" /><path d="M24.6 48 H45.4 L46 55 H24 Z" fill="#FFD21F" />
          <circle cx="31.5" cy="40" r="2.6" fill="#0A0A0B" /><circle cx="38.5" cy="40" r="2.6" fill="#0A0A0B" />
          <circle cx="32.4" cy="39.1" r=".9" fill="#fff" /><circle cx="39.4" cy="39.1" r=".9" fill="#fff" />
          <path d="M32 44.5 Q35 47.5 38 44.5" stroke="#0A0A0B" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <ellipse cx="28.5" cy="44" rx="2" ry="1.2" fill="#FF9DB8" /><ellipse cx="41.5" cy="44" rx="2" ry="1.2" fill="#FF9DB8" />
          <path d="M45 40 Q52 36 54 28" stroke="#0A0A0B" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <circle cx="54.5" cy="27" r="2.8" fill="#FFFFFF" stroke="#0A0A0B" strokeWidth="2" />
          <path d="M17 64 H53 Q56 64 55 68 H15 Q14 64 17 64 Z" fill="#1F1F23" stroke="#0A0A0B" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 71 Q13 67 18 71 T28 71 T38 71 T48 71 T58 71 T66 71" stroke="#FFD21F" strokeWidth="2" strokeLinecap="round" opacity=".7" fill="none" />
        </symbol>
      </defs>
    </svg>
  );
}

export function Icon({ name, size, style, className }) {
  const s = size ? { width: size, height: size, ...(style || {}) } : style;
  return <svg style={s} className={className}><use href={'#i-' + name} /></svg>;
}
