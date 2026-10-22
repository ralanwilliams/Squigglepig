import { held } from './layout';
import type { Placement, Skin } from './types';

// Halloween: a pumpkin-orange day and a midnight-purple night, the pig in a
// witch's hat with bats overhead, a jack-o'-lantern in its hoof. Every text
// pair meets WCAG AA (4.5:1, 3:1 for large bold text), noted beside each value
// that sits under text. High contrast ignores the palette (see Skin) but keeps
// the props.
export const halloween: Skin = {
  id: 'halloween',
  label: 'Halloween',
  season: { from: [10, 1], to: [11, 1] }, // October, plus the morning after

  light: {
    background: '#F39A3D', // pumpkin; text 8.3:1
    accent: '#5E1A8A', // purple; 4.8:1 on the pumpkin, white on it 10.6:1
    text: '#1C1020',
    textMuted: '#3D2516', // 6.4:1 on the pumpkin, 14:1 on white
    surfaceText: '#1C1020',
    surfaceInset: '#FBEBDB',
    overlay: 'rgba(28,14,36,0.82)', // text 12:1, label 7.9:1
    overlayLabel: '#FFB86B',
    button: 'rgba(58,20,88,0.85)', // white on it (over the pumpkin) 10.6:1
    buttonPressed: '#2A0E40',
    link: '#3A1258', // 6.8:1 on the pumpkin
    success: '#0B4A12', // 4.7:1 on the pumpkin
    shadow: '#3A1258',
    divider: 'rgba(28,16,32,0.22)', // text at 22%
  },

  dark: {
    background: '#170F21', // midnight purple; text 15.9:1
    accent: '#FF9A3C', // 8.8:1 on the background
    accentText: '#2A1400', // 8.3:1 on the orange
    text: '#F2EAF6',
    textMuted: '#B8A6C6', // 8.3:1 on the background, 7:1 on a card
    surface: '#2A1C38',
    surfaceBorder: '#45305A',
    surfaceText: '#F2EAF6',
    surfaceInset: '#1F1529',
    overlay: '#2E2040', // text 12.8:1, label 8.8:1
    overlayText: '#F2EAF6',
    overlayLabel: '#FFB86B',
    button: '#5A2E86', // white on it 8.9:1
    buttonPressed: '#7342A6', // 6.3:1
    link: '#FFB066', // 10.3:1
    placeholder: '#A08EAE', // 5.3:1 on a card
    divider: 'rgba(242,234,246,0.22)',
  },

  // Positions are measured on the light-mode images; x / y are the prop's
  // centre and w its width, all as fractions of the image. Each hat is placed
  // so its buckle (right of the hat's centre once tilted) sits midway between
  // the pig's eyes. The four stills share one drawing of the pig, so they
  // share one layout. The jack-o'-lantern hangs from the pig's hoof by its
  // stem, in the shared hold slot (layout.ts).
  decor: {
    home: [...still(), ...held('pumpkin', 'home')],
    join: [...still(), ...held('pumpkin', 'join')],
    lobby: [...still(), ...held('pumpkin', 'lobby')],
    cell: [...still(), ...held('pumpkin', 'cell')],
    waiting: [
      { prop: 'witchHat', x: 0.474, y: 0.239, w: 0.21, rotate: -10 },
      { prop: 'bat', x: 0.84, y: 0.3, w: 0.14, bob: true },
      { prop: 'bat', x: 0.88, y: 0.48, w: 0.09, rotate: 8, bob: true },
      { prop: 'bat', x: 0.73, y: 0.18, w: 0.1, rotate: -10, flip: true, bob: true },
      ...held('pumpkin', 'waiting'),
    ],
    winner: [
      { prop: 'witchHat', x: 0.3, y: 0.031, w: 0.24, rotate: -10 },
      { prop: 'bat', x: 0.85, y: 0.1, w: 0.17, bob: true },
      { prop: 'bat', x: 0.63, y: 0.07, w: 0.1, rotate: 8, bob: true },
      { prop: 'bat', x: 0.91, y: 0.48, w: 0.1, rotate: -10, flip: true, bob: true },
      ...held('pumpkin', 'winner'),
    ],
    canvasPig: [
      { prop: 'witchHat', x: 0.491, y: 0.08, w: 0.26, rotate: -8 },
      { prop: 'bat', x: 0.88, y: 0.22, w: 0.16, bob: true },
      { prop: 'bat', x: 0.77, y: 0.07, w: 0.1, rotate: 8, bob: true },
      { prop: 'bat', x: 0.93, y: 0.55, w: 0.1, rotate: -10, flip: true, bob: true },
    ],
  },
  trough: ['pumpkin'],
};

function still(): Placement[] {
  return [
    { prop: 'witchHat', x: 0.294, y: 0.0, w: 0.3, rotate: -10 },
    { prop: 'bat', x: 0.8, y: 0.13, w: 0.22, bob: true },
    { prop: 'bat', x: 0.66, y: 0.33, w: 0.14, rotate: 8, bob: true },
    { prop: 'bat', x: 0.9, y: 0.42, w: 0.12, rotate: -10, flip: true, bob: true },
  ];
}
