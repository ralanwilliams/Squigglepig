// Design tokens. Colors are named by ROLE, not by what they look like, so the
// same name resolves to a sensible value in both themes: `surface` is a white
// card in light mode and a dark-teal card in dark mode; `text` is whatever reads
// on `background`. Components never pick a theme themselves — they call
// useTheme() (src/theme/theme.ts) and get the palette for the device setting.
//
// The light palette started as the original Squigglepig CSS; a few values were
// deepened in 2.4.0 so every text pair meets WCAG AA (4.5:1, or 3:1 for large
// bold text) — the old value is noted beside each one that changed.
//
// There are four palettes: light and dark, each in normal and high contrast.
// High contrast keeps the same roles and the same layout — it swaps muted and
// translucent colors for solid ones and outlines cards (`edge`), so components
// get it for free by reading tokens.

export type Theme = {
  name: 'light' | 'dark';
  contrast: 'normal' | 'high';

  // The screen itself.
  background: string; // behind everything (was: brand teal)
  brand: string; // the turquoise as an accent (bold text in the how-to, logo)
  accent: string; // pink highlights: urgent countdown, labels, warn dots, badges
  accentText: string; // text sitting ON an accent-colored badge/pill
  text: string; // primary text on the background
  textMuted: string; // secondary text: labels, "+N more", empty states

  // Cards, inputs, score rows, speech bubbles.
  surface: string;
  surfaceBorder: string;
  surfaceText: string;
  surfaceInset: string; // a recessed panel inside a card (room code chip, stepper pill)

  // The dark translucent panel: how-to modal, prompt / score cards on reveal.
  overlay: string;
  overlayText: string;
  overlayLabel: string; // the pink label / quote on an overlay

  // Buttons and links.
  button: string;
  buttonPressed: string;
  buttonText: string;
  link: string; // quiet text actions: Leave game, Skip, stepper arrows, the menu glyphs

  placeholder: string; // input placeholder only
  success: string; // correct guess, ready dot
  danger: string; // wrong guess
  scrim: string; // modal backdrop
  shadow: string; // shadowColor on floating cards

  // Translucent prompt chips that sit straight on the background.
  chip: string;
  chipBorder: string;

  // Hairline rules drawn straight on the background (the menu drawer).
  divider: string;

  // Outlines. `edge` is the border width drawn around cards and overlays (0 =
  // none: normal contrast separates them by fill alone); inputs and chips that
  // always have a border use max(1, edge). `overlayBorder` is its color on an
  // overlay panel (surfaces use surfaceBorder).
  edge: number;
  overlayBorder: string;
};

export const light: Theme = {
  name: 'light',
  contrast: 'normal',
  background: '#4ECDC4', // app background + brand turquoise (public/style.css)
  brand: '#4ECDC4',
  accent: '#AD1457', // was palevioletred: white on it was 3.1:1, now 7:1; 3.6:1 on the teal (large text only)
  accentText: '#ffffff',
  text: '#212529', // bootstrap default text color on the teal background
  textMuted: '#33494C', // was #6c757d (2.5:1 on the teal), now 4.9:1 on the teal, 9:1 on white

  surface: '#ffffff',
  surfaceBorder: '#ced4da',
  surfaceText: '#212529',
  surfaceInset: '#EEF4F4',

  overlay: 'rgba(26,26,26,0.78)', // was 0.63: the pink label on it was 2.4:1
  overlayText: 'whitesmoke', // #F5F5F5
  overlayLabel: '#F4A6C0', // was palevioletred; 5.8:1 on the overlay

  button: 'rgba(26,83,92,0.726)', // .btn-outline-dark background
  buttonPressed: '#0A434C', // .btn-outline-dark:hover
  buttonText: 'whitesmoke',
  link: '#0A434C',

  placeholder: '#6c757d',
  success: '#0F5216', // was #2e7d32 (2.7:1 on the teal), now 4.9:1
  danger: '#c62828',
  scrim: 'rgba(0,0,0,0.4)',
  shadow: '#0A434C',

  chip: 'rgba(255,255,255,0.55)',
  chipBorder: 'rgba(255,255,255,0.7)',

  divider: 'rgba(33,37,41,0.22)', // text at 22%

  edge: 0,
  overlayBorder: 'transparent',
};

