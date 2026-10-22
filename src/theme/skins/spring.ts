import { dress } from './layout';
import type { Skin } from './types';

// Spring: new-leaf green by day, a soft night garden; the pig in a daisy
// crown, butterflies about, a bunch of tulips in its hoof. From the equinox to the end of
// May, giving way to Easter while that's on (SKINS lists Easter first).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const spring: Skin = {
  id: 'spring',
  label: 'Spring',
  season: { from: [3, 20], to: [5, 31] },

  light: {
    background: '#CDEBA7',
    accent: '#7B2D8E',
    text: '#16240F',
    textMuted: '#33482A',
    surfaceText: '#16240F',
    surfaceInset: '#F1F9E7',
    overlay: 'rgba(22,36,15,0.86)',
    overlayLabel: '#FFC1E0',
    button: 'rgba(46,96,32,0.92)',
    buttonPressed: '#264D1B',
    link: '#2A5A1E',
    success: '#0B4A12',
    shadow: '#2A5A1E',
    divider: 'rgba(22,36,15,0.22)',
  },

  dark: {
    background: '#111D0E',
    accent: '#F7A8D0',
    accentText: '#2A0A1C',
    text: '#EEF6E6',
    textMuted: '#B3C7A5',
    surface: '#1E3018',
    surfaceBorder: '#344D2B',
    surfaceText: '#EEF6E6',
    surfaceInset: '#172613',
    overlay: '#233A1C',
    overlayText: '#EEF6E6',
    overlayLabel: '#FFC1E0',
    button: '#3F7A2E',
    buttonPressed: '#3D732C',
    link: '#B6E38A',
    placeholder: '#93A887',
    divider: 'rgba(238,246,230,0.22)',
  },

  decor: dress({ head: 'flowerCrown', sky: ['butterfly', 'butterfly'], hold: 'tulips' }),
  trough: ['daisyWhite', 'daisyPink', 'daisyLavender'],
};
