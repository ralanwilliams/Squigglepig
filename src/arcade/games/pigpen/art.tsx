import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { rng } from '../../rng';
import type { FieldArea } from '../../FieldFrame';
import { makeMaze, walls, type Cell, type Maze } from './maze';

// The pen, made up fresh for each round from its seed: a grassy pasture
// fenced into a maze with post-and-rail fences, the trodden ground inside
// it, and a woven basket of apples in the far corner. The gate is open on
// the left of the top-left cell, where the pig starts. Drawn twice, by day
// and by night (FieldLight fades between them), from the same seed so the two
// line up exactly. Each kind of thing is one path where it can be (all the
// rails, all the posts, all the tufts), so a big pen stays cheap to draw.

export type Look = { seed: number; e: number }; // e: 0 on round 1, 1 on the last

type Palette = {
  grass: string;
  mottle: [string, string];
  tuft: string;
  floor: string;
  floorOpacity: number;
  rail: string;
  line: string;
  post: string;
  basket: string;
  weave: string;
  rim: string;
  apple: string;
  appleShine: string;
  green: string;
  greenShine: string;
};

const DAY: Palette = {
  grass: '#7FA24C',
  mottle: ['#6E9440', '#93B45C'],
  tuft: '#5E8634',
  floor: '#9DB65F',
  floorOpacity: 0.55,
  rail: '#B07A45',
  line: '#3E2715',
  post: '#8A5A2E',
  basket: '#C08A4A',
  weave: '#8A5A2E',
  rim: '#A8743C',
  apple: '#D32F2F',
  appleShine: '#FF8A80',
  green: '#7CB342',
  greenShine: '#C5E1A5',
};

// Moonlit: deep blue-green grass, darker fences; the apples keep their color.
const NIGHT: Palette = {
  grass: '#2B4436',
  mottle: ['#24392D', '#35523F'],
  tuft: '#1D3125',
  floor: '#3A5A45',
  floorOpacity: 0.5,
  rail: '#7D6A55',
  line: '#120C07',
  post: '#5E4A38',
  basket: '#9C7040',
  weave: '#5E3E1F',
  rim: '#86602F',
  apple: '#C62828',
  appleShine: '#F28B82',
  green: '#689F38',
  greenShine: '#AED581',
};

export type Pen = {
  maze: Maze;
  cell: number; // a cell's size, px
  start: Cell;
  goal: Cell;
  centre: (c: Cell) => { x: number; y: number };
  day: React.ReactElement;
  night: React.ReactElement;
};