export const dark: Theme = {
  name: 'dark',
  contrast: 'normal',
  background: '#0B1F23', // the teal, nearly black
  brand: '#4ECDC4',
  accent: 'palevioletred',
  accentText: '#2A0D18', // was #ffffff (3.1:1 on the pink); dark ink is 5.8:1
  text: '#E6EDEE',
  textMuted: '#9BB0B3',

  surface: '#16333A',
  surfaceBorder: '#2B4F56',
  surfaceText: '#E6EDEE',
  surfaceInset: '#0F282D',

  overlay: '#1A373D', // lighter than the background, so the panel still lifts
  overlayText: '#E6EDEE',
  overlayLabel: '#E98CA8',

  button: '#1F5F69',
  buttonPressed: '#2A7A86', // press states go LIGHTER in the dark
  buttonText: 'whitesmoke',
  link: '#7FD8D0',

  placeholder: '#8A9CA0',
  success: '#6FCF7A',
  danger: '#FF6B6B',
  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',

  chip: 'rgba(255,255,255,0.10)',
  chipBorder: 'rgba(255,255,255,0.18)',

  divider: 'rgba(230,237,238,0.22)', // text at 22%

  edge: 0,
  overlayBorder: 'transparent',
};

// High contrast, light. Keeps the brand teal behind everything (the artwork is
// drawn for it, and black on it is already 10.9:1); text goes black, buttons
// and overlays go solid and near-black, and cards get a black outline.
export const lightHC: Theme = {
  name: 'light',
  contrast: 'high',
  background: '#4ECDC4',
  brand: '#4ECDC4',
  accent: '#8E0F45', // white on it 9.1:1, 4.7:1 on the teal
  accentText: '#ffffff',
  text: '#000000',
  textMuted: '#000000', // nothing is dimmed

  surface: '#ffffff',
  surfaceBorder: '#000000',
  surfaceText: '#000000',
  surfaceInset: '#E3EEEE',

  overlay: '#0A0A0A',
  overlayText: '#ffffff',
  overlayLabel: '#FFB3CC',

  button: '#003B44', // solid: white on it 12.3:1
  buttonPressed: '#000000',
  buttonText: '#ffffff',
  link: '#00262C', // 8.3:1 on the teal

  placeholder: '#4a4f54', // 8.3:1 on white
  success: '#0B4D14',
  danger: '#9B0000',
  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',

  chip: '#ffffff',
  chipBorder: '#000000',

  divider: '#000000',

  edge: 2,
  overlayBorder: '#000000',
};

// High contrast, dark: black and white, bright accents, every panel outlined
// in white so nothing depends on two dark tones being told apart.
export const darkHC: Theme = {
  name: 'dark',
  contrast: 'high',
  background: '#000000',
  brand: '#5CE1D6',
  accent: '#FF8FB3', // 9.8:1 on black
  accentText: '#000000',
  text: '#ffffff',
  textMuted: '#D6E0E1',

  surface: '#000000',
  surfaceBorder: '#ffffff',
  surfaceText: '#ffffff',
  surfaceInset: '#1A1A1A',

  overlay: '#000000',
  overlayText: '#ffffff',
  overlayLabel: '#FFB3CC',

  button: '#5CE1D6', // bright teal with black text, 13.2:1
  buttonPressed: '#A6F2EC',
  buttonText: '#000000',
  link: '#7FF5EC',

  placeholder: '#C0C8C9',
  success: '#7CFF8A',
  danger: '#FF8080',
  scrim: 'rgba(0,0,0,0.8)',
  shadow: '#000000',

  chip: '#000000',
  chipBorder: '#ffffff',

  divider: '#ffffff',

  edge: 2,
  overlayBorder: '#ffffff',
};

export const themes = {
  light: { normal: light, high: lightHC },
  dark: { normal: dark, high: darkHC },
};

// Deliberately NOT themed: the dark-mode toggle's sun / moon is one amber on
// both palettes, so it reads as a sun and a moon rather than as text.
export const glyph = {
  sun: '#F4B400',
};

// Deliberately NOT themed: a drawing is white paper with black ink in both
// modes, so a picture looks the same on every player's phone and in the reveal.
export const canvas = {
  fill: '#ffffff',
  border: '#000000',
  ink: '#000000',
};

// Deliberately NOT themed: the judge's ✓ / ✗ is a solid disc with a white
// mark, the same on every palette, because it lands on the white paper of a
// drawing as often as on the screen. Both are 5:1+ against white. Told apart
// by the mark, never by the color alone.
export const verdict = {
  yes: '#1B7F3A',
  no: '#C62828',
  mark: '#ffffff',
};

export const layout = {
  maxWidth: 500, // #root max-width
  radius: 8, // .btn border-radius
  imageRadius: 15, // canvas / image border-radius
  gap: 16,
  padding: 16,
};

// Bootswatch "Materia" uses Roboto. Loaded at runtime via @expo-google-fonts/roboto.
export const font = {
  regular: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  bold: 'Roboto_700Bold',
};
