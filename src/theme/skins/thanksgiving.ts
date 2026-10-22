import { dress } from './layout';
import { shift, thanksgivingDay } from './dates';
import type { Skin } from './types';

// Thanksgiving: harvest gold by day, a dark-roast brown by night; the pig in a
// pilgrim's hat under falling leaves, holding a turkey. November 2 until
// the day after Thanksgiving (the fourth Thursday).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const thanksgiving: Skin = {
  id: 'thanksgiving',
  label: 'Thanksgiving',
  season: (year) => ({ from: [11, 2], to: shift(year, thanksgivingDay(year), 1) }),

  light: {
    background: '#E7B464',
    accent: '#7A2E0E',
    text: '#24160C',
    textMuted: '#4A2E14',
    surfaceText: '#24160C',
    surfaceInset: '#FBF0DE',
    overlay: 'rgba(36,22,12,0.84)',
    overlayLabel: '#FFC07A',
    button: 'rgba(110,46,14,0.9)',
    buttonPressed: '#4A1E08',
    link: '#5A230A',
    success: '#0B4A12',
    shadow: '#5A230A',
    divider: 'rgba(36,22,12,0.22)',
  },

  dark: {
    background: '#1C120B',
    accent: '#F0A04B',
    accentText: '#2A1400',
    text: '#F5EBDD',
    textMuted: '#C9B49A',
    surface: '#2E1F14',
    surfaceBorder: '#4A3423',
    surfaceText: '#F5EBDD',
    surfaceInset: '#24180F',
    overlay: '#33241A',
    overlayText: '#F5EBDD',
    overlayLabel: '#FFC07A',
    button: '#8A3B12',
    buttonPressed: '#A8501E',
    link: '#F5B26B',
    placeholder: '#A8957F',
    divider: 'rgba(245,235,221,0.22)',
  },

  decor: dress({ head: 'pilgrimHat', sky: ['leafRed', 'leafGold'], hold: 'turkey' }),
  trough: ['turkey'],
};
