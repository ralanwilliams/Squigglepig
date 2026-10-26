import { dress } from './layout';
import type { Skin } from './types';

// Paul, a theme won in solo play (src/rewards/catalog.ts theme.paul): Sherwood
// Forest, men in tights. A leafy lime green by day and deep forest at night,
// lettering in the lime of an old movie poster, buttons in the hot pink of
// the tights. The pig in a feathered archer's cap, a longbow in its hoof,
// arrows flying past; a trough full of arrows. No season: it shows once its
// owner chooses it, except while a birthday or holiday is showing over it
// (index.ts UNLOCKABLE).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export const paul: Skin = {
  id: 'paul',
  label: 'Paul',

  light: {
    background: '#A8CF6A',
    accent: '#8A0E4A',
    text: '#142410',
    textMuted: '#22361C',
    surfaceText: '#142410',
    surfaceInset: '#F1F7E6',
    overlay: 'rgba(20,36,16,0.88)',
    overlayLabel: '#D7F25A',
    button: 'rgba(122,18,72,0.94)',
    buttonPressed: '#560C33',
    link: '#5A0F35',
    success: '#0B4A12',
    shadow: '#1F3A12',
    divider: 'rgba(20,36,16,0.22)',
  },

  dark: {
    background: '#0F2414',
    accent: '#FF5FA8',
    accentText: '#2A0016',
    text: '#EEF5E4',
    textMuted: '#A9BE9A',
    surface: '#1B3420',
    surfaceBorder: '#2F4D33',
    surfaceText: '#EEF5E4',
    surfaceInset: '#142A18',
    overlay: '#1F3A24',
    overlayText: '#EEF5E4',
    overlayLabel: '#D7F25A',
    button: '#8A1C55',
    buttonPressed: '#A52668',
    link: '#D7F25A',
    placeholder: '#8FA582',
    divider: 'rgba(238,245,228,0.22)',
  },

  decor: dress({ head: 'archerCap', sky: ['arrow'], hold: 'longbow' }),
  trough: ['arrow'],
};
