// Vector props that seasonal skins draw on top of the pig artwork: hats, bats,
// pumpkins, balloons, a birthday cake. Plain path data, no images — a prop
// costs a few hundred bytes instead of a second copy of every PNG and GIF, and
// stays sharp at any size. SkinDecor (src/components/SkinDecor.tsx) renders
// them.
//
// Each prop is drawn on a grid `w` units wide and `h` tall. A shape with
// `line` gets the art's black outline; one without (highlights, glints) is
// flat color. The outline and the dark-mode "sticker" rim are sized by
// SkinDecor from how big the prop is on the image, so they match the line
// weight of the pig they sit on at any size.
//
// `anchor` is the grid point a placement's x / y refers to (and the prop
// turns about): the centre unless given. Hats and headbands anchor where they
// meet the head, held props where the pig's hoof grips them (a stem, a bow, a
// handle), so the shared slots in layout.ts fit every prop of a kind. `text` is a slot for words a placement supplies
// (the name on a birthday cake): centred on x, baseline y, `size` units tall
// at most and shrunk to fit `maxW`. With `shade` and `shine` the words are
// piped, like icing: plump rounded strokes in `fill`, a darker edge below and
// a glossy one above.

export type Shape = { d: string; fill: string; line?: boolean };
// `lines: 2` lets the words wrap onto a second line (a speech bubble's), and
// then `y` is the middle of the block rather than a baseline.
export type TextSlot = { x: number; y: number; size: number; maxW: number; fill: string; shade?: string; shine?: string; lines?: 2 };
// `behind` draws a prop under the artwork instead of over it, so the pig hides
// part of it (something peeking out from behind the pig).
// `pile` scales a prop in the trough (trough.ts troughScale): the daisies,
// a single flower each, are drawn bigger than the rest.
// `rim: false` leaves a prop out of the dark-mode sticker rim: the hooves
// below are redrawn over things the pig holds, inside its outline, where the
// art has no rim.
// `head` marks something worn on the head (a hat, a crown) and `eyes` over
// the eyes (a visor): a player's own hat or sunglasses (src/avatar) replace
// the theme's on the winner pig.
export type Prop = {
  w: number;
  h: number;
  anchor?: [number, number];
  text?: TextSlot;
  behind?: true;
  pile?: number;
  rim?: false;
  head?: true;
  eyes?: true;
  shapes: Shape[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;

// An ellipse as a path, so every shape is one <Path>.
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);
const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`;

// A star with n points (outer radius R, inner r), one point straight up.
function star(cx: number, cy: number, R: number, r: number, n = 5) {
  let d = '';
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${r1(cx + rad * Math.cos(a))} ${r1(cy + rad * Math.sin(a))}`;
  }
  return d + 'Z';
}

// A jagged burst round an ellipse: n spikes out to rx / ry, the notches
// between them pulled in to `inset` of that (a shout).
function burst(cx: number, cy: number, rx: number, ry: number, n: number, inset: number) {
  let d = '';
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const k = i % 2 ? inset : 1;
    d += `${i ? 'L' : 'M'}${r1(cx + rx * k * Math.cos(a))} ${r1(cy + ry * k * Math.sin(a))}`;
  }
  return d + 'Z';
}

// n beads of radius r piped around an ellipse's rim (one path).
function beads(cx: number, cy: number, rx: number, ry: number, n: number, r: number) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    d += circle(r1(cx + rx * Math.cos(a)), r1(cy + ry * Math.sin(a)), r);
  }
  return d;
}

// A heart about s units from its middle to each lobe.
const heart = (cx: number, cy: number, s: number) =>
  `M${cx} ${r1(cy + s)}C${r1(cx - s * 1.6)} ${r1(cy + s * 0.1)} ${r1(cx - s * 1.1)} ${r1(cy - s * 1.2)} ${cx} ${r1(cy - s * 0.45)}` +
  `C${r1(cx + s * 1.1)} ${r1(cy - s * 1.2)} ${r1(cx + s * 1.6)} ${r1(cy + s * 0.1)} ${cx} ${r1(cy + s)}Z`;

const ORANGE = '#F07F1E';
const GLOW = '#FFD23F'; // candlelight through a carved face, a bat's eyes
const PIG = '#FEA0B2'; // the pig's own pink (hooves drawn over a prop)
const HOOF = '#1B1B1B';
const WHITE = '#F7F7F7';

// ---- Shapes several props share ------------------------------------------

function balloon(color: string, shine: string): Prop {
  return {
    w: 100,
    h: 112,
    shapes: [
      { d: 'M50 74C44 86 56 96 48 110L50 110C58 96 46 86 52 74Z', fill: '#5F5F5F', line: true }, // string
      { d: 'M45 76L55 76L50 69Z', fill: color, line: true }, // knot
      { d: ellipse(50, 38, 28, 33), fill: color, line: true },
      { d: ellipse(40, 26, 5, 10), fill: shine },
    ],
  };
}

function firework(color: string, core: string): Prop {
  return {
    w: 100,
    h: 100,
    shapes: [
      { d: star(50, 50, 48, 24, 10), fill: color, line: true },
      { d: star(50, 50, 24, 12, 8), fill: core, line: true },
      { d: circle(50, 50, 6), fill: WHITE },
    ],
  };
}

function gift(box: string, lid: string, ribbon: string): Prop {
  return {
    w: 100,
    h: 92,
    anchor: [50, 30], // held by the bow
    shapes: [
      { d: 'M50 34C40 16 20 18 28 32C32 37 44 37 50 34Z', fill: ribbon, line: true }, // bow
      { d: 'M50 34C60 16 80 18 72 32C68 37 56 37 50 34Z', fill: ribbon, line: true },
      { d: rect(16, 46, 68, 44), fill: box, line: true },
      { d: rect(10, 32, 80, 15), fill: lid, line: true },
      { d: rect(44, 32, 12, 58), fill: ribbon, line: true },
      { d: rect(20, 50, 6, 34), fill: 'rgba(255,255,255,0.25)' }, // shine
    ],
  };
}

function leaf(color: string, vein: string): Prop {
  return {
    w: 100,
    h: 96,
    shapes: [
      { d: 'M48.5 60L48.5 94L51.5 94L51.5 60Z', fill: vein, line: true }, // stem
      {
        d: 'M50 4L58 22L72 14L68 32L88 34L74 48L82 58L60 56L54 72L50 62L46 72L40 56L18 58L26 48L12 34L32 32L28 14L42 22Z',
        fill: color,
        line: true,
      },
      { d: 'M49.2 20L50.8 20L50.8 62L49.2 62Z', fill: vein }, // veins
      { d: 'M50 44L30 36L31 34.5L50 42Z', fill: vein },
      { d: 'M50 44L70 36L69 34.5L50 42Z', fill: vein },
    ],
  };
}

function popHat(cone: string, stripe: string, pom: string): Prop {
  return {
    head: true,
    w: 100,
    h: 100,
    anchor: [50, 92],
    shapes: [
      { d: 'M24 90L50 14L76 90Q50 99 24 90Z', fill: cone, line: true },
      { d: 'M41.4 40L58.6 40L62 50L38 50Z', fill: stripe, line: true },
      { d: 'M33.3 64L66.7 64L70 74L30 74Z', fill: stripe, line: true },
      { d: circle(50, 12, 9), fill: pom, line: true },
    ],
  };
}

// A painted Easter egg: a zigzag band, polka dots or two stripes in `paint`.
function egg(shell: string, paint: string, pattern: 'zigzag' | 'dots' | 'stripes'): Prop {
  const decor: Record<typeof pattern, Shape[]> = {
    zigzag: [{ d: 'M7 50L14 43L21 50L28 43L35 50L42 43L49 50L56 43L63 50L63.6 59L56 52L49 59L42 52L35 59L28 52L21 59L14 52L6.5 59Z', fill: paint, line: true }],
    dots: [{ d: circle(24, 36, 4.5) + circle(46, 30, 4.5) + circle(18, 60, 4.5) + circle(38, 54, 4.5) + circle(54, 70, 4.5) + circle(30, 77, 4), fill: paint }],
    stripes: [
      { d: 'M8 40Q35 48 62 40L63.2 48Q35 56 6.8 48Z', fill: paint, line: true },
      { d: 'M6.5 64Q35 72 63.5 64L62.2 72Q35 80 7.8 72Z', fill: paint, line: true },
    ],
  };
  return {
    w: 70,
    h: 92,
    shapes: [
      { d: 'M35 4C52 4 64 36 64 58C64 76 51 89 35 89C19 89 6 76 6 58C6 36 18 4 35 4Z', fill: shell, line: true },
      ...decor[pattern],
      { d: ellipse(23, 26, 4.5, 9), fill: 'rgba(255,255,255,0.55)' }, // shine
    ],
  };
}

// A firework rocket, not yet lit: a body with stripes or stars, a cone, fins
// and a fuse.
function rocket(body: string, trim: string, cone: string, pattern: 'stripes' | 'stars'): Prop {
  return {
    w: 44,
    h: 104,
    shapes: [
      { d: 'M22 10C22 5 26 2 30 2', fill: 'none', line: true }, // fuse
      { d: 'M8 78L1 98L9 92ZM36 78L43 98L35 92Z', fill: cone, line: true }, // fins
      { d: rect(9, 32, 26, 60), fill: body, line: true },
      ...(pattern === 'stripes'
        ? [{ d: rect(9, 46, 26, 7) + rect(9, 64, 26, 7), fill: trim, line: true }]
        : [{ d: star(22, 50, 6, 2.5) + star(22, 70, 6, 2.5), fill: trim }]),
      { d: 'M9 32L22 10L35 32Z', fill: cone, line: true },
      { d: rect(12, 36, 3, 52), fill: 'rgba(255,255,255,0.3)' }, // shine
    ],
  };
}

// A champagne bottle: foil on the neck, a label on the body.
function champagne(glass: string, label: string, foil: string): Prop {
  return {
    w: 40,
    h: 104,
    shapes: [
      { d: 'M9 101Q4 101 4 95L4 54Q4 42 15 35L15 14L25 14L25 35Q36 42 36 54L36 95Q36 101 31 101Z', fill: glass, line: true },
      { d: 'M14 3L26 3L26 27Q20 31 14 27Z', fill: foil, line: true }, // foil
      { d: rect(6, 58, 28, 24), fill: label, line: true },
      { d: rect(6, 58, 28, 5), fill: foil, line: true },
      { d: 'M9 50L9 92L12 92L12 50Z', fill: 'rgba(255,255,255,0.3)' }, // shine
    ],
  };
}

// A gold coin with a shamrock stamped on it: face on, tilted, or on its edge.
function coin(tilt: number): Prop {
  const ry = 46 * tilt;
  const clover = tilt > 0.5;
  return {
    w: 100,
    h: 100,
    shapes: [
      { d: `M4 50L4 60A46 ${ry} 0 0 0 96 60L96 50Z`, fill: '#C89B1C', line: true }, // the rim's thickness
      { d: ellipse(50, 50, 46, ry), fill: '#F4C430', line: true },
      { d: ellipse(50, 50, 36, ry * 0.78), fill: '#F7D35A', line: true },
      ...(clover
        ? [{ d: heart(50, 50 - 10 * tilt, 8 * tilt) + heart(41, 54, 8 * tilt) + heart(59, 54, 8 * tilt), fill: '#C89B1C' }]
        : []),
      { d: ellipse(34, 50 - ry * 0.4, 6, ry * 0.18), fill: 'rgba(255,255,255,0.6)' }, // glint
    ],
  };
}

