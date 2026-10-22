import { dress } from './layout';
import type { Skin } from './types';

// 4th of July: a clear summer sky by day, navy by night, flag-red buttons;
// the pig in an Uncle Sam hat waving a flag, fireworks overhead.
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const fourthOfJuly: Skin = {
  id: 'fourthOfJuly',
  label: '4th of July',
  season: { from: [7, 1], to: [7, 5] },

  light: {
    background: '#BFD7F2',
    accent: '#B3122E',
    text: '#0E1A2E',
    textMuted: '#2A3D5A',
    surfaceText: '#0E1A2E',
    surfaceInset: '#EEF4FB',
    overlay: 'rgba(14,26,46,0.86)',
    overlayLabel: '#FF9AA8',
    button: 'rgba(31,58,147,0.92)',
    buttonPressed: '#14276A',
    link: '#14276A',
    success: '#0B4A12',
    shadow: '#14276A',
    divider: 'rgba(14,26,46,0.22)',
  },

  dark: {
    background: '#0A1630',
    accent: '#FF5C6E',
    accentText: '#2A0008',
    text: '#EEF3FB',
    textMuted: '#A9B8D3',
    surface: '#16264A',
    surfaceBorder: '#2B3F6E',
    surfaceText: '#EEF3FB',
    surfaceInset: '#101E3D',
    overlay: '#1B2D57',
    overlayText: '#EEF3FB',
    overlayLabel: '#FF9AA8',
    button: '#B3122E',
    buttonPressed: '#D02A45',
    link: '#8FB8FF',
    placeholder: '#8D9BBA',
    divider: 'rgba(238,243,251,0.22)',
  },

  decor: dress({ head: 'unclesamHat', sky: [{ prop: 'fireworkRed', twinkle: true }, { prop: 'fireworkBlue', twinkle: true }], hold: 'flag' }),
  // Fireworks still waiting to go off.
  trough: ['rocketRed', 'rocketBlue', 'rocketWhite', 'rocketStars'],
};
