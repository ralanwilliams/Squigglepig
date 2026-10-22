import { dress } from './layout';
import type { Skin } from './types';

// Railroad, a theme won in solo play (src/rewards/catalog.ts theme.railroad):
// ballast-and-brass by day, a coal-black night lit by a lantern; navy
// buttons like a conductor's uniform. The pig in a conductor's cap, holding a
// red railroad lantern, steam puffing past; a trough full of coal. No season:
// it shows once its owner chooses it, except while a birthday or holiday is
// showing over it (index.ts UNLOCKABLE).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const railroad: Skin = {
  id: 'railroad',
  label: 'Railroad',

  light: {
    background: '#D4B27A',
    accent: '#8B1A1A',
    text: '#1A1410',
    textMuted: '#3B2E22',
    surfaceText: '#1A1410',
    surfaceInset: '#F6EEDF',
    overlay: 'rgba(26,20,16,0.86)',
    overlayLabel: '#FFC56B',
    button: 'rgba(30,42,72,0.92)',
    buttonPressed: '#141D33',
    link: '#1E2A48',
    success: '#0B4A12',
    shadow: '#1E2A48',
    divider: 'rgba(26,20,16,0.22)',
  },

  dark: {
    background: '#14171C',
    accent: '#FF9F43',
    accentText: '#2A1400',
    text: '#EEF0F2',
    textMuted: '#A9B0BA',
    surface: '#232830',
    surfaceBorder: '#39404B',
    surfaceText: '#EEF0F2',
    surfaceInset: '#1B1F25',
    overlay: '#262C35',
    overlayText: '#EEF0F2',
    overlayLabel: '#FFC56B',
    button: '#2F4A73',
    buttonPressed: '#3D5C8C',
    link: '#FFC56B',
    placeholder: '#8E96A1',
    divider: 'rgba(238,240,242,0.22)',
  },

  decor: dress({ head: 'conductorCap', sky: ['steam'], hold: 'lantern' }),
  trough: ['coalA', 'coalB'],
};
