/**
 * Design tokens for MRM Hub.
 * Kept in a plain .js module (no components) so editing them never breaks
 * fast refresh, and so pages can pull colours without importing the UI kit.
 */

export const T = {
  bg: '#0f1117',
  surface: '#141720',
  raised: '#181c28',
  border: '#212636',
  borderHi: '#2b3145',
  heading: '#ffffff',
  body: '#c7cbd6',
  muted: '#8892b0',
  faint: '#5b6478',
  accent: '#8b5cf6',
  accentGradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
};

/** Tinted colour triples. Every pill, stat card and icon chip picks one. */
export const TONES = {
  indigo: { fg: '#a5b4fc', bg: 'rgba(99,102,241,0.12)', bd: 'rgba(99,102,241,0.30)' },
  purple: { fg: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', bd: 'rgba(139,92,246,0.30)' },
  blue: { fg: '#60a5fa', bg: 'rgba(59,130,246,0.12)', bd: 'rgba(59,130,246,0.30)' },
  teal: { fg: '#2dd4bf', bg: 'rgba(20,184,166,0.12)', bd: 'rgba(20,184,166,0.30)' },
  green: { fg: '#34d399', bg: 'rgba(16,185,129,0.12)', bd: 'rgba(16,185,129,0.30)' },
  amber: { fg: '#fbbf24', bg: 'rgba(245,158,11,0.12)', bd: 'rgba(245,158,11,0.30)' },
  red: { fg: '#f87171', bg: 'rgba(239,68,68,0.12)', bd: 'rgba(239,68,68,0.30)' },
  grey: { fg: '#8892b0', bg: 'rgba(136,146,176,0.10)', bd: 'rgba(136,146,176,0.22)' },
};

export const toneOf = (name) => TONES[name] || TONES.grey;

/** The tiny uppercase caption used above every value in the Studio look. */
export const LABEL = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px',
  textTransform: 'uppercase', color: T.faint,
};

/** Standard table cell padding, shared by every data table. */
export const TD = {
  padding: '14px 16px', fontSize: '14px', color: T.body,
  borderBottom: `1px solid ${T.border}`, verticalAlign: 'middle',
};
