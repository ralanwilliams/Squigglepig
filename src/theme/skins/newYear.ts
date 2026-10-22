import { dress } from './layout';
import type { Skin } from './types';

// New Year: champagne by day, midnight navy and gold by night; the pig in a
// gold party hat with a party popper, fireworks overhead.
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const newYear: Skin = {
  id: 'newYear',
  label: 'New Year',
  season: { from: [12, 27], to: [1, 2] },

  light: {
    background: '#EAD9A8',
    accent: '#6A1B9A',
    text: '#1E1A10',
    textMuted: '#4A3F22',
    surfaceText: '#1E1A10',
    surfaceInset: '#FBF5E4',
    overlay: 'rgba(14,16,38,0.86)',
    overlayLabel: '#F2D27A',
    button: 'rgba(20,24,58,0.9)',
    buttonPressed: '#0A0D26',
    link: '#2A2F6B',
    success: '#0B4A12',
    shadow: '#14183A',
    divider: 'rgba(30,26,16,0.22)',
  },

  dark: {
    background: '#0B1026',
    accent: '#F2C94C',
    accentText: '#241A00',
    text: '#EEF0FA',
    textMuted: '#AEB4D2',
    surface: '#18203F',
    surfaceBorder: '#2C3763',
    surfaceText: '#EEF0FA',
    surfaceInset: '#121A35',
    overlay: '#1C2550',
    overlayText: '#EEF0FA',
    overlayLabel: '#F2D27A',
    button: '#3A3F8F',
    buttonPressed: '#5056B0',
    link: '#F2D27A',
    placeholder: '#8E95B8',
    divider: 'rgba(238,240,250,0.22)',
  },

  decor: dress({ head: 'goldHat', sky: [{ prop: 'fireworkGold', twinkle: true }, { prop: 'fireworkPink', twinkle: true }], hold: 'popper' }),
  trough: ['champagneGreen', 'champagneBlack', 'champagneRose'],
};
