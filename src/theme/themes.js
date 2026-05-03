// 5 modernized themes. The "slate" palette is the original ShiftyLog look
// (kept identical to the previous src/theme/colors.js so existing screenshots
// and muscle memory still match). Adding a new theme = duplicate one of these
// objects and tweak the values; every UI surface renders from these tokens.

const slate = {
  bg: '#0b1220',
  surface: '#142033',
  surfaceHov: '#1d2c45',
  surfaceAlt: '#101a2c',
  border: '#243653',
  borderFaint: '#1a273d',

  text: '#f1f5f9',
  textMuted: '#cbd5e1',
  textSubtle: '#94a3b8',
  textFaint: '#64748b',
  textDim: '#475569',

  accent: '#60a5fa',
  accentBright: '#93c5fd',
  accentDim: '#bfdbfe',
  accentDeep: '#3b82f6',
  accentBg: 'rgba(96,165,250,0.12)',
  accentBgStrong: 'rgba(96,165,250,0.22)',
  accentBorder: 'rgba(96,165,250,0.32)',
  accentInk: '#0b1220',

  danger: '#f87171',
  dangerBg: 'rgba(248,113,113,0.12)',
  dangerBorder: 'rgba(248,113,113,0.32)',

  green: '#34d399',
  greenBg: 'rgba(52,211,153,0.12)',

  overlay: 'rgba(2,6,15,0.7)',
};

// Deep, near-black with a violet accent — premium / minimal vibe.
const midnight = {
  bg: '#0a0a12',
  surface: '#15151f',
  surfaceHov: '#1f1f2c',
  surfaceAlt: '#101019',
  border: '#2a2a3a',
  borderFaint: '#1c1c28',

  text: '#f5f5fa',
  textMuted: '#d0d0d8',
  textSubtle: '#9090a4',
  textFaint: '#65657a',
  textDim: '#454556',

  accent: '#a78bfa',
  accentBright: '#c4b5fd',
  accentDim: '#ddd6fe',
  accentDeep: '#7c3aed',
  accentBg: 'rgba(167,139,250,0.12)',
  accentBgStrong: 'rgba(167,139,250,0.22)',
  accentBorder: 'rgba(167,139,250,0.32)',
  accentInk: '#0a0a12',

  danger: '#fb7185',
  dangerBg: 'rgba(251,113,133,0.12)',
  dangerBorder: 'rgba(251,113,133,0.32)',

  green: '#4ade80',
  greenBg: 'rgba(74,222,128,0.12)',

  overlay: 'rgba(0,0,4,0.75)',
};

// Forest — deep teal/green with a warm sage accent.
const forest = {
  bg: '#0a1410',
  surface: '#13201a',
  surfaceHov: '#1c2c25',
  surfaceAlt: '#0f1a14',
  border: '#234231',
  borderFaint: '#1a2c22',

  text: '#ecfdf5',
  textMuted: '#bbf7d0',
  textSubtle: '#86d4a3',
  textFaint: '#5e9476',
  textDim: '#3f6953',

  accent: '#4ade80',
  accentBright: '#86efac',
  accentDim: '#bbf7d0',
  accentDeep: '#16a34a',
  accentBg: 'rgba(74,222,128,0.12)',
  accentBgStrong: 'rgba(74,222,128,0.22)',
  accentBorder: 'rgba(74,222,128,0.32)',
  accentInk: '#0a1410',

  danger: '#fb7185',
  dangerBg: 'rgba(251,113,133,0.12)',
  dangerBorder: 'rgba(251,113,133,0.32)',

  green: '#4ade80',
  greenBg: 'rgba(74,222,128,0.12)',

  overlay: 'rgba(0,8,4,0.7)',
};

