// Builds the Draw from memory pack (src/arcade/games/memory/pack.json) from
// Google's Quick, Draw! dataset (CC BY 4.0, credited on app/licenses.tsx):
//
//   npm run quickdraw                  write the pack
//   npm run quickdraw -- --calibrate   print how the scorer rates pairs
//
// For each category below it reads the start of the category's "simplified"
// file (strokes as x / y lists in a 0–255 box), keeps doodles the Quick, Draw!
// game itself recognised, and turns them into paths in drawing units
// (src/lib/drawing.ts SPACE), centred with a margin. Of those it keeps PER
// whose shapes are most like the rest of their category (score.ts): the
// clearest, most typical cat, not the one cat drawn upside down.
//
// The pack lists them easiest first (fewest strokes, least ink), which is how
// makeRun deals them out over a run.
//
// Needs Node 23.6 or later (it runs TypeScript as is).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cloud, likeness } from '../src/arcade/games/memory/score.ts';

// Things anyone could draw from a glance, by the dataset's own names
// (github.com/googlecreativelab/quickdraw-dataset categories.txt). Not
// snowflake or stop sign: their doodles are scribbles and handwriting.
const CATEGORIES = [
  'airplane', 'alarm clock', 'ant', 'apple', 'backpack', 'banana', 'barn', 'basket', 'basketball', 'bear',
  'bed', 'bee', 'bench', 'bicycle', 'bird', 'birthday cake', 'book', 'bowtie', 'bread', 'bridge',
  'broccoli', 'broom', 'bucket', 'bus', 'butterfly', 'cactus', 'camera', 'campfire', 'candle', 'canoe',
  'car', 'carrot', 'castle', 'cat', 'chair', 'church', 'clock', 'cloud', 'cookie', 'couch',
  'cow', 'crab', 'crayon', 'crown', 'cup', 'diamond', 'dog', 'dolphin', 'donut', 'door',
  'drums', 'duck', 'elephant', 'envelope', 'eye', 'eyeglasses', 'feather', 'fence', 'fire hydrant', 'fish',
  'flamingo', 'flashlight', 'flip flops', 'flower', 'flying saucer', 'fork', 'frog', 'giraffe', 'grapes', 'guitar',
  'hamburger', 'hammer', 'hand', 'hat', 'headphones', 'hedgehog', 'helicopter', 'hot air balloon', 'hot dog', 'hourglass',
  'house', 'house plant', 'ice cream', 'key', 'ladder', 'lantern', 'laptop', 'leaf', 'light bulb', 'lightning',
  'lighthouse', 'lion', 'lollipop', 'mailbox', 'microphone', 'monkey', 'moon', 'mountain', 'mouse', 'mushroom',
  'necklace', 'octopus', 'owl', 'paintbrush', 'palm tree', 'panda', 'pants', 'paper clip', 'parachute', 'pear',
  'pencil', 'penguin', 'piano', 'pig', 'pineapple', 'pizza', 'popsicle', 'rabbit', 'rainbow', 'sailboat',
  'sandwich', 'scissors', 'sea turtle', 'sheep', 'shoe', 'shovel', 'skateboard', 'smiley face', 'snail', 'snake',
  'snowman', 'soccer ball', 'sock', 'spider', 'spoon', 'star', 'strawberry', 'submarine',
  'suitcase', 'sun', 'swan', 't-shirt', 'teapot', 'teddy-bear', 'television', 'tent', 'tooth', 'toothbrush',
  'tractor', 'traffic light', 'train', 'tree', 'truck', 'umbrella', 'watermelon', 'whale', 'windmill', 'zebra',
];
// What the game calls a category, where the dataset's name won't do.
const NAMES: Record<string, string> = { 'teddy-bear': 'teddy bear' };
const BASE = 'https://storage.googleapis.com/quickdraw_dataset/full/simplified/';
const BYTES = 1_500_000; // the start of each file: a few thousand doodles
const SAMPLE = 150; // doodles per category compared for typicality
const PER = 3; // doodles per category in the pack
const MAX_STROKES = 14;
const SPACE = { w: 400, h: 300 }; // src/lib/drawing.ts
const MARGIN = 30;
const OUT = fileURLToPath(new URL('../src/arcade/games/memory/pack.json', import.meta.url));

type Raw = { word: string; recognized: boolean; drawing: [number[], number[]][] };
type Entry = { word: string; strokes: string[] };

