import { dress } from './layout';
import type { Skin } from './types';

// Christmas: a frosted-pine mint by day, deep pine by night, candy-cane red
// buttons; the pig in a Santa hat holding a present, snowflakes falling.
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const christmas: Skin = {
  id: 'christmas',
  label: 'Christmas',
  season: { from: [12, 1], to: [12, 26] },

  light: {
    background: '#A8D5B5',
    accent: '#A3122A',
    text: '#10261A',
    textMuted: '#244A33',
    surfaceText: '#10261A',
    surfaceInset: '#EAF5EE',
    overlay: 'rgba(12,32,20,0.86)',
    overlayLabel: '#FF9AA8',
    button: 'rgba(163,18,42,0.92)',
    buttonPressed: '#6E0A1B',
    link: '#0E4A2A',
    success: '#0B4A12',
    shadow: '#0E4A2A',
    divider: 'rgba(16,38,26,0.22)',
  },

  dark: {
    background: '#0C1D15',
    accent: '#FF6B7A',
    accentText: '#2A0008',
    text: '#EAF4EE',
    textMuted: '#A9C4B3',
    surface: '#163126',
    surfaceBorder: '#2A4D3C',
    surfaceText: '#EAF4EE',
    surfaceInset: '#11261C',
    overlay: '#1A3A2C',
    overlayText: '#EAF4EE',
    overlayLabel: '#FF9AA8',
    button: '#A3122A',
    buttonPressed: '#C42A42',
    link: '#F2C14E',
    placeholder: '#8FAA9A',
    divider: 'rgba(234,244,238,0.22)',
  },

  decor: dress({ head: 'santaHat', sky: ['snowflake', 'snowflake'], hold: 'gift' }),
  trough: ['gift'],
};