// Solar — warm cream paper with terracotta accents (the only light theme).
const solar = {
  bg: '#fbf7f0',
  surface: '#ffffff',
  surfaceHov: '#f5efe4',
  surfaceAlt: '#f8f3e8',
  border: '#e0d6c2',
  borderFaint: '#ece4d3',

  text: '#1c1917',
  textMuted: '#3f3a36',
  textSubtle: '#6b6259',
  textFaint: '#8b8278',
  textDim: '#a8a097',

  accent: '#dc6b3a',
  accentBright: '#c2410c',
  accentDim: '#9a3412',
  accentDeep: '#b45309',
  accentBg: 'rgba(220,107,58,0.12)',
  accentBgStrong: 'rgba(220,107,58,0.22)',
  accentBorder: 'rgba(220,107,58,0.32)',
  accentInk: '#ffffff',

  danger: '#dc2626',
  dangerBg: 'rgba(220,38,38,0.10)',
  dangerBorder: 'rgba(220,38,38,0.30)',

  green: '#059669',
  greenBg: 'rgba(5,150,105,0.10)',

  overlay: 'rgba(28,25,23,0.45)',
};

// Crimson — moody charcoal with red accents.
const crimson = {
  bg: '#100a0d',
  surface: '#1c1418',
  surfaceHov: '#291c22',
  surfaceAlt: '#160f12',
  border: '#3a242c',
  borderFaint: '#26181d',

  text: '#fef2f2',
  textMuted: '#fecaca',
  textSubtle: '#a89096',
  textFaint: '#7a6168',
  textDim: '#534148',

  accent: '#ef4444',
  accentBright: '#f87171',
  accentDim: '#fca5a5',
  accentDeep: '#b91c1c',
  accentBg: 'rgba(239,68,68,0.12)',
  accentBgStrong: 'rgba(239,68,68,0.22)',
  accentBorder: 'rgba(239,68,68,0.34)',
  accentInk: '#100a0d',

  danger: '#fb923c',
  dangerBg: 'rgba(251,146,60,0.12)',
  dangerBorder: 'rgba(251,146,60,0.32)',

  green: '#34d399',
  greenBg: 'rgba(52,211,153,0.12)',

  overlay: 'rgba(0,0,0,0.75)',
};

// Ocean — cool deep teal/cyan with bright cyan accents.
const ocean = {
  bg: '#04141c',
  surface: '#0c2230',
  surfaceHov: '#143042',
  surfaceAlt: '#081c28',
  border: '#1d4258',
  borderFaint: '#13303f',

  text: '#ecfeff',
  textMuted: '#a5f3fc',
  textSubtle: '#7dc7d4',
  textFaint: '#5d96a3',
  textDim: '#3e6470',

  accent: '#22d3ee',
  accentBright: '#67e8f9',
  accentDim: '#a5f3fc',
  accentDeep: '#0891b2',
  accentBg: 'rgba(34,211,238,0.12)',
  accentBgStrong: 'rgba(34,211,238,0.22)',
  accentBorder: 'rgba(34,211,238,0.32)',
  accentInk: '#04141c',

  danger: '#fb7185',
  dangerBg: 'rgba(251,113,133,0.12)',
  dangerBorder: 'rgba(251,113,133,0.32)',

  green: '#34d399',
  greenBg: 'rgba(52,211,153,0.12)',

  overlay: 'rgba(0,4,8,0.75)',
};

export const THEMES = {
  slate,
  midnight,
  forest,
  solar,
  crimson,
  ocean,
};

// Display order + metadata for the theme picker. `slate` first because it's
// the default; `solar` flagged as light so the picker can show a sun icon.
export const THEME_LIST = [
  { id: 'slate',    name: 'Slate',    description: 'The classic — steel blue on midnight', isLight: false },
  { id: 'midnight', name: 'Midnight', description: 'Near-black with violet accents',        isLight: false },
  { id: 'forest',   name: 'Forest',   description: 'Deep evergreen with sage green',         isLight: false },
  { id: 'ocean',    name: 'Ocean',    description: 'Cool teal with electric cyan',           isLight: false },
  { id: 'crimson',  name: 'Crimson',  description: 'Moody charcoal with crimson red',        isLight: false },
  { id: 'solar',    name: 'Solar',    description: 'Warm paper with terracotta',             isLight: true  },
];

export const DEFAULT_THEME_ID = 'slate';
