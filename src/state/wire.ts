import type { Cell, Chain, Phase } from './rules';
import { cleanName, cleanPhrase } from '../lib/text';

// What arrives on a room's live channel, read defensively. The channel only
// lets the room's members in (supabase/rooms.sql), but a member could be
// running a changed copy of the app and send anything: text past the text
// boxes' limits, a list where a number goes, nothing at all. Each reader here
// takes whatever came and gives back something of the right shape, with
// names and phrases cleaned (src/lib/text.ts) and numbers kept in sensible
// bounds, or null when there's nothing usable, which the handler ignores.
// GameContext wraps every handler too, so even a message these don't foresee
// can't throw and close the app.

// Generous ceilings, far past any real game, so nothing real is cut.
const MAX_PLAYERS = 100; // names in a roster, chains in a round
const MAX_STAGES = 200; // cells in a chain
const MAX_PROMPTS = 2000; // prompts in the pool
const MAX_TARGET = 99; // the points-to-win stepper
// A drawing is small JSON (src/lib/drawing.ts); one bigger than this is junk
// and counts as blank.
const MAX_DRAWING = 1_000_000;

const PHASES: Phase[] = ['lobby', 'prompts', 'view', 'draw', 'caption', 'reveal', 'gameover'];

type Obj = Record<string, unknown>;
export const asObj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});

export function asInt(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

export const asNames = (v: unknown): string[] => list(v, MAX_PLAYERS).map(cleanName).filter(Boolean);

export const asIndex = (v: unknown) => asInt(v, 0, MAX_PLAYERS);
// The round a game message belongs to; null from an app that doesn't say.
export const asRound = (v: unknown) => asInt(v, 0, 100_000);
export const asStage = (v: unknown) => asInt(v, 0, MAX_STAGES);
export const asTarget = (v: unknown) => asInt(v, 1, MAX_TARGET);

export type Prompt = { text: string; author: string };
export function asPrompt(v: unknown): Prompt | null {
  const p = asObj(v);
  const text = cleanPhrase(p.text);
  return text ? { text, author: cleanName(p.author) } : null;
}
export const asPrompts = (v: unknown): Prompt[] =>
  list(v, MAX_PROMPTS).map(asPrompt).filter((p): p is Prompt => !!p);

// Lists matched to the roster by position (a round's seeds, its chains): one
// bad entry would move everyone after it onto someone else's turn, so the
// whole list is refused instead.
function strict<T>(v: unknown, read: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v) || v.length > MAX_PLAYERS) return null;
  const out = v.map(read);
  return out.every((x) => x !== null) ? (out as T[]) : null;
}
export const asSeeds = (v: unknown) => strict(v, asPrompt);
export const asRoster = (v: unknown) => strict(v, (x) => cleanName(x) || null);

// A turn. Empty guesses and blank drawings are real turns (they score), so
// they come through; only something that isn't a turn at all is null.
export function asCell(v: unknown): Cell | null {
  const c = asObj(v);
  const author = cleanName(c.author);
  const marks = {
    ...(c.skip === true ? { skip: true as const } : {}),
    ...(c.left === true ? { left: true as const } : {}),
  };
  if (c.kind === 'prompt') {
    const text = cleanPhrase(c.text);
    return text ? { kind: 'prompt', text, author } : null;
  }
  if (c.kind === 'drawing') {
    const data = typeof c.data === 'string' && c.data.length <= MAX_DRAWING ? c.data : '';
    return { kind: 'drawing', data, author, ...marks };
  }
  if (c.kind === 'caption') return { kind: 'caption', text: cleanPhrase(c.text), author, ...marks };
  return null;
}

// Cells in a chain keep their places: a turn not yet handed in is a gap
// (null), which every reader of a chain already passes over.
export const asCells = (v: unknown): Cell[] => list(v, MAX_STAGES).map(asCell) as Cell[];

export function asChain(v: unknown): Chain | null {
  const cells = asCells(asObj(v).cells);
  return cells[0]?.kind === 'prompt' ? { cells } : null;
}
export const asChains = (v: unknown) => strict(v, asChain);

// The judge's ✓ / ✗ by cell index.
export function asRulings(v: unknown): Record<number, boolean> {
  const out: Record<number, boolean> = {};
  for (const [k, r] of Object.entries(asObj(v))) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i <= MAX_STAGES && typeof r === 'boolean') out[i] = r;
  }
  return out;
}

function asScores(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(asObj(v)).slice(0, MAX_PLAYERS)) {
    const name = cleanName(k);
    if (name && typeof n === 'number' && Number.isFinite(n)) out[name] = Math.max(-9999, Math.min(9999, Math.round(n)));
  }
  return out;
}

const asTime = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

// Under the per-round scoring rule (./rules), who has lost this round's point
// and at which turn (`chain:cell`, or `chain:judge`).
function asDockedAt(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, w] of Object.entries(asObj(v)).slice(0, MAX_PLAYERS)) {
    const name = cleanName(k);
    if (name && typeof w === 'string' && /^\d{1,3}:(\d{1,3}|judge)$/.test(w)) out[name] = w;
  }
  return out;
}

// The whole game, as a caught-up phone sends it to one catching up (and the
// keeper saves it as the room's snapshot). Anything missing or malformed takes
// its starting value, as a fresh game would have it.
export function asState(v: unknown) {
  const st = asObj(v);
  const phase = PHASES.includes(st.phase as Phase) ? (st.phase as Phase) : 'lobby';
  const prompts = asPrompts(st.prompts);
  return {
    to: st.to === '*' ? '*' : cleanName(st.to),
    phase,
    stage: asStage(st.stage) ?? 0,
    roster: asRoster(st.roster) ?? [],
    chains: asChains(st.chains) ?? [],
    scores: asScores(st.scores),
    target: asTarget(st.target) ?? 5,
    leader: cleanName(st.leader),
    round: asInt(st.round, 0, 100_000) ?? 0,
    revealIndex: asIndex(st.revealIndex) ?? 0,
    revealStep: asStage(st.revealStep) ?? 0,
    rulings: asRulings(st.rulings),
    promptCount: asInt(st.promptCount, 0, MAX_PROMPTS) ?? prompts.length,
    prompts,
    pool: asPrompts(st.pool),
    // Prompts handed out so far this game (a keeper from before this was kept
    // sends none: []).
    used: asPrompts(st.used),
    viewAcks: asNames(st.viewAcks),
    // The game's scoring rules, null from an app that doesn't say (2.9.0,
    // which only knows the first: ./rules asRules), and under the per-round
    // rule who has lost this round's point, and where; whether someone has
    // stood in for the owner of the chain being judged.
    rules: asInt(st.rules, 1, 1000),
    docked: asNames(st.docked),
    dockedAt: asDockedAt(st.dockedAt),
    stoodIn: st.stoodIn === true,
    stageStartedAt: asTime(st.stageStartedAt),
    savedAt: asTime(st.savedAt),
    // When the clock stopped: the keeper went off screen, saving the game
    // (none while one is keeping it). If nobody carried on, the game is
    // picked up as it was then, its stage's time and all.
    pausedAt: asTime(st.pausedAt),
    // The sender's clock as it sent this (a snapshot has none: 0).
    sentAt: asTime(st.sentAt),
  };
}
export type GameState = ReturnType<typeof asState>;