// One daisy, as on the spring crown: six pointed petals round a yellow middle.
function daisy(petals: string): Prop {
  return {
    w: 100,
    h: 100,
    pile: 1.25,
    shapes: [
      { d: star(50, 50, 48, 30, 6), fill: petals, line: true },
      { d: circle(50, 50, 18), fill: '#FFD23F', line: true },
      { d: circle(44, 44, 5), fill: 'rgba(255,255,255,0.6)' }, // shine
    ],
  };
}

// ---- The props -------------------------------------------------------------

export const PROPS = {
  // Halloween
  witchHat: {
    head: true,
    w: 100,
    h: 96,
    shapes: [
      { d: ellipse(50, 84, 48, 11), fill: '#2E1F3F', line: true }, // brim
      { d: 'M20 84 C28 62 34 42 42 26 C48 14 58 6 76 4 C68 12 64 22 64 32 C66 52 72 68 80 84 Q50 93 20 84Z', fill: '#2E1F3F', line: true },
      { d: 'M36 70 C38 56 43 42 50 29 C46 44 42 56 41 70Z', fill: '#4E3868' }, // highlight
      { d: 'M24 74 Q50 80 76 74 L78.5 82 Q50 89 21.5 82Z', fill: ORANGE, line: true }, // band
      { d: 'M44 75.5h12v10h-12Z', fill: '#F5C542', line: true }, // buckle
      { d: 'M47.5 78.5h5v4h-5Z', fill: '#2E1F3F' },
    ],
  },
  pumpkin: {
    w: 100,
    h: 90,
    anchor: [52, 8], // held by the stem
    shapes: [
      { d: 'M46 20 C45 12 48 5 55 1 L59 5 C54 8 53 12 54 21Z', fill: '#557A2E', line: true }, // stem
      { d: ellipse(34, 55, 26, 32), fill: ORANGE, line: true },
      { d: ellipse(66, 55, 26, 32), fill: ORANGE, line: true },
      { d: ellipse(50, 55, 20, 34), fill: '#F68C2E', line: true },
      { d: 'M18 46 C20 36 26 30 32 28 C26 36 24 44 24 52Z', fill: '#FFB566' }, // highlight
      { d: 'M33 48 L45 48 L39 38Z', fill: GLOW, line: true },
      { d: 'M55 48 L67 48 L61 38Z', fill: GLOW, line: true },
      { d: 'M47 56 L53 56 L50 51Z', fill: GLOW, line: true },
      { d: 'M28 63 Q50 83 72 63 Q66 67 61 66 L58 71 L54 67 Q50 68 46 67 L42 71 L39 66 Q34 67 28 63Z', fill: GLOW, line: true },
    ],
  },
  bat: {
    w: 100,
    h: 44,
    shapes: [
      {
        d: 'M50 22 C42 10 26 4 6 8 C14 14 16 22 14 32 C22 28 28 30 31 38 C36 32 42 32 46 38 L50 40 L54 38 C58 32 64 32 69 38 C72 30 78 28 86 32 C84 22 86 14 94 8 C74 4 58 10 50 22Z',
        fill: '#241833',
        line: true,
      },
      { d: 'M44 26 L43 12 L47.5 17 L52.5 17 L57 12 L56 26 C56 32 44 32 44 26Z', fill: '#241833', line: true }, // head
      { d: ellipse(47.5, 22, 1.6, 1.6), fill: GLOW },
      { d: ellipse(52.5, 22, 1.6, 1.6), fill: GLOW },
    ],
  },

  // Thanksgiving
  pilgrimHat: {
    head: true,
    w: 100,
    h: 82,
    anchor: [50, 72],
    shapes: [
      { d: ellipse(50, 72, 48, 10), fill: '#2B2B2B', line: true },
      { d: 'M24 72L28 14Q50 8 72 14L76 72Q50 80 24 72Z', fill: '#2B2B2B', line: true },
      { d: 'M28 14Q50 20 72 14Q50 8 28 14Z', fill: '#3A3A3A', line: true },
      { d: 'M34 64L36 20L41 19.5L39 64Z', fill: '#4A4A4A' }, // highlight
      { d: 'M26.4 52Q50 58 73.6 52L74.8 67Q50 74 25.2 67Z', fill: '#6B4A2B', line: true }, // band
      { d: rect(40, 52.5, 20, 15), fill: '#E3B23C', line: true }, // buckle
      { d: rect(45, 57, 10, 6), fill: '#2B2B2B' },
    ],
  },
  leafRed: leaf('#C8431B', '#7A2410'),
  leafGold: leaf('#F2A922', '#9A5E08'),
  turkey: {
    w: 100,
    h: 90,
    anchor: [50, 10], // held by its tail feathers
    shapes: [
      { d: 'M50 74C20 74 4 54 10 32C18 12 40 4 50 4C60 4 82 12 90 32C96 54 80 74 50 74Z', fill: '#B5361F', line: true }, // tail
      { d: 'M50 74C28 74 16 58 20 40C26 24 42 16 50 16C58 16 74 24 80 40C84 58 72 74 50 74Z', fill: '#E57F23', line: true },
      { d: 'M50 74C34 74 28 64 30 52C34 42 44 36 50 36C56 36 66 42 70 52C72 64 66 74 50 74Z', fill: '#F2C230', line: true },
      { d: 'M40 84L38 89M44 84L46 89', fill: 'none', line: true }, // feet
      { d: 'M56 84L54 89M60 84L62 89', fill: 'none', line: true },
      { d: ellipse(50, 68, 19, 19), fill: '#7B4A2A', line: true }, // body
      { d: ellipse(50, 44, 10, 11), fill: '#7B4A2A', line: true }, // head
      { d: 'M47 48L53 48L50 54Z', fill: '#F4B400', line: true }, // beak
      { d: 'M52 50C56 54 56 60 52 61C50 58 50 54 52 50Z', fill: '#D62828', line: true }, // wattle
      { d: circle(46, 42, 1.8), fill: HOOF },
      { d: circle(54, 42, 1.8), fill: HOOF },
    ],
  },

  // Christmas
  santaHat: {
    head: true,
    w: 100,
    h: 92,
    anchor: [50, 80],
    shapes: [
      { d: 'M12 74C16 40 36 14 62 12C80 11 92 22 95 40L87 45C83 33 75 29 69 35C73 49 82 62 88 74Z', fill: '#D62828', line: true },
      { d: 'M26 66C28 46 38 30 52 22C42 34 36 48 34 66Z', fill: '#F25C5C' }, // highlight
      { d: circle(92, 47, 9), fill: WHITE, line: true }, // pompom
      { d: 'M5 72Q50 62 95 72Q98 80 95 89Q50 80 5 89Q2 80 5 72Z', fill: WHITE, line: true }, // fur
    ],
  },
  snowflake: {
    w: 100,
    h: 100,
    shapes: [
      { d: star(50, 50, 48, 13, 6), fill: WHITE, line: true },
      { d: star(50, 50, 18, 9, 6), fill: '#BFE3F5' },
    ],
  },
  gift: gift('#E53935', '#C62828', '#FFD54F'),

  // New Year
  goldHat: popHat('#1F1F1F', '#E9C46A', '#E9C46A'),
  fireworkGold: firework('#F2C94C', '#FFF3B0'),
  fireworkPink: firework('#E84A8A', '#FFD1E3'),
  // A party popper mid-pop, held by its tail.
  popper: {
    w: 100,
    h: 100,
    anchor: [50, 84],
    shapes: [
      { d: 'M50 40C40 30 58 22 46 10L50 7C62 21 45 30 55 40Z', fill: '#E84A8A', line: true }, // streamers
      { d: 'M44 41C30 34 34 20 20 16L22 12C38 18 34 32 48 38Z', fill: '#4FC3F7', line: true },
      { d: 'M56 41C70 34 66 20 80 16L78 12C62 18 66 32 52 38Z', fill: '#7CD992', line: true },
      { d: 'M8 30L18 26L21 35L11 39Z', fill: '#F2C94C', line: true }, // confetti
      { d: 'M84 30L94 34L90 43L80 39Z', fill: '#B388FF', line: true },
      { d: 'M30 6L39 9L36 18L27 15Z', fill: '#4FC3F7', line: true },
      { d: 'M64 4L73 1L76 10L67 13Z', fill: '#E84A8A', line: true },
      { d: 'M42 94L28 44Q50 34 72 44L58 94Q50 98 42 94Z', fill: '#E9C46A', line: true }, // cone
      { d: 'M32.5 58Q50 50 67.5 58L65 66Q50 59 35 66Z', fill: '#1F1F1F', line: true },
      { d: 'M37.5 76Q50 70 62.5 76L60.5 84Q50 79 39.5 84Z', fill: '#1F1F1F', line: true },
      { d: ellipse(50, 42, 22, 7), fill: '#7A5A10', line: true }, // the open end
    ],
  },

  // Groundhog Day
  beanie: {
    head: true,
    w: 100,
    h: 84,
    anchor: [56, 70], // right of and above the cuff's middle, so it sits down and to the left on the head
    shapes: [
      { d: 'M14 66C14 30 30 14 50 14C70 14 86 30 86 66Z', fill: '#3C6E9E', line: true },
      { d: 'M36 22C32 36 31 50 32 64M50 16L50 64M64 22C68 36 69 50 68 64', fill: 'none', line: true }, // ribs
      { d: 'M10 62Q50 54 90 62L90 80Q50 72 10 80Z', fill: '#2F5A84', line: true }, // cuff
    ],
  },
  // The groundhog popping up out of a hollow tree stump, paws on the rim.
  // Stands on the ground beside the pig (groundhogDay.ts), by its base.
  stumpGroundhog: {
    w: 100,
    h: 100,
    anchor: [50, 97],
    shapes: [
      { d: 'M14 92L4 99L22 96ZM86 92L96 99L78 96Z', fill: '#6B4423', line: true }, // roots
      { d: 'M18 50L14 92Q50 101 86 92L82 50Z', fill: '#7B5230', line: true }, // the stump
      { d: 'M32 62L29 88M50 63L50 94M68 62L71 88', fill: 'none', line: true }, // bark
      { d: ellipse(50, 50, 32, 9), fill: '#D8B07A', line: true }, // the cut top
      { d: ellipse(50, 50, 22, 6), fill: '#3E2723', line: true }, // the hollow
      { d: circle(38, 18, 4.5) + circle(62, 18, 4.5), fill: '#8D6E63', line: true }, // ears
      { d: 'M33 56C31 30 38 14 50 14C62 14 69 30 67 56Z', fill: '#A1887F', line: true }, // the groundhog
      { d: ellipse(50, 35, 8, 5.5), fill: '#D7CCC8', line: true }, // muzzle
      { d: circle(45, 27, 2) + circle(55, 27, 2), fill: HOOF },
      { d: ellipse(50, 31.5, 3, 2.2), fill: '#3E2723' }, // nose
      { d: rect(48.5, 38, 3, 4), fill: WHITE, line: true }, // teeth
      { d: 'M18 50A32 9 0 0 0 82 50L72 50A22 6 0 0 1 28 50Z', fill: '#D8B07A', line: true }, // the rim in front of it
      { d: ellipse(37, 50, 6, 3.5) + ellipse(63, 50, 6, 3.5), fill: '#8D6E63', line: true }, // paws on the rim
    ],
  },
  // A beer bottle, held by the neck: amber glass, a gold cap, a cream label.
  // A held prop's whole grid is drawn at the hold slot's width (layout.ts
  // held), so the bottle sits in the middle of a 100-wide grid to come out
  // bottle-sized rather than as wide as the slot.
  beerBottle: {
    w: 100,
    h: 104,
    anchor: [50, 24], // held by the neck
    shapes: [
      { d: 'M41 100Q37 100 37 94L37 52Q37 42 45 36L45 14L55 14L55 36Q63 42 63 52L63 94Q63 100 59 100Z', fill: '#8A5A14', line: true },
      { d: rect(43.5, 6, 13, 9), fill: '#D4AF37', line: true }, // cap
      { d: rect(38, 56, 24, 24), fill: '#F5EBD0', line: true }, // label
      { d: rect(38, 56, 24, 5), fill: '#B0123F', line: true },
      { d: 'M41 46L41 92L44 92L44 46Z', fill: 'rgba(255,255,255,0.3)' }, // shine
    ],
  },

  // Valentine's Day
  // Cupid's quiver, worn on the pig's back: drawn behind the pig and leaning
  // out past its shoulder, so only the top of it and the arrows' feathered
  // ends show over the shoulder (valentines.ts places it).
  quiver: {
    w: 40,
    h: 110,
    behind: true,
    shapes: [
      ...[
        [12, 9, '#F48FB1'],
        [20, 2, '#FFFFFF'],
        [28, 11, '#E53950'],
      ].flatMap(([cx, top, c]) => {
        const x = cx as number;
        const y = top as number;
        return [
          { d: rect(x - 1.2, y + 14, 2.4, 30), fill: '#8D6E63', line: true }, // shaft
          { d: `M${x} ${y}L${x - 6} ${y + 8}L${x - 6} ${y + 22}L${x} ${y + 16}L${x + 6} ${y + 22}L${x + 6} ${y + 8}Z`, fill: c as string, line: true }, // feathers
        ];
      }),
      { d: 'M6 36L34 36L32 104Q20 110 8 104Z', fill: '#8D5A3B', line: true }, // the quiver
      { d: rect(5, 33, 30, 8), fill: '#B0123F', line: true }, // its rim
      { d: heart(20, 66, 6), fill: '#E53950', line: true },
    ],
  },
  // Cupid's bow, held by its gold grip: red limbs with heart tips, the string
  // drawn taut.
  cupidBow: {
    w: 50,
    h: 112,
    anchor: [13, 56], // held by the grip
    shapes: [
      { d: 'M34 8L34 104', fill: 'none', line: true }, // string
      { d: 'M30 5C4 31 4 81 30 107L35 103C12 79 12 33 35 9Z', fill: '#B0123F', line: true },
      { d: heart(34, 7, 5) + heart(34, 104, 5), fill: '#F48FB1', line: true }, // heart tips
      { d: rect(7, 47, 11, 18), fill: '#F2C14E', line: true }, // grip
    ],
  },
  heartRed: { w: 100, h: 100, shapes: [{ d: heart(50, 52, 30), fill: '#E53950', line: true }, { d: ellipse(34, 40, 6, 9), fill: '#FF8FA3' }] },
  heartPink: { w: 100, h: 100, shapes: [{ d: heart(50, 52, 30), fill: '#F48FB1', line: true }, { d: ellipse(34, 40, 6, 9), fill: '#FFD1DE' }] },

  // Spring
  flowerCrown: {
    head: true,
    w: 100,
    h: 44,
    // The crown wraps the head, its ends curving down: anchored right of
    // centre and low on the vine, it sits on top of the head between the ears
    // (chosen by eye in the previews).
    anchor: [60, 34],
    shapes: [
      { d: 'M4 36Q50 10 96 36L96 40Q50 16 4 40Z', fill: '#5E9E3A', line: true }, // vine
      { d: 'M22 26Q26 16 34 18Q30 26 22 26Z', fill: '#7CC04F', line: true }, // leaves
      { d: 'M78 26Q74 16 66 18Q70 26 78 26Z', fill: '#7CC04F', line: true },
      ...[
        [12, 32, WHITE],
        [31, 22, '#F48FB1'],
        [50, 18, WHITE],
        [69, 22, '#B39DDB'],
        [88, 32, WHITE],
      ].flatMap(([cx, cy, c]) => [
        { d: star(cx as number, cy as number, 12, 7.5, 6), fill: c as string, line: true },
        { d: circle(cx as number, cy as number, 4.5), fill: '#FFD23F', line: true },
      ]),
    ],
  },
  butterfly: {
    w: 100,
    h: 80,
    shapes: [
      { d: 'M48 26Q44 14 36 10M52 26Q56 14 64 10', fill: 'none', line: true }, // antennae
      { d: 'M50 40C40 10 10 4 12 28C14 42 32 44 50 42Z', fill: '#FFB74D', line: true },
      { d: 'M50 40C60 10 90 4 88 28C86 42 68 44 50 42Z', fill: '#FFB74D', line: true },
      { d: 'M50 44C36 46 18 56 26 70C34 78 46 64 50 46Z', fill: '#4FC3F7', line: true },
      { d: 'M50 44C64 46 82 56 74 70C66 78 54 64 50 46Z', fill: '#4FC3F7', line: true },
      { d: circle(28, 26, 5), fill: WHITE },
      { d: circle(72, 26, 5), fill: WHITE },
      { d: ellipse(50, 44, 4, 18), fill: '#3E2723', line: true }, // body
    ],
  },
  // A bunch of tulips, held by the stems.
  tulips: {
    w: 100,
    h: 94,
    anchor: [50, 80],
    shapes: [
      { d: 'M49 88C36 82 28 68 30 60C40 66 47 76 50 86Z', fill: '#6DB33F', line: true }, // leaves
      { d: 'M51 88C64 82 72 68 70 60C60 66 53 76 50 86Z', fill: '#6DB33F', line: true },
      ...[
        [28, 30, '#E53935'],
        [50, 20, '#FFCA28'],
        [72, 32, '#EC407A'],
      ].flatMap(([cx, top, c]) => {
        const x = cx as number;
        const y = top as number;
        return [
          { d: `M${x - 2} ${y + 14}L48.5 92L51.5 92L${x + 2} ${y + 14}Z`, fill: '#4E8F2E', line: true }, // stem
          { d: `M${x - 11} ${y}L${x - 11} ${y + 12}Q${x} ${y + 22} ${x + 11} ${y + 12}L${x + 11} ${y}L${x + 5.5} ${y + 7}L${x} ${y - 3}L${x - 5.5} ${y + 7}Z`, fill: c as string, line: true },
        ];
      }),
    ],
  },

  // St. Patrick's Day
  leprechaunHat: {
    head: true,
    w: 100,
    h: 90,
    anchor: [50, 78],
    shapes: [
      { d: ellipse(50, 78, 48, 10), fill: '#1E7B34', line: true },
      { d: 'M26 78L22 14Q50 6 78 14L74 78Q50 86 26 78Z', fill: '#1E7B34', line: true },
      { d: 'M22 14Q50 22 78 14Q50 6 22 14Z', fill: '#27963F', line: true },
      { d: 'M31 70L28 22L33 21L36 70Z', fill: '#2FA34C' }, // highlight
      { d: 'M24.8 58Q50 64 75.2 58L74.4 72Q50 79 25.6 72Z', fill: '#1B1B1B', line: true }, // band
      { d: rect(40, 58.5, 20, 15), fill: '#F2C14E', line: true }, // buckle
      { d: rect(45, 63, 10, 6), fill: '#1B1B1B' },
    ],
  },
  shamrock: {
    w: 100,
    h: 100,
    shapes: [
      { d: 'M48 60Q50 82 62 96L66 94Q54 80 53 60Z', fill: '#1F7A3A', line: true }, // stem
      { d: heart(50, 34, 17), fill: '#2E9E4F', line: true },
      { d: heart(32, 54, 17), fill: '#2E9E4F', line: true },
      { d: heart(68, 54, 17), fill: '#2E9E4F', line: true },
      { d: ellipse(44, 28, 3, 5), fill: '#6FD08E' },
    ],
  },
  potOfGold: {
    w: 100,
    h: 86,
    anchor: [50, 17], // held by the handle
    shapes: [
      { d: 'M16 48C16 4 84 4 84 48L80 48C80 10 20 10 20 48Z', fill: '#455A64', line: true }, // handle
      { d: 'M18 48C10 66 22 84 50 84C78 84 90 66 82 48Z', fill: '#263238', line: true }, // pot
      { d: ellipse(50, 46, 36, 8), fill: '#37474F', line: true }, // rim
      { d: 'M18 46C24 26 38 20 50 22C62 20 76 26 82 46Z', fill: '#F4C430', line: true }, // the heap
      { d: ellipse(34, 36, 7, 4), fill: '#FFE082', line: true },
      { d: ellipse(52, 28, 7, 4), fill: '#FFE082', line: true },
      { d: ellipse(66, 38, 7, 4), fill: '#FFE082', line: true },
      { d: 'M14 46C20 54 80 54 86 46C82 58 18 58 14 46Z', fill: '#37474F', line: true }, // the rim's near lip
      { d: 'M24 62C26 70 32 76 40 78C32 76 26 70 24 62Z', fill: '#546E7A', line: true }, // shine
    ],
  },

  // Easter
  // Bunny ears for Easter: the pig's own ears, left exactly as they are, given
  // a thick white outline — each ear's silhouette, traced from the art and
  // grown (36 px on the 954 px stills, in proportion on the smaller pigs).
  // Drawn behind the pig, so its ears and head sit on top and only the white
  // band shows. One per drawing of the pig, as the ears sit differently in
  // each; easter.ts puts each where it was traced.
  earsStill: {
    w: 100,
    h: 46.9,
    behind: true,
    shapes: [
      { d: 'M31.0 0.6L33.5 0.9L33.5 1.1L34.8 1.3L34.8 1.5L35.7 1.7L35.9 2.2L36.3 2.2L36.6 2.6L37.0 2.6L39.8 5.4L39.8 5.8L40.4 6.2L40.4 6.7L40.9 6.9L40.9 7.3L41.3 7.5L41.3 8.0L42.2 8.8L42.4 9.7L42.8 9.9L42.8 10.3L43.0 10.3L43.0 10.8L43.2 10.8L43.2 11.2L43.4 11.2L43.4 11.6L43.7 11.6L43.7 12.0L43.9 12.0L43.9 12.5L44.1 12.5L44.1 12.9L44.3 12.9L44.3 13.3L44.9 14.2L44.9 14.8L45.2 14.8L45.2 15.5L45.4 15.5L45.4 16.1L45.6 16.1L45.6 17.0L45.8 17.0L45.8 17.8L46.0 17.8L46.0 18.7L46.2 18.7L46.2 19.6L46.5 19.6L46.5 20.4L46.7 20.4L46.7 21.3L46.9 21.3L46.9 22.2L47.1 22.2L47.1 23.0L47.3 23.0L47.3 23.9L47.5 23.9L47.5 24.7L47.7 24.7L47.7 25.6L48.0 25.6L48.0 26.5L48.2 26.5L48.2 27.3L48.4 27.3L48.4 28.2L48.6 28.2L48.6 29.9L48.8 29.9L48.6 32.3L48.4 32.3L48.4 32.9L48.2 32.9L48.2 33.5L48.0 33.5L47.7 34.4L47.3 34.6L47.3 35.1L45.6 36.8L45.2 36.8L44.9 37.2L44.5 37.2L44.1 37.6L41.9 38.1L41.9 38.3L41.1 38.3L41.1 38.5L40.2 38.5L40.2 38.7L39.4 38.7L39.4 38.9L38.5 38.9L38.5 39.1L37.6 39.1L37.6 39.4L36.8 39.4L36.8 39.6L35.9 39.6L35.9 39.8L35.1 39.8L35.1 40.0L34.2 40.0L34.2 40.2L33.3 40.2L33.3 40.4L32.5 40.4L32.5 40.6L31.6 40.6L31.6 40.9L30.8 40.9L30.8 41.1L29.9 41.1L29.9 41.3L29.0 41.3L29.0 41.5L28.2 41.5L28.2 41.7L27.3 41.7L27.3 41.9L25.6 41.9L25.6 42.2L23.2 41.9L23.2 41.7L22.6 41.7L22.6 41.5L21.9 41.5L21.9 41.3L21.1 41.1L20.9 40.6L20.4 40.6L19.6 39.8L19.6 40.0L19.1 40.0L19.1 40.2L18.7 40.2L18.7 40.4L18.3 40.4L18.3 40.6L17.8 40.6L17.8 40.9L17.4 40.9L17.4 41.1L17.0 41.1L16.1 41.7L15.5 41.7L15.5 41.9L14.8 41.9L14.8 42.2L14.2 42.2L14.2 42.4L13.5 42.4L13.5 42.6L12.9 42.6L12.9 42.8L10.8 43.0L10.8 43.2L9.0 43.2L9.0 43.4L6.7 43.2L6.7 43.0L6.0 43.0L6.0 42.8L5.4 42.8L5.4 42.6L4.5 42.4L4.3 41.9L3.9 41.9L2.2 40.2L2.2 39.8L1.7 39.6L1.7 39.1L1.3 38.7L1.3 38.1L1.1 38.1L1.1 37.4L0.9 37.4L0.6 34.4L0.9 34.4L0.9 32.7L1.1 32.7L1.7 30.1L2.2 29.7L2.2 29.0L2.4 29.0L3.4 26.5L3.9 26.2L4.3 24.9L5.2 24.1L5.4 23.2L5.8 23.0L5.8 22.6L6.2 22.4L6.7 21.3L7.3 20.9L7.7 19.8L8.4 19.4L8.4 18.9L9.0 18.5L9.0 18.1L9.9 17.4L9.9 17.0L10.8 16.3L10.8 15.9L12.0 14.8L12.0 14.4L19.8 6.7L20.2 6.7L21.1 5.6L21.5 5.6L22.8 4.3L23.2 4.3L23.4 3.9L23.9 3.9L24.7 3.0L26.0 2.6L26.2 2.2L26.7 2.2L26.7 1.9L27.1 1.9L28.0 1.3L29.2 1.1L29.2 0.9L31.0 0.9Z', fill: WHITE, line: true },
      { d: 'M77.2 0.9L77.4 1.1L79.1 1.1L79.1 1.3L79.8 1.3L79.8 1.5L80.4 1.5L80.4 1.7L81.3 1.9L84.3 4.7L84.3 5.2L85.4 6.2L85.4 6.7L85.8 6.9L85.8 7.3L86.2 7.5L86.2 8.0L87.1 8.8L87.3 9.7L88.2 10.5L88.2 11.0L88.8 11.6L89.0 12.5L89.5 12.7L90.1 14.4L90.5 14.6L90.5 15.1L90.8 15.1L90.8 15.5L91.0 15.5L91.0 15.9L91.2 15.9L91.2 16.3L91.4 16.3L91.4 16.8L91.6 16.8L91.6 17.2L91.8 17.2L91.8 17.6L92.0 17.6L92.0 18.1L92.3 18.1L92.3 18.5L92.5 18.5L92.5 18.9L92.7 18.9L92.7 19.4L92.9 19.4L92.9 19.8L93.1 19.8L93.1 20.2L93.3 20.2L93.3 20.6L94.0 21.5L94.0 22.2L94.6 23.0L94.6 23.7L94.8 23.7L94.8 24.1L95.3 24.5L95.3 25.2L95.7 25.6L95.7 26.2L96.1 26.7L96.1 27.3L96.3 27.3L96.3 28.0L96.8 28.4L96.8 29.0L97.0 29.0L97.0 29.7L97.2 29.7L97.2 30.3L97.4 30.3L97.4 31.0L97.6 31.0L97.6 31.6L97.8 31.6L97.8 32.3L98.1 32.3L98.1 32.9L98.3 32.9L98.3 33.5L98.5 33.5L98.5 34.4L98.7 34.4L98.7 35.1L98.9 35.1L99.4 38.5L99.1 38.5L99.1 40.2L98.9 40.2L98.9 40.9L98.7 40.9L98.7 41.5L98.5 41.5L98.3 42.4L97.8 42.6L97.8 43.0L96.1 44.7L95.7 44.7L95.5 45.2L95.1 45.2L94.6 45.6L94.0 45.6L94.0 45.8L93.3 45.8L93.3 46.0L91.6 46.0L91.6 46.2L87.7 45.8L87.7 45.6L85.2 44.9L84.3 44.3L83.7 44.3L83.7 44.1L82.8 43.9L82.6 43.4L81.3 43.0L81.1 42.6L80.6 42.6L79.8 41.7L79.1 41.7L78.9 42.2L78.5 42.2L78.1 42.6L77.4 42.6L77.4 42.8L76.8 42.8L76.8 43.0L75.1 43.0L74.8 43.2L74.8 43.0L72.3 42.8L72.3 42.6L71.6 42.6L71.6 42.4L70.8 42.4L70.8 42.2L70.1 42.2L70.1 41.9L69.2 41.9L69.2 41.7L68.6 41.7L68.6 41.5L67.7 41.5L67.7 41.3L67.1 41.3L67.1 41.1L66.2 41.1L66.2 40.9L65.6 40.9L65.6 40.6L64.7 40.6L64.7 40.4L64.1 40.4L64.1 40.2L63.2 40.2L63.2 40.0L62.6 40.0L62.6 39.8L61.7 39.8L61.7 39.6L61.1 39.6L61.1 39.4L58.9 38.9L58.9 38.7L58.1 38.5L57.8 38.1L57.4 38.1L55.5 36.1L55.5 35.7L55.1 35.5L55.1 35.1L54.6 34.6L54.0 31.4L54.2 31.4L54.2 29.7L54.4 29.7L54.4 29.0L54.6 29.0L54.6 28.4L54.8 28.4L55.3 27.1L55.7 26.9L55.7 26.5L56.1 26.2L56.1 25.8L56.6 25.6L56.6 25.2L57.0 24.9L57.0 24.5L57.4 24.3L57.4 23.9L58.3 23.0L58.5 22.2L58.9 21.9L58.9 21.5L59.4 21.3L59.4 20.9L59.8 20.6L59.8 20.2L60.2 20.0L60.2 19.6L60.6 19.4L60.6 18.9L61.1 18.7L61.1 18.3L61.5 18.1L61.5 17.6L62.4 16.8L62.6 15.9L63.0 15.7L63.0 15.3L63.4 15.1L63.4 14.6L63.9 14.4L63.9 14.0L64.3 13.8L64.3 13.3L64.7 13.1L64.7 12.7L65.2 12.5L65.2 12.0L65.6 11.8L65.6 11.4L66.5 10.5L66.7 9.7L67.1 9.5L67.1 9.0L67.5 8.8L67.5 8.4L68.0 8.2L68.0 7.7L68.4 7.5L68.4 7.1L68.8 6.9L68.8 6.5L69.2 6.2L69.2 5.8L69.7 5.6L70.1 4.5L71.8 2.8L72.3 2.8L72.5 2.4L72.9 2.4L72.9 2.2L73.3 2.2L74.2 1.5L75.5 1.3L75.5 1.1L77.2 1.1Z', fill: WHITE, line: true },
    ],
  },
  earsWaiting: {
    w: 100,
    h: 46.7,
    behind: true,
    shapes: [
      { d: 'M32.4 1.6L36.8 2.2L37.4 3.3L38.5 3.3L42.3 7.1L42.3 8.2L43.4 8.8L44.0 11.0L45.6 12.6L46.2 17.6L46.7 17.6L46.7 19.8L47.3 19.8L47.3 22.0L47.8 22.0L47.8 24.2L48.4 24.2L48.4 26.9L48.9 26.9L48.4 31.9L47.3 32.4L47.3 33.5L46.2 34.6L45.1 34.6L44.5 35.7L43.4 35.7L43.4 36.3L41.2 36.3L41.2 36.8L39.0 36.8L39.0 37.4L36.8 37.4L36.8 37.9L34.1 37.9L34.1 38.5L31.3 38.5L31.3 39.0L27.5 38.5L26.9 37.4L24.2 36.8L23.6 37.9L22.5 37.9L20.3 40.1L18.7 40.1L17.6 41.2L14.8 41.2L14.8 41.8L8.8 41.2L8.2 40.1L4.4 38.5L3.3 37.4L3.3 36.3L2.2 35.7L2.2 33.0L1.6 33.0L1.6 25.3L2.2 25.3L2.2 22.5L3.3 22.0L3.3 20.9L4.4 19.8L5.5 19.8L6.0 18.7L8.8 18.7L8.8 18.1L9.3 18.7L12.6 18.7L12.6 17.6L14.3 16.5L14.3 15.4L23.1 6.6L24.2 6.6L25.3 4.9L29.1 3.3L29.7 2.2L32.4 2.2Z', fill: WHITE, line: true },
      { d: 'M76.4 2.2L80.8 2.7L81.3 3.8L82.4 3.8L84.6 6.0L84.6 7.1L85.7 7.7L85.7 8.8L87.9 11.0L89.0 14.3L90.1 14.8L90.1 15.9L90.7 15.9L90.7 17.0L91.2 17.0L91.2 18.1L91.8 18.1L91.8 19.2L93.4 21.4L93.4 23.1L95.1 25.3L95.6 28.6L96.7 29.1L96.7 30.8L97.8 31.3L97.8 34.1L98.4 34.1L98.4 35.2L97.8 35.2L98.4 35.7L97.8 40.7L94.0 44.5L90.1 45.1L90.1 44.5L85.2 44.0L85.2 43.4L81.9 42.3L81.3 41.2L79.7 41.2L79.1 42.3L74.7 42.9L74.7 42.3L69.2 41.8L69.2 41.2L67.0 41.2L67.0 40.7L61.5 40.1L61.5 39.6L59.3 39.6L58.8 38.5L57.7 38.5L56.6 37.4L56.6 36.3L55.5 35.7L55.5 33.0L54.9 33.0L55.5 29.1L56.0 29.1L56.0 28.0L56.6 28.0L56.6 26.9L57.1 26.9L57.1 25.8L57.7 25.8L61.0 18.1L62.1 17.6L64.8 11.0L65.9 10.4L65.9 9.3L70.3 4.9L71.4 4.9L73.6 2.7L76.4 2.7Z', fill: WHITE, line: true },
    ],
  },
  earsWinner: {
    w: 100,
    h: 47.5,
    behind: true,
    shapes: [
      { d: 'M31.1 1.3L34.5 1.7L34.5 2.1L35.7 2.1L36.1 2.9L37.0 2.9L40.3 6.3L40.3 7.1L41.2 7.6L41.2 8.4L42.0 8.8L42.0 9.7L42.9 10.5L43.7 16.0L44.1 16.0L44.5 20.6L45.0 20.6L45.0 23.1L45.4 23.1L45.4 25.2L45.8 25.2L45.8 27.7L46.2 27.7L46.2 29.8L46.6 29.8L45.8 34.5L42.4 37.8L37.0 38.7L37.0 39.1L34.9 39.1L34.9 39.5L32.4 39.5L32.4 39.9L30.3 39.9L30.3 40.3L27.7 40.3L27.3 40.8L27.3 40.3L23.9 39.9L23.5 39.1L22.7 39.1L21.8 38.2L20.2 39.9L19.3 39.9L19.3 40.3L18.5 40.3L16.8 41.6L14.3 42.0L14.3 42.4L10.5 42.9L10.5 43.3L5.5 42.4L2.1 39.1L1.7 35.7L1.3 35.7L1.7 32.4L2.1 32.4L2.5 29.8L2.9 29.8L4.6 25.6L5.5 25.2L5.5 24.4L6.3 23.9L6.3 23.1L7.1 22.7L7.1 21.8L8.0 21.4L8.8 19.3L10.1 18.5L10.1 17.6L12.2 16.0L12.2 15.1L20.2 7.1L21.0 7.1L21.8 5.9L22.7 5.9L23.5 4.6L24.4 4.6L26.1 2.9L26.9 2.9L27.7 2.1L29.0 2.1L29.0 1.7L31.1 1.7Z', fill: WHITE, line: true },
      { d: 'M76.9 1.3L80.7 2.1L81.1 2.9L81.9 2.9L83.6 4.6L83.6 5.5L84.9 6.3L84.9 7.1L85.7 7.6L85.7 8.4L87.4 10.1L87.8 11.8L88.7 12.2L89.1 13.9L89.9 14.3L89.9 15.1L90.3 15.1L90.3 16.0L90.8 16.0L90.8 16.8L91.2 16.8L91.2 17.6L91.6 17.6L91.6 18.5L92.0 18.5L92.0 19.3L92.4 19.3L92.4 20.2L93.7 21.8L93.7 23.1L94.1 23.1L94.5 25.2L95.4 26.1L95.4 27.3L96.2 28.2L96.2 29.4L96.6 29.4L96.6 30.7L97.1 30.7L97.1 31.9L97.5 31.9L97.5 33.2L97.9 33.2L97.9 34.9L98.3 34.9L98.3 37.0L98.7 37.0L97.9 42.0L94.5 45.4L89.9 46.2L89.9 45.8L87.8 45.8L87.8 45.4L84.0 44.5L84.0 44.1L81.5 43.3L81.1 42.4L79.8 42.4L79.4 43.3L75.6 44.1L75.6 43.7L73.1 43.7L73.1 43.3L70.6 43.3L70.6 42.9L68.5 42.9L68.5 42.4L66.0 42.4L66.0 42.0L59.2 41.2L59.2 40.8L58.0 40.8L57.6 39.9L56.7 39.9L55.0 38.2L55.0 37.4L54.2 37.0L53.8 33.6L53.4 33.6L54.2 29.4L55.5 28.2L55.9 26.5L56.7 26.1L57.6 23.5L58.4 23.1L58.8 21.4L59.7 21.0L60.5 18.5L61.3 18.1L61.8 16.4L62.6 16.0L62.6 15.1L63.0 15.1L63.4 13.4L64.3 13.0L64.7 11.3L65.5 10.9L66.0 9.2L66.8 8.8L67.6 6.7L68.9 5.5L69.7 5.5L70.6 4.2L71.4 4.2L72.3 2.9L73.1 2.9L73.5 2.1L74.8 2.1L74.8 1.7L76.9 1.7Z', fill: WHITE, line: true },
    ],
  },
  earsCanvas: {
    w: 100,
    h: 45.3,
    behind: true,
    shapes: [
      { d: 'M30.7 0.9L33.1 1.2L33.1 1.5L35.6 2.4L37.7 4.6L37.7 5.2L38.6 6.4L39.2 13.4L39.5 13.4L39.5 16.1L39.8 16.1L39.8 18.8L40.1 18.8L40.1 21.6L40.4 21.6L40.4 24.3L40.7 24.3L40.7 27.1L41.0 27.1L41.0 29.8L41.3 29.8L41.0 34.0L40.7 34.0L40.1 35.9L38.6 37.4L38.0 37.4L36.8 38.3L31.0 38.9L31.0 39.2L28.9 39.2L28.9 39.5L26.7 39.5L26.7 39.8L23.4 39.5L23.4 39.2L21.6 38.6L20.4 37.1L19.8 37.1L18.8 38.0L18.2 38.0L18.2 38.3L17.6 38.3L17.6 38.6L17.0 38.6L17.0 38.9L16.4 38.9L16.4 39.2L15.8 39.2L15.8 39.5L15.2 39.5L14.0 40.4L12.8 40.4L12.8 40.7L11.9 40.7L11.9 41.0L10.9 41.0L10.9 41.3L7.3 41.6L7.3 41.3L5.5 41.3L5.5 41.0L3.6 40.4L2.1 38.9L2.1 38.3L1.2 37.1L0.9 34.7L1.2 34.7L1.2 32.8L1.5 32.8L1.8 30.7L2.1 30.7L2.1 30.1L2.4 30.1L2.4 29.5L2.7 29.5L4.6 25.2L5.8 24.0L6.1 22.8L7.0 22.2L7.0 21.6L7.6 21.3L8.2 19.8L9.1 19.1L9.1 18.5L10.0 17.9L10.0 17.3L11.2 16.4L11.2 15.8L14.3 13.1L14.3 12.5L18.5 8.2L19.1 8.2L21.0 6.1L21.6 6.1L22.2 5.2L23.7 4.6L24.3 3.6L25.5 3.3L25.8 2.7L26.4 2.7L26.4 2.4L27.1 2.4L27.1 2.1L27.7 2.1L28.9 1.2L30.7 1.2Z', fill: WHITE, line: true },
      { d: 'M77.8 1.2L80.2 1.5L80.2 1.8L82.1 2.4L83.6 4.0L83.6 4.6L84.5 5.2L85.1 6.7L86.0 7.3L86.3 8.5L86.9 8.8L86.9 9.4L87.5 9.7L88.1 11.6L88.8 11.9L89.1 13.1L89.7 13.4L89.7 14.0L90.0 14.0L90.0 14.6L90.3 14.6L90.3 15.2L90.6 15.2L90.6 15.8L90.9 15.8L90.9 16.4L91.2 16.4L91.2 17.0L91.5 17.0L91.5 17.6L91.8 17.6L91.8 18.2L92.1 18.2L92.1 18.8L92.4 18.8L92.4 19.5L92.7 19.5L92.7 20.1L93.0 20.1L93.0 20.7L93.3 20.7L93.3 21.3L94.2 22.5L94.2 23.4L95.1 24.6L95.1 25.5L95.4 25.5L95.7 27.1L96.4 27.7L96.4 28.6L97.0 29.2L97.0 30.1L97.3 30.1L97.3 31.0L97.6 31.0L97.6 31.9L97.9 31.9L97.9 33.1L98.2 33.1L98.2 34.0L98.5 34.0L98.5 35.0L98.8 35.0L99.1 38.0L98.8 38.0L98.8 39.8L98.5 39.8L97.9 41.6L96.4 43.2L95.7 43.2L94.5 44.1L92.1 44.4L92.1 44.1L90.0 44.1L90.0 43.8L86.9 43.5L86.9 43.2L83.3 41.6L83.0 41.0L81.8 40.7L81.2 39.8L80.5 39.8L79.9 40.7L79.3 40.7L78.1 41.6L75.7 41.9L75.7 41.6L73.6 41.6L73.6 41.3L71.4 41.3L71.4 41.0L69.6 41.0L69.6 40.7L67.5 40.7L67.5 40.4L65.3 40.4L65.3 40.1L59.6 39.5L59.6 39.2L57.8 38.6L56.2 37.1L56.2 36.5L55.3 35.3L55.3 33.4L55.0 33.4L55.3 31.0L55.6 31.0L56.8 28.0L57.4 27.7L58.1 25.8L58.7 25.5L59.3 23.7L59.9 23.4L60.5 21.6L61.1 21.3L61.7 19.5L62.3 19.1L62.9 17.3L63.5 17.0L63.5 16.4L63.8 16.4L64.4 14.6L65.0 14.3L65.7 12.5L66.3 12.2L66.9 10.3L67.5 10.0L68.1 8.2L72.3 3.6L72.9 3.6L73.3 3.0L73.9 3.0L74.2 2.4L74.8 2.4L76.0 1.5L77.8 1.5Z', fill: WHITE, line: true },
    ],
  },
  // Trough fillers: rockets for the 4th, champagne for New Year, gold coins for
  // St. Patrick's Day.
  rocketRed: rocket('#D62828', '#F7F7F7', '#1F3A93', 'stripes'),
  rocketBlue: rocket('#1F3A93', '#F7F7F7', '#D62828', 'stars'),
  rocketWhite: rocket('#F7F7F7', '#D62828', '#1F3A93', 'stripes'),
  rocketStars: rocket('#D62828', '#F7F7F7', '#F7F7F7', 'stars'),
  champagneGreen: champagne('#2E5E3A', '#F5EBD0', '#E9C46A'),
  champagneBlack: champagne('#1F1F24', '#E9C46A', '#E9C46A'),
  champagneRose: champagne('#C46A7A', '#F5EBD0', '#E9C46A'),
  coinFace: coin(1),
  coinTilt: coin(0.6),
  coinEdge: coin(0.3),
  // Daisies for Spring's trough, in the crown's colors.
  daisyWhite: daisy(WHITE),
  daisyPink: daisy('#F48FB1'),
  daisyLavender: daisy('#B39DDB'),
  // Loose eggs for the trough, in the Easter palette's pinks and purples.
  eggPink: egg('#F9A8D4', '#7452BA', 'zigzag'),
  eggLavender: egg('#C9B8FF', '#FFFFFF', 'dots'),
  eggBerry: egg('#A0306A', '#FFD2E6', 'stripes'),
  eggPurple: egg('#7452BA', '#F9A8D4', 'dots'),
  eggBlush: egg('#FFD2E6', '#A0306A', 'zigzag'),
  // Painted eggs in a basket, held by the handle.
  eggBasket: {
    w: 100,
    h: 96,
    anchor: [50, 16],
    shapes: [
      { d: 'M14 54C14 -2 86 -2 86 54L78 54C78 8 22 8 22 54Z', fill: '#A0662E', line: true }, // handle
      { d: ellipse(33, 46, 12, 16), fill: '#81D4FA', line: true }, // eggs
      { d: ellipse(66, 46, 12, 16), fill: '#F48FB1', line: true },
      { d: ellipse(50, 42, 12, 17), fill: '#FFF59D', line: true },
      { d: 'M38 40L44 34L50 40L56 34L62 40L62 45L56 39L50 45L44 39L38 45Z', fill: '#AB47BC' },
      { d: circle(29, 42, 2.5) + circle(36, 50, 2.5) + circle(62, 42, 2.5) + circle(69, 50, 2.5), fill: WHITE },
      { d: 'M10 54L16 45L21 54L27 43L33 54L39 45L45 54L51 43L57 54L63 45L69 54L75 43L81 54L86 46L90 54Z', fill: '#6DB33F', line: true }, // grass
      { d: 'M10 54L90 54L82 92Q50 98 18 92Z', fill: '#C68B4E', line: true }, // basket
      { d: 'M14 66L86 66M16 79L84 79M30 54L32 94M50 54L50 96M70 54L68 94', fill: 'none', line: true }, // weave
    ],
  },

  // 4th of July
  unclesamHat: {
    head: true,
    w: 100,
    h: 98,
    anchor: [50, 88],
    shapes: [
      { d: ellipse(50, 88, 48, 10), fill: '#1F3A93', line: true },
      { d: 'M26 88L28 10Q50 4 72 10L74 88Q50 96 26 88Z', fill: WHITE, line: true },
      { d: 'M33 8L34 66L41 67L40 6.5Z', fill: '#D62828', line: true }, // stripes
      { d: 'M46.5 5.5L46.5 68L53.5 68L53.5 5.5Z', fill: '#D62828', line: true },
      { d: 'M60 6.5L59 67L66 66L67 8Z', fill: '#D62828', line: true },
      { d: 'M28 10Q50 16 72 10Q50 4 28 10Z', fill: WHITE, line: true },
      { d: 'M27.2 66Q50 72 72.8 66L73.6 82Q50 89 26.4 82Z', fill: '#1F3A93', line: true }, // band
      { d: star(38, 76, 4, 1.7), fill: WHITE },
      { d: star(50, 78, 4, 1.7), fill: WHITE },
      { d: star(62, 76, 4, 1.7), fill: WHITE },
    ],
  },
  fireworkRed: firework('#E53950', '#FFD1D8'),
  fireworkBlue: firework('#3F6FD8', '#CFE0FF'),
  flag: {
    w: 100,
    h: 92,
    anchor: [20, 64], // held by the pole
    shapes: [
      { d: rect(18, 6, 4, 84), fill: '#8D6E63', line: true }, // pole
      { d: circle(20, 6, 4), fill: '#F2C14E', line: true },
      { d: rect(22, 10, 64, 42), fill: WHITE, line: true },
      ...[0, 2, 4, 6].map((i) => ({ d: rect(22, 10 + i * 6, 64, 6), fill: '#D62828' })),
      { d: rect(22, 10, 28, 24), fill: '#1F3A93' }, // canton
      ...[
        [28, 16],
        [37, 16],
        [46, 16],
        [32.5, 22],
        [41.5, 22],
        [28, 28],
        [37, 28],
        [46, 28],
      ].map(([x, y]) => ({ d: circle(x, y, 1.6), fill: WHITE })),
      { d: rect(22, 10, 64, 42), fill: 'none', line: true }, // the flag's outline, over the stripes
    ],
  },

  // Birthday
  partyHat: popHat('#4FC3F7', '#FFEB3B', '#FF4081'),
  balloonRed: balloon('#E53950', '#FF9EAE'),
  balloonBlue: balloon('#3F8FE0', '#A8D4FF'),
  balloonYellow: balloon('#FFCA28', '#FFF1B8'),
  giftBlue: gift('#3F8FE0', '#2F72B8', '#FF4081'),
  // The cake the pig holds up, hooves gripping its sides, the name in icing
  // on top. The sparkler sticks are part of it; their sparks are separate
  // `spark` props (birthday.ts puts them on the tips) so they can twinkle.
  cake: {
    w: 100,
    h: 110,
    text: { x: 50, y: 65, size: 13, maxW: 56, fill: '#E2387A', shade: '#8E1047', shine: '#FFC2D8' },
    shapes: [
      { d: ellipse(50, 102, 44, 7), fill: '#E0E0E0', line: true }, // plate
      { d: 'M14 60L14 96C14 106 86 106 86 96L86 60Z', fill: '#8D5A3B', line: true },
      { d: 'M14 60L14 70Q18 78 22 70Q27 80 32 68Q37 76 42 69Q48 82 54 69Q59 76 64 68Q69 80 74 70Q79 78 86 70L86 60Z', fill: '#FFF1F5', line: true },
      { d: ellipse(50, 60, 36, 13), fill: '#FFF1F5', line: true }, // the top
      { d: beads(50, 60, 33, 10.5, 24, 1.6), fill: '#F6A9C2' }, // a piped border round it
      { d: 'M24 86h5v2h-5ZM40 92h5v2h-5ZM58 88h5v2h-5ZM72 94h5v2h-5Z', fill: '#FFEB3B' }, // sprinkles
      { d: 'M32 94h5v2h-5ZM50 86h5v2h-5ZM66 82h5v2h-5Z', fill: '#4FC3F7' },
      { d: 'M36 52L31 20L34 19.6L39 52Z', fill: '#B0BEC5', line: true }, // sparklers
      { d: 'M48.5 50L48.5 12L51.5 12L51.5 50Z', fill: '#B0BEC5', line: true },
      { d: 'M61 52L66 19.6L69 20L64 52Z', fill: '#B0BEC5', line: true },
      { d: 'M2 64C2 58 12 56 18 62L20 80C14 84 4 82 2 78Z', fill: PIG, line: true }, // hooves
      { d: 'M12 77L20 80C19 86 12 88 8 84Z', fill: HOOF, line: true },
      { d: 'M98 64C98 58 88 56 82 62L80 80C86 84 96 82 98 78Z', fill: PIG, line: true },
      { d: 'M88 77L80 80C81 86 88 88 92 84Z', fill: HOOF, line: true },
    ],
  },
  spark: {
    w: 100,
    h: 100,
    shapes: [
      { d: star(50, 50, 48, 22, 8), fill: '#FFE066', line: true },
      { d: star(50, 50, 22, 11, 8), fill: '#FFFDF0' },
    ],
  },

  // Railroad (an unlockable theme)
  // A conductor's cap: a navy crown flaring to its top, a gold-piped band, a
  // badge, and a shiny black visor.
  conductorCap: {
    head: true,
    w: 100,
    h: 74,
    anchor: [50, 60],
    shapes: [
      { d: 'M10 14Q50 2 90 14L82 52Q50 58 18 52Z', fill: '#22325A', line: true },
      { d: 'M22 16Q26 32 26 48L31 49Q30 32 28 14Z', fill: '#33497F' }, // highlight
      { d: 'M18 44Q50 50 82 44L82 56Q50 62 18 56Z', fill: '#151515', line: true }, // band
      { d: 'M18 47Q50 53 82 47L82 49Q50 55 18 49Z', fill: '#E3B23C' }, // piping
      { d: 'M18 56Q50 62 82 56Q84 66 50 72Q16 66 18 56Z', fill: '#0F0F0F', line: true }, // visor
      { d: 'M30 63Q50 67 70 63Q50 69 30 63Z', fill: 'rgba(255,255,255,0.25)' },
      { d: 'M42 22h16v12l-8 5l-8-5Z', fill: '#E3B23C', line: true }, // badge
      { d: 'M46 26h8v6l-4 2.5l-4-2.5Z', fill: '#B8862B' },
    ],
  },
  // A puff of locomotive steam.
  steam: {
    w: 100,
    h: 66,
    shapes: [
      { d: 'M16 58C6 58 4 44 14 40C12 26 28 20 36 28C40 12 62 10 68 24C80 18 94 30 86 42C96 46 94 60 82 58Z', fill: '#F2F4F6', line: true },
      { d: 'M14 52Q50 58 88 50Q88 57 82 57L17 57Q13 56 14 52Z', fill: '#D3D9DF' }, // shade
      { d: ellipse(42, 32, 8, 4), fill: '#FFFFFF' },
    ],
  },
  // A railroad lantern with a red globe, held by its wire bail.
  lantern: {
    w: 100,
    h: 104,
    anchor: [50, 10],
    shapes: [
      { d: 'M36 34C36 2 64 2 64 34', fill: 'none', line: true }, // bail
      { d: rect(44, 22, 12, 6), fill: '#3B3F45', line: true }, // vent
      { d: 'M38 28h24l6 12H32Z', fill: '#3B3F45', line: true }, // top
      { d: 'M36 40h28Q74 62 64 84H36Q26 62 36 40Z', fill: '#D62828', line: true }, // globe
      { d: ellipse(50, 62, 9, 14), fill: '#FF7A45' },
      { d: 'M50 52C55 58 56 66 50 70C44 66 45 58 50 52Z', fill: GLOW }, // flame
      { d: 'M40 40L40 84M60 40L60 84', fill: 'none', line: true }, // guard wires
      { d: ellipse(42, 56, 2.5, 8), fill: 'rgba(255,255,255,0.5)' }, // shine
      { d: rect(32, 84, 36, 10), fill: '#3B3F45', line: true }, // base
      { d: rect(28, 94, 44, 8), fill: '#2B2E33', line: true },
    ],
  },
  // Lumps of coal for the trough: faceted, with a glint.
  coalA: {
    w: 100,
    h: 76,
    shapes: [
      { d: 'M10 48L22 20L48 8L76 14L92 38L84 64L54 72L24 68Z', fill: '#26282B', line: true },
      { d: 'M48 8L54 34L22 20Z', fill: '#3C4046' },
      { d: 'M54 34L92 38L76 14Z', fill: '#33363B' },
      { d: 'M30 26L40 22L36 30Z', fill: 'rgba(255,255,255,0.35)' },
    ],
  },
  coalB: {
    w: 100,
    h: 72,
    shapes: [
      { d: 'M8 40L30 12L62 10L90 30L86 58L58 70L20 64Z', fill: '#2C2E31', line: true },
      { d: 'M30 12L44 36L8 40Z', fill: '#40444A' },
      { d: 'M44 36L62 10L90 30Z', fill: '#36393E' },
      { d: 'M56 18L66 16L62 24Z', fill: 'rgba(255,255,255,0.35)' },
    ],
  },

  // Paul (an unlockable theme): Sherwood Forest, men in tights.
  // An archer's cap: green felt, its peak swept back to a point, the brim
  // turned up, and a long barred pheasant feather tucked in the band.
  archerCap: {
    head: true,
    w: 100,
    h: 70,
    anchor: [44, 58],
    shapes: [
      { d: 'M10 56C14 30 40 12 70 10C80 10 92 14 98 20C84 24 76 36 74 56Z', fill: '#3F6B2A', line: true }, // crown
      { d: 'M24 46C30 31 44 21 62 17C48 25 36 35 30 47Z', fill: '#5A8A3C' }, // highlight
      { d: 'M40 52C22 44 6 26 4 2C16 16 32 34 48 46Z', fill: '#C4692F', line: true }, // feather, tucked in the band
      { d: 'M30 46L36 40M20 37L27 30M12 26L19 19', fill: 'none', line: true }, // its bars
      { d: 'M4 54Q40 44 80 52L82 62Q40 55 2 63Z', fill: '#2F5420', line: true }, // brim
    ],
  },
  // An arrow in flight: a wooden shaft, a steel head, and fletching in the
  // pink of the tights and plain white.
  arrow: {
    w: 100,
    h: 40,
    shapes: [
      { d: rect(18, 16, 58, 8), fill: '#C99A5B', line: true }, // shaft
      { d: 'M72 4L99 20L72 36L79 20Z', fill: '#C9D3DC', line: true }, // head
      { d: 'M78 12L91 20L81 20Z', fill: '#FFFFFF' },
      { d: 'M1 2L32 16H17L6 10Z', fill: '#FF4FA0', line: true }, // fletching
      { d: 'M1 38L32 24H17L6 30Z', fill: '#FFFFFF', line: true },
    ],
  },
  // A longbow, held at its leather-wrapped grip, string drawn straight.
  longbow: {
    w: 60,
    h: 110,
    anchor: [13, 55],
    shapes: [
      { d: 'M41 3L41 107', fill: 'none', line: true }, // string
      { d: 'M38 2C4 30 4 80 38 108L44 106C14 80 14 30 44 4Z', fill: '#C8A060', line: true }, // stave
      { d: 'M37 8C18 30 18 80 37 102L39 101C22 80 22 30 39 9Z', fill: '#E2C489' }, // highlight
      { d: rect(7, 46, 12, 18), fill: '#7A3B1F', line: true }, // grip
    ],
  },

  // Bobby (an unlockable theme): a neon city at night, a pig with attitude.
  // A mohawk: a narrow crest of hot-pink spikes of every height, swept back
  // to one side, lighter streaks, darker roots.
  mohawk: {
    head: true,
    w: 100,
    h: 70,
    anchor: [50, 62],
    shapes: [
      { d: 'M30 64L24 42L38 50L34 20L48 42L50 2L60 38L72 8L70 40L92 22L80 52L99 46L74 64Z', fill: '#FF2BD6', line: true },
      { d: 'M50 2L48 26L54 24Z', fill: '#FF8AEB' }, // streaks
      { d: 'M72 8L66 30L71 29Z', fill: '#FF8AEB' },
      { d: 'M92 22L81 39L85 40Z', fill: '#FF8AEB' },
      { d: 'M32 60Q52 53 74 60L74 64Q52 57 30 64Z', fill: '#A3128A' }, // roots
    ],
  },
  // Shield sunglasses, 90s sport style: one wide mirrored lens going from hot
  // pink to purple, a black top bar crackled with neon yellow-green, a neon
  // nose pad, a purple arm.
  visor: {
    eyes: true,
    w: 100,
    h: 44,
    anchor: [55, 20], // the middle of the lens
    shapes: [
      { d: 'M1 9L12 6L12 14L3 17Z', fill: '#7A2CF0', line: true }, // the near arm
      { d: 'M12 11Q55 6 98 11L96 28Q94 38 80 40H64Q59 32 55 32Q51 32 46 40H28Q14 38 13 28Z', fill: '#7A2CF0', line: true }, // lens
      { d: 'M13 12Q55 7 97 12L96 22Q55 17 14 24Z', fill: '#FF2E9A' }, // its mirror, pink fading to purple
      { d: 'M14 24Q55 17 96 22L95.5 27Q55 23 14.5 29Z', fill: '#C22DD0' },
      { d: 'M20 14L34 13L22 34L16 33Z', fill: 'rgba(255,255,255,0.25)' }, // shine
      { d: 'M10 3Q55 -3 100 3L100 11Q55 6 10 11Z', fill: '#141414', line: true }, // top bar
      { d: 'M15 5l5 1-2 2 5 1-1 1-6-1 2-2-4-1Z', fill: '#C6F31B' }, // crackle
      { d: 'M30 3l6 2-3 2 6 0 0 1-8 0 3-2-5-2Z', fill: '#C6F31B' },
      { d: 'M48 2l5 2 3-1 4 3-1 1-4-2-3 1-5-3Z', fill: '#C6F31B' },
      { d: 'M66 3l7 1-2 2 6 1-1 1-7-1 2-2-6-1Z', fill: '#C6F31B' },
      { d: 'M84 3l5 2 4-1 3 2-1 1-3-1-4 1-5-3Z', fill: '#C6F31B' },
      { d: 'M50 33Q55 27 60 33L58 36Q55 33 52 36Z', fill: '#C6F31B', line: true }, // nose pad
    ],
  },
  // A two-handed sci-fi blaster, rifle length and shape: stock, receiver
  // with a carry handle, magazine, handguard and barrel, neon strips down its
  // side. Held level by its pistol grip (the anchor), which fits inside the
  // hoof redrawn over it (layout.ts held), so the hoof wraps it.
  rifle: {
    w: 200,
    h: 60,
    anchor: [50, 43], // the middle of the grip
    shapes: [
      { d: 'M2 14L40 17V36L4 45Z', fill: '#2A2440', line: true }, // stock
      { d: 'M74 34H90L95 58H80Z', fill: '#1E1A30', line: true }, // magazine
      { d: 'M58 34Q66 36 66 43H58', fill: 'none', line: true }, // trigger guard
      { d: 'M46 34H58L55 52H42Z', fill: '#5A5080', line: true }, // grip, lighter than the hoof over it
      { d: rect(160, 20, 33, 7), fill: '#2A2440', line: true }, // barrel
      { d: rect(192, 17, 7, 13), fill: '#3A3458', line: true }, // flash hider
      { d: rect(108, 15, 52, 18), fill: '#3A3458', line: true }, // handguard
      { d: 'M155 15L158 5H164L163 15Z', fill: '#2A2440', line: true }, // front sight
      { d: 'M40 15H110V34H40Z', fill: '#2A2440', line: true }, // receiver
      { d: 'M58 15V5H98V15H92V10H64V15Z', fill: '#3A3458', line: true }, // carry handle
      { d: rect(44, 21, 62, 4), fill: '#FF2BD6' },
      { d: rect(62, 28, 40, 2.5), fill: '#2EF2E6' },
      { d: rect(113, 21, 42, 3), fill: '#FF2BD6' },
      { d: rect(113, 27, 42, 2.5), fill: '#2EF2E6' },
      { d: rect(6, 22, 30, 3), fill: '#2EF2E6' }, // on the stock
    ],
  },
  // A flying car: a low hull, a glass canopy, magenta lights and underglow.
  hoverCar: {
    w: 100,
    h: 46,
    shapes: [
      { d: 'M16 34H84L74 44H26Z', fill: 'rgba(255,43,214,0.45)' }, // underglow
      { d: 'M4 26Q10 12 34 10H66Q90 12 97 24Q90 34 50 34Q10 34 4 26Z', fill: '#2A2250', line: true }, // hull
      { d: 'M30 12Q40 1 60 3Q71 5 73 12Z', fill: 'rgba(46,242,230,0.55)', line: true }, // canopy
      { d: rect(12, 21, 48, 3.5), fill: '#FF2BD6' },
      { d: circle(84, 22, 3.5), fill: '#FF2BD6' }, // lights
      { d: circle(74, 23, 3), fill: '#FF2BD6' },
    ],
  },
  // A neon sign: a dark panel framed in pink, a pig's face in cyan tubing.
  neonSign: {
    w: 80,
    h: 100,
    shapes: [
      { d: rect(4, 4, 72, 92), fill: '#140C2E', line: true },
      { d: rect(11, 11, 58, 4) + rect(11, 85, 58, 4), fill: '#FF2BD6' }, // frame
      { d: 'M22 40L26 24L34 34Z', fill: '#2EF2E6' }, // ears
      { d: 'M58 40L54 24L46 34Z', fill: '#2EF2E6' },
      { d: circle(40, 50, 19), fill: '#2EF2E6' }, // face
      { d: circle(40, 50, 15), fill: '#140C2E' },
      { d: circle(33, 45, 2.5) + circle(47, 45, 2.5), fill: '#2EF2E6' }, // eyes
      { d: ellipse(40, 56, 8, 5.5), fill: '#2EF2E6' }, // snout
      { d: circle(37, 56, 1.8) + circle(43, 56, 1.8), fill: '#140C2E' },
    ],
  },
  // A microchip for the trough: a dark body, gold pins, a glowing dot.
  chip: {
    w: 100,
    h: 72,
    shapes: [
      { d: rect(24, 2, 6, 10) + rect(37, 2, 6, 10) + rect(50, 2, 6, 10) + rect(63, 2, 6, 10), fill: '#E3B23C', line: true }, // pins
      { d: rect(24, 60, 6, 10) + rect(37, 60, 6, 10) + rect(50, 60, 6, 10) + rect(63, 60, 6, 10), fill: '#E3B23C', line: true },
      { d: rect(16, 12, 64, 48), fill: '#1E1A30', line: true }, // body
      { d: rect(34, 24, 28, 24), fill: '#33285A' }, // die
      { d: rect(38, 34, 20, 3), fill: '#FF2BD6' },
      { d: circle(25, 20, 3.5), fill: '#2EF2E6' },
    ],
  },

  // ---- Outfits (src/avatar/outfits.ts): worn by a player's own pig when
  // they win, placed on the winner art there.
  crown: {
    head: true,
    w: 100,
    h: 70,
    anchor: [50, 62],
    shapes: [
      { d: 'M8 64L4 18L28 40L50 8L72 40L96 18L92 64Z', fill: '#F2C230', line: true },
      { d: 'M16 46L14 26L21 32Z', fill: 'rgba(255,255,255,0.45)' }, // shine
      { d: rect(8, 50, 84, 14), fill: '#E0A800', line: true }, // band
      { d: circle(4, 18, 4.5) + circle(96, 18, 4.5), fill: '#F7D35A', line: true },
      { d: circle(50, 8, 5), fill: '#F7D35A', line: true },
      { d: circle(50, 57, 4.5), fill: '#D62828', line: true }, // jewels
      { d: circle(28, 57, 3.5), fill: '#1E6FD9', line: true },
      { d: circle(72, 57, 3.5), fill: '#2E7D32', line: true },
    ],
  },
  topHat: {
    head: true,
    w: 100,
    h: 88,
    anchor: [50, 80],
    shapes: [
      { d: ellipse(50, 80, 48, 8), fill: '#1F1F1F', line: true }, // brim
      { d: 'M24 79L22 10Q50 4 78 10L76 79Q50 84 24 79Z', fill: '#1F1F1F', line: true },
      { d: 'M30 70L29 16L34 15L35 70Z', fill: '#3A3A3A' }, // highlight
      { d: 'M23.4 62Q50 67 76.6 62L76.2 72Q50 77 23.8 72Z', fill: '#B0123F', line: true }, // band
      { d: ellipse(50, 9.5, 28, 5), fill: '#2B2B2B', line: true }, // top
    ],
  },
  cowboyHat: {
    head: true,
    w: 100,
    h: 66,
    anchor: [50, 56],
    shapes: [
      { d: 'M2 48Q8 64 50 62Q92 64 98 48Q88 56 50 56Q12 56 2 48Z', fill: '#8B5A2B', line: true }, // brim
      { d: 'M22 54Q18 20 32 10Q42 18 50 10Q58 18 68 10Q82 20 78 54Q50 60 22 54Z', fill: '#A0692F', line: true },
      { d: 'M30 46Q28 26 36 18L39 20Q33 28 35 46Z', fill: '#BD8448' }, // highlight
      { d: 'M21.6 44Q50 50 78.4 44L78 54Q50 60 22 54Z', fill: '#4A2E16', line: true }, // band
    ],
  },
  chefHat: {
    head: true,
    w: 100,
    h: 100,
    anchor: [50, 92],
    shapes: [
      { d: 'M26 70Q8 64 12 44Q14 28 30 30Q32 12 50 12Q68 12 70 30Q86 28 88 44Q92 64 74 70Z', fill: '#FAFAFA', line: true },
      { d: rect(26, 68, 48, 24), fill: '#F0F0F0', line: true }, // band
      { d: 'M38 72V90M50 72V90M62 72V90', fill: 'none', line: true }, // pleats
    ],
  },
  shades: {
    w: 100,
    h: 40,
    shapes: [
      { d: 'M44 13Q50 8 56 13', fill: 'none', line: true }, // bridge
      { d: 'M4 8H44V20C44 30 36 34 24 34C12 34 4 30 4 20Z', fill: '#1A1A1A', line: true },
      { d: 'M56 8H96V20C96 30 88 34 76 34C64 34 56 30 56 20Z', fill: '#1A1A1A', line: true },
      { d: 'M10 12h8l-6 10h-4Z', fill: 'rgba(255,255,255,0.35)' }, // glints
      { d: 'M62 12h8l-6 10h-4Z', fill: 'rgba(255,255,255,0.35)' },
    ],
  },
  bowTie: {
    w: 100,
    h: 50,
    shapes: [
      { d: 'M50 25L8 6Q2 25 8 44Z', fill: '#D62828', line: true },
      { d: 'M50 25L92 6Q98 25 92 44Z', fill: '#D62828', line: true },
      { d: circle(22, 18, 3) + circle(20, 33, 3) + circle(78, 18, 3) + circle(80, 33, 3), fill: '#FFFFFF' }, // spots
      { d: 'M42 16Q50 13 58 16V34Q50 37 42 34Z', fill: '#B71C1C', line: true }, // knot
    ],
  },

  // ---- Speech bubbles (src/avatar/bubbles.ts): what a player's own pig
  // says when they win. The words go in the text slot, wrapping onto two
  // lines; a bubble with a tail points it down and left, at the pig.
  bubbleSpeech: {
    w: 200,
    h: 110,
    text: { x: 104, y: 47, size: 26, maxW: 160, fill: '#1A1A1A', lines: 2 },
    shapes: [{ d: 'M30 8H174Q194 8 194 30V64Q194 86 172 86H64L18 106L40 86H30Q8 86 8 64V30Q8 8 30 8Z', fill: '#FFFFFF', line: true }],
  },
  bubbleThought: {
    w: 200,
    h: 110,
    text: { x: 104, y: 48, size: 24, maxW: 132, fill: '#1A1A1A', lines: 2 },
    shapes: [
      { d: circle(16, 103, 5), fill: '#FFFFFF', line: true },
      { d: circle(32, 92, 8), fill: '#FFFFFF', line: true },
      { d: 'M48 84C24 88 14 66 26 54C12 40 26 16 48 24C54 8 80 4 94 16C106 4 136 6 144 20C160 8 188 14 190 34C200 44 198 66 180 72C180 88 154 94 140 84C128 96 100 96 90 86C76 96 56 94 48 84Z', fill: '#FFFFFF', line: true },
    ],
  },
  bubbleShout: {
    w: 200,
    h: 110,
    text: { x: 100, y: 55, size: 24, maxW: 124, fill: '#1A1A1A', lines: 2 },
    shapes: [{ d: burst(100, 55, 96, 52, 14, 0.8), fill: '#FFF176', line: true }],
  },
  bubbleHeart: {
    w: 200,
    h: 110,
    text: { x: 100, y: 52, size: 22, maxW: 104, fill: '#8E1047', lines: 2 },
    shapes: [{ d: heart(100, 60, 48), fill: '#FFD1DE', line: true }],
  },
  bubbleScroll: {
    w: 200,
    h: 110,
    text: { x: 100, y: 55, size: 24, maxW: 128, fill: '#4A2E16', lines: 2 },
    shapes: [
      { d: rect(26, 22, 148, 66), fill: '#F5E6C4', line: true },
      { d: ellipse(26, 55, 12, 38), fill: '#E8D3A6', line: true }, // rolled ends
      { d: ellipse(174, 55, 12, 38), fill: '#E8D3A6', line: true },
      { d: ellipse(26, 55, 4, 22), fill: '#C9AE78' },
      { d: ellipse(174, 55, 4, 22), fill: '#C9AE78' },
    ],
  },

  // ---- Stickers (src/stickers/art.ts): stamped on drawings. The Hats and
  // Characters packs also use props from above (a party hat, a bat…).
  eyesGoogly: {
    w: 100,
    h: 50,
    shapes: [
      { d: circle(26, 25, 22) + circle(74, 25, 22), fill: '#FFFFFF', line: true },
      { d: circle(18, 32, 9) + circle(80, 16, 9), fill: '#1A1A1A' }, // pupils, rolling
      { d: circle(15, 29, 2.5) + circle(77, 13, 2.5), fill: '#FFFFFF' },
    ],
  },
  eyesAngry: {
    w: 100,
    h: 56,
    shapes: [
      { d: 'M4 8L44 22L42 30L2 16Z', fill: '#1A1A1A', line: true }, // brows
      { d: 'M96 8L56 22L58 30L98 16Z', fill: '#1A1A1A', line: true },
      { d: ellipse(26, 42, 14, 11) + ellipse(74, 42, 14, 11), fill: '#FFFFFF', line: true },
      { d: circle(29, 44, 6) + circle(71, 44, 6), fill: '#1A1A1A' },
    ],
  },
  eyesSleepy: {
    w: 100,
    h: 40,
    shapes: [
      { d: 'M6 12Q26 30 46 12M54 12Q74 30 94 12', fill: 'none', line: true }, // shut lids
      { d: 'M14 22L10 30M26 25V34M38 22L42 30M62 22L58 30M74 25V34M86 22L90 30', fill: 'none', line: true }, // lashes
    ],
  },
  eyesHearts: {
    w: 100,
    h: 50,
    shapes: [
      { d: heart(26, 26, 17) + heart(74, 26, 17), fill: '#E53950', line: true },
      { d: ellipse(17, 18, 3, 5) + ellipse(65, 18, 3, 5), fill: '#FF9EAE' },
    ],
  },
  mouthSmile: {
    w: 100,
    h: 50,
    shapes: [
      { d: 'M6 10Q50 40 94 10Q90 46 50 46Q10 46 6 10Z', fill: '#5A1A1A', line: true },
      { d: 'M16 17Q50 32 84 17L82 24Q50 36 18 24Z', fill: '#FFFFFF' }, // teeth
    ],
  },
  mouthLaugh: {
    w: 100,
    h: 64,
    shapes: [
      { d: 'M6 8H94Q94 60 50 60Q6 60 6 8Z', fill: '#5A1A1A', line: true },
      { d: 'M28 46Q50 32 72 46Q66 58 50 58Q34 58 28 46Z', fill: '#E57373' }, // tongue
      { d: rect(14, 8, 72, 10), fill: '#FFFFFF', line: true }, // teeth
    ],
  },
  mouthTongue: {
    w: 100,
    h: 70,
    shapes: [
      { d: 'M34 24Q34 66 50 66Q66 66 66 24Z', fill: '#F48FB1', line: true }, // tongue
      { d: 'M50 32V52', fill: 'none', line: true },
      { d: 'M6 12Q50 46 94 12', fill: 'none', line: true }, // the grin over it
    ],
  },
  mouthFrown: {
    w: 100,
    h: 40,
    shapes: [{ d: 'M6 34Q50 -2 94 34L88 38Q50 8 12 38Z', fill: '#5A1A1A', line: true }],
  },
  ghost: {
    w: 100,
    h: 110,
    shapes: [
      { d: 'M10 104V46Q10 6 50 6Q90 6 90 46V104L76 92L63 104L50 92L37 104L24 92Z', fill: '#FAFAFA', line: true },
      { d: ellipse(36, 44, 6, 9) + ellipse(64, 44, 6, 9), fill: '#1A1A1A' }, // eyes
      { d: ellipse(50, 68, 8, 10), fill: '#1A1A1A' }, // "oooh"
      { d: 'M22 40Q24 22 38 16L40 20Q28 26 27 41Z', fill: '#E3E3E3' }, // shade
    ],
  },
  cat: {
    w: 100,
    h: 96,
    shapes: [
      { d: 'M14 42L18 4L46 24Z', fill: '#F2994A', line: true }, // ears
      { d: 'M86 42L82 4L54 24Z', fill: '#F2994A', line: true },
      { d: 'M21 30L23 14L35 24Z', fill: '#F8BBD0' },
      { d: 'M79 30L77 14L65 24Z', fill: '#F8BBD0' },
      { d: ellipse(50, 56, 42, 38), fill: '#F2994A', line: true }, // head
      { d: 'M42 22Q50 30 58 22M38 30Q50 38 62 30', fill: 'none', line: true }, // stripes
      { d: ellipse(34, 50, 7, 9) + ellipse(66, 50, 7, 9), fill: '#9CCC65', line: true }, // eyes
      { d: ellipse(34, 50, 2, 7) + ellipse(66, 50, 2, 7), fill: '#1A1A1A' },
      { d: 'M45 62H55L50 68Z', fill: '#F48FB1', line: true }, // nose
      { d: 'M50 68Q45 75 39 71M50 68Q55 75 61 71', fill: 'none', line: true }, // mouth
      { d: 'M28 64H6M28 69L8 76M72 64H94M72 69L92 76', fill: 'none', line: true }, // whiskers
    ],
  },

  // The pig's own left hoof on each piece of art, traced from it (layout.ts
  // HOOVES puts each back exactly where it was): redrawn over a held prop's
  // handle so the hoof wraps round it. Solid black like the art's, no rim.
  hoofStill: { w: 100, h: 88.2, rim: false, shapes: [{ d: 'M11.8 0.0L27.6 0.0L27.6 3.9L26.3 3.9L26.3 14.5L30.3 14.5L30.3 15.8L73.7 15.8L73.7 2.6L75.0 2.6L75.0 0.0L88.2 0.0L88.2 11.8L86.8 11.8L86.8 21.1L85.5 21.1L85.5 23.7L86.8 23.7L88.2 32.9L89.5 32.9L89.5 39.5L90.8 39.5L90.8 55.3L92.1 55.3L89.5 86.8L81.6 86.8L81.6 85.5L73.7 84.2L73.7 82.9L71.1 82.9L71.1 81.6L68.4 81.6L68.4 80.3L60.5 77.6L59.2 75.0L56.6 75.0L56.6 73.7L52.6 72.4L51.3 69.7L48.7 69.7L47.4 72.4L44.7 72.4L43.4 75.0L40.8 75.0L39.5 77.6L36.8 77.6L36.8 78.9L34.2 78.9L34.2 80.3L31.6 80.3L31.6 81.6L28.9 81.6L28.9 82.9L25.0 82.9L25.0 84.2L21.1 84.2L21.1 82.9L19.7 82.9L18.4 72.4L17.1 72.4L17.1 31.6L18.4 31.6L18.4 28.9L9.2 27.6L9.2 15.8L10.5 15.8L10.5 3.9L11.8 3.9Z', fill: '#000000' }] },
  hoofSign: { w: 100, h: 128.8, rim: false, shapes: [{ d: 'M9.1 0.0L24.2 0.0L24.2 30.3L22.7 30.3L22.7 31.8L36.4 31.8L36.4 33.3L47.0 33.3L47.0 34.8L50.0 34.8L50.0 33.3L60.6 31.8L60.6 30.3L68.2 30.3L68.2 28.8L86.4 28.8L86.4 27.3L100.0 28.8L100.0 113.6L59.1 113.6L59.1 112.1L56.1 112.1L56.1 116.7L54.5 116.7L53.0 119.7L48.5 119.7L48.5 121.2L27.3 121.2L27.3 119.7L0.0 118.2L0.0 100.0L39.4 103.0L39.4 98.5L40.9 98.5L40.9 48.5L27.3 48.5L27.3 50.0L24.2 50.0L24.2 51.5L6.1 51.5L6.1 31.8L7.6 31.8Z', fill: '#000000' }] },
  hoofPhone: { w: 100, h: 115.7, rim: false, shapes: [{ d: 'M98.6 0.0L100.0 0.0L100.0 115.7L98.6 115.7L98.6 108.6L87.1 108.6L87.1 110.0L61.4 108.6L61.4 107.1L54.3 107.1L54.3 105.7L48.6 105.7L48.6 104.3L44.3 104.3L44.3 102.9L41.4 102.9L41.4 104.3L31.4 104.3L31.4 105.7L18.6 105.7L18.6 107.1L0.0 107.1L0.0 92.9L1.4 92.9L1.4 91.4L35.7 90.0L35.7 42.9L34.3 42.9L34.3 38.6L0.0 40.0L0.0 24.3L22.9 22.9L22.9 21.4L35.7 21.4L35.7 20.0L48.6 20.0L50.0 30.0L52.9 30.0L52.9 28.6L98.6 27.1Z', fill: '#000000' }] },
  hoofWaiting: { w: 100, h: 108.3, rim: false, shapes: [{ d: 'M54.2 0.0L70.8 0.0L70.8 25.0L66.7 25.0L66.7 41.7L70.8 41.7L70.8 58.3L75.0 58.3L75.0 100.0L70.8 100.0L70.8 108.3L50.0 108.3L50.0 104.2L33.3 100.0L29.2 91.7L20.8 91.7L16.7 100.0L0.0 104.2L0.0 29.2L54.2 29.2Z', fill: '#000000' }] },
  hoofWinner: { w: 100, h: 89.5, rim: false, shapes: [{ d: 'M13.2 0.0L28.9 0.0L28.9 13.2L26.3 13.2L26.3 15.8L73.7 15.8L73.7 13.2L76.3 13.2L76.3 0.0L92.1 0.0L92.1 2.6L89.5 2.6L89.5 18.4L86.8 18.4L86.8 26.3L89.5 26.3L89.5 34.2L92.1 34.2L92.1 55.3L94.7 55.3L94.7 68.4L92.1 68.4L92.1 81.6L89.5 81.6L92.1 89.5L76.3 86.8L76.3 84.2L60.5 78.9L60.5 76.3L52.6 73.7L52.6 71.1L44.7 73.7L44.7 76.3L39.5 76.3L34.2 84.2L21.1 86.8L21.1 78.9L18.4 78.9L18.4 36.8L21.1 36.8L21.1 31.6L18.4 31.6L18.4 28.9L10.5 28.9Z', fill: '#000000' }] },
} satisfies Record<string, Prop>;

export type PropName = keyof typeof PROPS;
