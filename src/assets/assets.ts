// ASSET LOG: Modified pig avatar graphic 
// Licensed commercially from VectorStock (Invoice Number: 19096225) / Artist: izakowski
// Kept on file for Google Play developer policy compliance

import { assetSize } from '../lib/assetSize';

export const IMAGES = {
  home: require('./images/squigglepig_clear.png'),
  join: require('./images/squigglepig_join_game_clear.png'),
  lobby: require('./images/squigglepig_lobby_clear.png'),
  cell: require('./images/squigglepig_cell.png'),
  winner: require('./images/squigglepig_winner.gif'),
  waiting: require('./images/squigglepig.gif'),
  canvasPig: require('./images/canvas_pig.png'),
  icon: require('./images/logo-192X192.png'), // the app icon, for the menu drawer
};

// Dark-mode versions: the same art with a teal "sticker" border, so the black
// outline and the thin "squigglepig" wordmark don't sink into the dark
// background. Each has a transparent margin around the original for the
// border to grow into (the art touches the edges of most images); darkInset()
// lines the original area back up, so the pig lands exactly where the light
// one does. Made by scripts/dark-art.py — rerun it after changing any of the
// images above.
const DARK = new Map<number, number>([
  [IMAGES.home, require('./images/squigglepig_clear_dark.png')],
  [IMAGES.join, require('./images/squigglepig_join_game_clear_dark.png')],
  [IMAGES.lobby, require('./images/squigglepig_lobby_clear_dark.png')],
  [IMAGES.cell, require('./images/squigglepig_cell_dark.png')],
  [IMAGES.winner, require('./images/squigglepig_winner_dark.gif')],
  [IMAGES.waiting, require('./images/squigglepig_dark.gif')],
  [IMAGES.canvasPig, require('./images/canvas_pig_dark.png')],
]);

// The version of an image to show on the given palette (images without a
// dark version, like the app icon, come back unchanged).
export const artFor = (source: number, dark: boolean): number => (dark ? DARK.get(source) ?? source : source);

// Where the original image sits inside `art` (its dark version, or itself):
// the margin on each side and the padded size, in source pixels.
export function darkInset(source: number, art: number) {
  const s = assetSize(source);
  const a = assetSize(art);
  return { x: (a.width - s.width) / 2, y: (a.height - s.height) / 2, width: a.width, height: a.height, src: s };
}

export const SOUNDS = {
  grunt: require('./sounds/pigGrunt.mp3'),
  theme: require('./sounds/themeMusicXT.mp3'),
  winner: require('./sounds/winner.mp3'),
};
