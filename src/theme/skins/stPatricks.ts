import { dress } from './layout';
import type { Skin } from './types';

// St. Patrick's Day: clover green by day, a dark glen by night, gold for luck;
// the pig in a leprechaun's hat with a pot of gold, shamrocks drifting.
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const stPatricks: Skin = {
  id: 'stPatricks',
  label: 'St. Patrick\'s Day',
  season: { from: [3, 11], to: [3, 17] },

  light: {
    background: '#8FD19E',
    accent: '#6B4300',
    text: '#0E2414',
    textMuted: '#1F4A2A',
    surfaceText: '#0E2414',
    surfaceInset: '#EAF6ED',
    overlay: 'rgba(10,32,18,0.86)',
    overlayLabel: '#F7D46B',
    button: 'rgba(18,90,44,0.92)',
    buttonPressed: '#0C4220',
    link: '#0C4220',
    success: '#0B3D10',
    shadow: '#0C4220',
    divider: 'rgba(14,36,20,0.22)',
  },

  dark: {
    background: '#0A1D11',
    accent: '#F2C94C',
    accentText: '#241A00',
    text: '#E8F5EC',
    textMuted: '#A5C7AF',
    surface: '#143221',
    surfaceBorder: '#285039',
    surfaceText: '#E8F5EC',
    surfaceInset: '#0F2718',
    overlay: '#183A27',
    overlayText: '#E8F5EC',
    overlayLabel: '#F7D46B',
    button: '#1F7A3E',
    buttonPressed: '#1C6E37',
    link: '#7EE0A0',
    placeholder: '#8AAA94',
    divider: 'rgba(232,245,236,0.22)',
  },

  decor: dress({ head: 'leprechaunHat', sky: ['shamrock', 'shamrock'], hold: 'potOfGold' }),
  trough: ['coinFace', 'coinTilt', 'coinEdge'],
};