// The download drops now and then; each category gets a few tries.
async function download(word: string, tries = 3): Promise<string> {
  try {
    const res = await fetch(BASE + encodeURIComponent(word) + '.ndjson', { headers: { Range: `bytes=0-${BYTES - 1}` } });
    if (!res.ok) throw new Error(`${word}: HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    if (tries <= 1) throw e;
    return download(word, tries - 1);
  }
}

async function doodles(word: string): Promise<Raw[]> {
  const lines = (await download(word)).split('\n');
  lines.pop(); // cut off mid-line by the range
  return lines.map((l) => JSON.parse(l) as Raw).filter((d) => d.recognized && d.drawing.length <= MAX_STROKES);
}

// Into drawing units: the doodle's own extent, scaled to fit the space less
// the margin, centred.
function toPaths(d: Raw): string[] {
  const xs = d.drawing.flatMap((s) => s[0]);
  const ys = d.drawing.flatMap((s) => s[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - x0);
  const h = Math.max(1, Math.max(...ys) - y0);
  const k = Math.min((SPACE.w - 2 * MARGIN) / w, (SPACE.h - 2 * MARGIN) / h);
  const ox = (SPACE.w - w * k) / 2;
  const oy = (SPACE.h - h * k) / 2;
  return d.drawing.map(([sx, sy]) =>
    sx.map((x, i) => `${i ? 'L' : 'M'}${Math.round(ox + (x - x0) * k)} ${Math.round(oy + (sy[i] - y0) * k)}`).join('')
  );
}

// How hard a doodle is to remember: its strokes, and its ink in screen widths.
function effort(strokes: string[]) {
  let ink = 0;
  for (const s of strokes) {
    const n = s.match(/-?\d+/g)!.map(Number);
    for (let i = 2; i + 1 < n.length; i += 2) ink += Math.hypot(n[i] - n[i - 2], n[i + 1] - n[i - 1]);
  }
  return strokes.length + ink / SPACE.w;
}

// Each doodle's mean likeness to the others in the sample, best first.
function typical(sample: string[][]) {
  const clouds = sample.map(cloud);
  return clouds
    .map((c, i) => ({ i, mean: clouds.reduce((s, o, j) => (j === i ? s : s + likeness(c, o)), 0) / (clouds.length - 1) }))
    .sort((a, b) => b.mean - a.mean);
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];
const spread = (xs: number[]) => [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => String(pct(xs, p)).padStart(3)).join(' ');

async function build() {
  const pack: (Entry & { effort: number })[] = [];
  for (const word of CATEGORIES) {
    const sample = (await doodles(word)).slice(0, SAMPLE).map(toPaths);
    const best = typical(sample).slice(0, PER);
    for (const { i } of best) pack.push({ word: NAMES[word] ?? word, strokes: sample[i], effort: effort(sample[i]) });
    console.log(`${word.padEnd(16)} ${sample.length} doodles, kept ${best.map((b) => Math.round(b.mean)).join(' / ')}`);
  }
  pack.sort((a, b) => a.effort - b.effort);
  writeFileSync(OUT, JSON.stringify(pack.map(({ word, strokes }) => ({ word, strokes }))) + '\n');
  console.log(`${pack.length} drawings → ${OUT}`);
}

// Score spreads (10th / 25th / 50th / 75th / 90th percentile) for:
//   same    a typical doodle against other people's doodles of the same thing
//   other   a typical doodle against doodles of something else
//   jitter  a typical doodle against itself redrawn: every point nudged,
//           stretched a little, one stroke left out (a fair attempt from memory)
async function calibrate() {
  const words = CATEGORIES.slice(0, 16);
  const byWord = new Map<string, string[][]>();
  for (const w of words) byWord.set(w, (await doodles(w)).slice(0, 60).map(toPaths));
  const same: number[] = [];
  const other: number[] = [];
  const jitter: number[] = [];
  for (const [w, sample] of byWord) {
    const ref = sample[typical(sample)[0].i];
    const rc = cloud(ref);
    for (const d of sample.slice(0, 30)) if (d !== ref) same.push(likeness(rc, cloud(d)));
    for (const [w2, s2] of byWord) if (w2 !== w) for (const d of s2.slice(0, 4)) other.push(likeness(rc, cloud(d)));
    for (let t = 0; t < 10; t++) jitter.push(likeness(rc, cloud(redraw(ref))));
  }
  console.log('            p10 p25 p50 p75 p90');
  console.log(`same     ${spread(same)}`);
  console.log(`other    ${spread(other)}`);
  console.log(`jitter   ${spread(jitter)}`);
}

function redraw(strokes: string[]): string[] {
  const sx = 0.85 + Math.random() * 0.3;
  const sy = 0.85 + Math.random() * 0.3;
  const drop = strokes.length > 2 ? Math.floor(Math.random() * strokes.length) : -1;
  return strokes
    .filter((_, i) => i !== drop)
    .map((s) =>
      s.replace(/(-?\d+) (-?\d+)/g, (_, x, y) => `${Math.round(x * sx + (Math.random() - 0.5) * 24)} ${Math.round(y * sy + (Math.random() - 0.5) * 24)}`)
    );
}

await (process.argv.includes('--calibrate') ? calibrate() : build());