const f1 = (v: number) => v.toFixed(1);
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f1(cx - rx)} ${f1(cy)}a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(2 * rx)} 0a${f1(rx)} ${f1(ry)} 0 1 0 ${f1(-2 * rx)} 0Z`;

// The pen for a field `w` × `h`, the maze fitted inside `box` (the clear box
// between the chips), its cells from about 64 dp on round 1 to about 30 on
// the last (times the UI scale `s`), so later rounds are bigger mazes.
export function makePen(w: number, h: number, box: FieldArea, look: Look, s: number): Pen {
  const margin = 6 * s;
  const bw = box.x1 - box.x0 - 2 * margin;
  const bh = box.y1 - box.y0 - 2 * margin;
  const want = (64 - 34 * look.e) * s;
  const cols = Math.max(3, Math.floor(bw / want));
  const rows = Math.max(3, Math.floor(bh / want));
  const c = Math.min(bw / cols, bh / rows);
  const ox = (box.x0 + box.x1 - cols * c) / 2;
  const oy = (box.y0 + box.y1 - rows * c) / 2;
  const maze = makeMaze(cols, rows, rng(look.seed));
  const goal: Cell = [cols - 1, rows - 1];
  const centre = ([x, y]: Cell) => ({ x: ox + (x + 0.5) * c, y: oy + (y + 0.5) * c });

  // Fences and posts don't depend on the palette: work them out once.
  const gap = c * 0.09;
  let rails = '';
  const posts = new Map<string, [number, number]>();
  for (const [x1, y1, x2, y2] of walls(maze)) {
    const ax = ox + x1 * c;
    const ay = oy + y1 * c;
    const bx = ox + x2 * c;
    const by = oy + y2 * c;
    const flat = ay === by;
    for (const g of [-gap, gap]) {
      rails += `M${f1(ax + (flat ? 0 : g))} ${f1(ay + (flat ? g : 0))}L${f1(bx + (flat ? 0 : g))} ${f1(by + (flat ? g : 0))}`;
    }
    posts.set(`${x1},${y1}`, [ax, ay]);
    posts.set(`${x2},${y2}`, [bx, by]);
  }
  const ps = c * 0.2;
  let postPath = '';
  posts.forEach(([x, y]) => {
    postPath += `M${f1(x - ps / 2)} ${f1(y - ps / 2)}h${f1(ps)}v${f1(ps)}h${f1(-ps)}Z`;
  });
  const railW = Math.max(2, c * 0.07);
  const g = centre(goal);

  const draw = (P: Palette) => {
    const rand = rng(look.seed + 7); // the same scatter by day and by night
    const mottles: [string, string] = ['', ''];
    for (let i = 0; i < (w * h) / 5000; i++) {
      mottles[i % 2] += ellipse(rand() * w, rand() * h, 20 + rand() * 46, 10 + rand() * 20);
    }
    let tufts = '';
    for (let i = 0; i < (w * h) / 900; i++) {
      const x = rand() * w;
      const y = rand() * h;
      tufts += `M${f1(x)} ${f1(y)}l-2 -6M${f1(x + 3)} ${f1(y)}l0 -7M${f1(x + 6)} ${f1(y)}l2 -6`;
    }
    return (
      <Svg width={w} height={h}>
        <Rect width={w} height={h} fill={P.grass} />
        <Path d={mottles[0]} fill={P.mottle[0]} opacity={0.6} />
        <Path d={mottles[1]} fill={P.mottle[1]} opacity={0.6} />
        <Path d={tufts} stroke={P.tuft} strokeWidth={1.4} strokeLinecap="round" fill="none" />
        <Rect x={ox} y={oy} width={cols * c} height={rows * c} rx={c * 0.2} fill={P.floor} opacity={P.floorOpacity} />
        <Basket x={g.x} y={g.y + c * 0.08} c={c} P={P} />
        <Path d={rails} stroke={P.line} strokeWidth={railW + 2} strokeLinecap="round" fill="none" />
        <Path d={rails} stroke={P.rail} strokeWidth={railW} strokeLinecap="round" fill="none" />
        <Path d={postPath} fill={P.post} stroke={P.line} strokeWidth={1.4} strokeLinejoin="round" />
      </Svg>
    );
  };

  return { maze, cell: c, start: [0, 0], goal, centre, day: draw(DAY), night: draw(NIGHT) };
}

// A woven basket of apples, centred at x, y, sized to a cell `c`.
function Basket({ x, y, c, P }: { x: number; y: number; c: number; P: Palette }) {
  const bw = c * 0.62;
  const bh = c * 0.32;
  const handle = `M${f1(-bw * 0.54)} ${f1(-bh * 0.55)}Q0 ${f1(-bh * 2.2)} ${f1(bw * 0.54)} ${f1(-bh * 0.55)}`;
  const apples: [number, number, boolean][] = [
    [-0.26, -0.5, false],
    [0.02, -0.62, true],
    [0.27, -0.48, false],
    [-0.12, -0.72, false],
    [0.16, -0.76, false],
  ];
  const r = c * 0.11;
  const weave =
    `M${f1(-bw * 0.46)} ${f1(-bh * 0.1)}L${f1(bw * 0.46)} ${f1(-bh * 0.1)}M${f1(-bw * 0.42)} ${f1(bh * 0.2)}L${f1(bw * 0.42)} ${f1(bh * 0.2)}` +
    [-0.25, 0, 0.25].map((k) => `M${f1(k * bw)} ${f1(-bh / 2)}L${f1(k * bw * 0.8)} ${f1(bh * 0.52)}`).join('');
  return (
    <G transform={`translate(${f1(x)} ${f1(y)})`}>
      <Path d={ellipse(0, bh * 0.62, bw * 0.52, bh * 0.22)} fill="#000" opacity={0.2} />
      <Path d={handle} stroke={P.line} strokeWidth={c * 0.07 + 2} strokeLinecap="round" fill="none" />
      <Path d={handle} stroke={P.rim} strokeWidth={c * 0.07} strokeLinecap="round" fill="none" />
      {apples.map(([ax, ay, green], i) => (
        <G key={i}>
          <Circle cx={ax * bw} cy={ay * bh} r={r} fill={green ? P.green : P.apple} stroke={P.line} strokeWidth={1.2} />
          <Circle cx={ax * bw - r * 0.35} cy={ay * bh - r * 0.35} r={r * 0.28} fill={green ? P.greenShine : P.appleShine} opacity={0.8} />
          <Path d={`M${f1(ax * bw)} ${f1(ay * bh - r)}l${f1(r * 0.15)} ${f1(-r * 0.45)}`} stroke={P.line} strokeWidth={1.3} strokeLinecap="round" />
        </G>
      ))}
      <Path
        d={`M${f1(-bw / 2)} ${f1(-bh / 2)}L${f1(bw / 2)} ${f1(-bh / 2)}L${f1(bw * 0.38)} ${f1(bh / 2)}Q0 ${f1(bh * 0.62)} ${f1(-bw * 0.38)} ${f1(bh / 2)}Z`}
        fill={P.basket}
        stroke={P.line}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path d={weave} stroke={P.weave} strokeWidth={1.3} fill="none" />
      <Rect x={-bw * 0.56} y={-bh * 0.66} width={bw * 1.12} height={bh * 0.3} rx={bh * 0.15} fill={P.rim} stroke={P.line} strokeWidth={1.4} />
    </G>
  );
}
