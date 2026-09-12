// Design tokens. Colors are named by ROLE, not by what they look like, so the
// same name resolves to a sensible value in both themes: `surface` is a white
// card in light mode and a dark-teal card in dark mode; `text` is whatever reads
// on `background`. Components never pick a theme themselves — they call
// useTheme() (src/theme/theme.ts) and get the palette for the device setting.
//
// The light palette is the original Squigglepig CSS, verbatim.

export type Theme = {
  name: 'light' | 'dark';

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
  link: string; // quiet text actions: Leave game, Learn to Squiggle, stepper arrows

  placeholder: string; // input placeholder only
  success: string; // correct guess, ready dot
  danger: string; // wrong guess
  scrim: string; // modal backdrop
  shadow: string; // shadowColor on floating cards

  // Translucent prompt chips that sit straight on the background.
  chip: string;
  chipBorder: string;
};

export const light: Theme = {
  name: 'light',
  background: '#4ECDC4', // app background + brand turquoise (public/style.css)
  brand: '#4ECDC4',
  accent: 'palevioletred', // #DB7093 modal headers / quotes
  accentText: '#ffffff',
  text: '#212529', // bootstrap default text color on the teal background
  textMuted: '#6c757d',

  surface: '#ffffff',
  surfaceBorder: '#ced4da',
  surfaceText: '#212529',
  surfaceInset: '#EEF4F4',

  overlay: 'rgba(26,26,26,0.63)', // modal + cards
  overlayText: 'whitesmoke', // #F5F5F5
  overlayLabel: 'palevioletred',

  button: 'rgba(26,83,92,0.726)', // .btn-outline-dark background
  buttonPressed: '#0A434C', // .btn-outline-dark:hover
  buttonText: 'whitesmoke',
  link: '#0A434C',

  placeholder: '#6c757d',
  success: '#2e7d32',
  danger: '#c62828',
  scrim: 'rgba(0,0,0,0.4)',
  shadow: '#0A434C',

  chip: 'rgba(255,255,255,0.55)',
  chipBorder: 'rgba(255,255,255,0.7)',
};

export const dark: Theme = {
  name: 'dark',
  background: '#0B1F23', // the teal, nearly black
  brand: '#4ECDC4',
  accent: 'palevioletred',
  accentText: '#ffffff',
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
};

export const themes = { light, dark };

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
