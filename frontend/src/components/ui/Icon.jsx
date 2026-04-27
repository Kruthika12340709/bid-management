import React from 'react';

export const Icon = {
  search:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>,
  bell:      (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>,
  chevDown:  (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  check:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  flag:      (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4a2 2 0 0 1 2-2h11l-2 5 2 5H6"/></svg>,
  alert:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  arrow:     (s=14, dir='right') => {
    const path = dir==='right' ? 'M5 12h14M12 5l7 7-7 7' : 'M19 12H5M12 5l-7 7 7 7';
    return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>;
  },
  trendUp:   (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 5-5 4 4 7-7"/><path d="M14 6h8v8"/></svg>,
  trendDown: (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 10 5 5 4-4 7 7"/><path d="M14 18h8v-8"/></svg>,
  send:      (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>,
  pound:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 7c0-3-1.5-5-5-5s-5 2-5 5c0 2 1 4 1 6 0 2-3 4-3 4h12"/><path d="M6 14h11"/></svg>,
  clock:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  layers:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>,
  doc:       (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  audit:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v4H3zM3 11h18v4H3zM3 19h18v2H3z"/></svg>,
  shield:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  wifi:      (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/></svg>,
  battery:   (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/><rect x="4" y="9" width="11" height="6" fill="currentColor" stroke="none"/></svg>,
  speaker:   (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  briefcase: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  plus:      (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
};

export const AppIcon = {
  files: () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="6" y="10" width="20" height="6" rx="2" fill="#FFC107"/>
      <rect x="6" y="14" width="28" height="20" rx="3" fill="#FFD54F"/>
      <rect x="6" y="14" width="28" height="3" fill="#FFB300"/>
    </svg>
  ),
  word: () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="6" y="6" width="28" height="28" rx="4" fill="#2B579A"/>
      <text x="20" y="26" textAnchor="middle" fontFamily="Poppins" fontWeight="800" fontSize="14" fill="#fff">W</text>
    </svg>
  ),
  ppt: () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="6" y="6" width="28" height="28" rx="4" fill="#D24726"/>
      <text x="20" y="26" textAnchor="middle" fontFamily="Poppins" fontWeight="800" fontSize="14" fill="#fff">P</text>
    </svg>
  ),
  excel: () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="6" y="6" width="28" height="28" rx="4" fill="#107C41"/>
      <text x="20" y="26" textAnchor="middle" fontFamily="Poppins" fontWeight="800" fontSize="14" fill="#fff">X</text>
    </svg>
  ),
  bid: () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <defs>
        <linearGradient id="bidg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A855F7"/>
          <stop offset="50%" stopColor="#6B8EF0"/>
          <stop offset="100%" stopColor="#01CAB8"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="32" height="32" rx="8" fill="url(#bidg)"/>
      <path d="M14 12h12v3H14zM14 18h12v3H14zM14 24h8v3h-8z" fill="#fff"/>
      <circle cx="28" cy="26" r="3" fill="#CF008B" stroke="#fff" strokeWidth="1.5"/>
    </svg>
  ),
  mail: () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="5" y="9" width="30" height="22" rx="3" fill="#0078D4"/>
      <path d="M5 11l15 11 15-11" stroke="#fff" strokeWidth="2" fill="none"/>
    </svg>
  ),
  edge: () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="14" fill="#0078D4"/>
      <path d="M14 18a8 8 0 0 1 14-2 9 9 0 0 0-12 0c-3 4-3 9 0 12a8 8 0 0 1-2-10z" fill="#fff"/>
    </svg>
  ),
  teams: () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="4" y="10" width="22" height="20" rx="3" fill="#5059C9"/>
      <text x="15" y="25" textAnchor="middle" fontFamily="Poppins" fontWeight="800" fontSize="13" fill="#fff">T</text>
      <circle cx="30" cy="14" r="6" fill="#7B83EB"/>
    </svg>
  ),
};

export default Icon;
