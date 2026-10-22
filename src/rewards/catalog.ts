import type { GlyphName } from '../components/Glyph';

// Everything a player can unlock, in one list. Rewards are earned by playing
// solo, never bought: there is no currency and no store. Every reward's art
// ships in the app; owning one only decides whether this player may USE it
// (anyone can see a color, sticker or outfit someone else is using).
//
// Ownership is kept on the phone (inventory.tsx), by id. An id is saved in
// AsyncStorage, so once a reward has shipped its id never changes; a label
// can. Ids are `<kind>.<name>`.
//
// To add a reward, add a line to its kind's list below. To add a kind of
// reward, add it to KINDS and give it a list (and a thumbnail in
// RewardThumb.tsx). This file is plain data with no React Native in it, so
// the previews build from it too (previews/_build-rewards.mjs).

// How hard a reward is to win. A solo run that banks more rounds draws from a
// higher tier.
export type Tier = 'common' | 'rare';

// The kinds, in the order the Rewards screen lists them. `pick` is how an
// owned reward is used:
//   one — the player chooses one to wear or show (a theme, an outfit), and the
//         inventory remembers the choice; `none` names the default, what
//         shows with nothing chosen;
//   any — every one owned is available at once (brush colors, sticker packs),
//         chosen in the moment.
// An outfit and a speech bubble dress the player's own pig: when they win a
// game, everyone sees it on the scoreboard (a tie lines up every winner's
// pig), saying what they wrote in the bubble (inventory.tsx bubbleText). No
// bubble is free: a player without one won shows none.
export const KINDS = {
  theme: { label: 'Themes', glyph: 'palette', pick: 'one', none: 'Classic' },
  brush: { label: 'Brushes', glyph: 'brush', pick: 'any' },
  sticker: { label: 'Stickers', glyph: 'sticker', pick: 'any' },
  outfit: { label: 'Outfits', glyph: 'hat', pick: 'one', none: 'No outfit' },
  bubble: { label: 'Speech bubbles', glyph: 'bubble', pick: 'one', none: 'No bubble' },
} as const satisfies Record<string, { label: string; glyph: GlyphName; pick: 'one' | 'any'; none?: string }>;

export type Kind = keyof typeof KINDS;

// `soon` lists a reward before the feature that uses it is built: the Rewards
// screen shows it as coming soon, and nothing can award it yet. Remove the
// flag in the change that makes the reward work.
type Base = { id: string; label: string; tier: Tier; soon?: true };

export type ThemeReward = Base & { kind: 'theme' };
export type BrushReward = Base & { kind: 'brush'; color: string }; // ink on the white paper
export type StickerReward = Base & { kind: 'sticker' };
export type OutfitReward = Base & { kind: 'outfit' };
export type BubbleReward = Base & { kind: 'bubble' };
export type Reward = ThemeReward | BrushReward | StickerReward | OutfitReward | BubbleReward;

// The most a pig's speech bubble may say, in characters: about what fits on
// one line of the bubble on the scoreboard (the same cap as a name on the
// birthday cake).
export const BUBBLE_MAX = 24;

// Each kind's list, without its `kind` (added below).
type Entry<R extends Reward> = Omit<R, 'kind'>;

// Each one's art is a skin in src/theme/skins (index.ts UNLOCKABLE).
const THEMES: Entry<ThemeReward>[] = [
  { id: 'theme.railroad', label: 'Railroad', tier: 'rare' }, // src/theme/skins/railroad.ts
  { id: 'theme.accountant', label: 'Accountant', tier: 'rare', soon: true },
  { id: 'theme.wasteManagement', label: 'Waste Management', tier: 'rare', soon: true },
  { id: 'theme.developer', label: 'Developer', tier: 'rare', soon: true },
];

// Colors drawn on the canvas's white paper, which is never themed, so each is
// dark enough to read as a line on white.
const BRUSHES: Entry<BrushReward>[] = [
  { id: 'brush.barnRed', label: 'Barn red', tier: 'common', color: '#C62828', soon: true },
  { id: 'brush.carrot', label: 'Carrot', tier: 'common', color: '#E8650A', soon: true },
  { id: 'brush.corn', label: 'Corn', tier: 'common', color: '#D9A300', soon: true },
  { id: 'brush.clover', label: 'Clover', tier: 'common', color: '#2E7D32', soon: true },
  { id: 'brush.pond', label: 'Pond', tier: 'common', color: '#1E6FD9', soon: true },
  { id: 'brush.grape', label: 'Grape', tier: 'common', color: '#6A1B9A', soon: true },
  { id: 'brush.pigPink', label: 'Pig pink', tier: 'common', color: '#E2577F', soon: true },
  { id: 'brush.mud', label: 'Mud', tier: 'common', color: '#6D4C41', soon: true },
];

// Packs of pre-drawn pictures a player can stamp onto the canvas in the main
// game, beside what they draw by hand. Owning a pack unlocks every sticker
// in it.
const STICKERS: Entry<StickerReward>[] = [
  { id: 'sticker.eyes', label: 'Eyes', tier: 'common', soon: true },
  { id: 'sticker.mouths', label: 'Mouths', tier: 'common', soon: true },
  { id: 'sticker.hats', label: 'Hats', tier: 'common', soon: true },
  { id: 'sticker.characters', label: 'Characters', tier: 'rare', soon: true },
];

// Worn by the pig on the scoreboard when this player wins.
const OUTFITS: Entry<OutfitReward>[] = [
  { id: 'outfit.crown', label: 'Crown', tier: 'rare', soon: true },
  { id: 'outfit.topHat', label: 'Top hat', tier: 'rare', soon: true },
  { id: 'outfit.cowboyHat', label: 'Cowboy hat', tier: 'common', soon: true },
  { id: 'outfit.chefHat', label: "Chef's hat", tier: 'common', soon: true },
  { id: 'outfit.shades', label: 'Sunglasses', tier: 'common', soon: true },
  { id: 'outfit.bowTie', label: 'Bow tie', tier: 'common', soon: true },
];

// The shape of the pig's speech bubble; the words in it are the player's own.
const BUBBLES: Entry<BubbleReward>[] = [
  { id: 'bubble.speech', label: 'Speech', tier: 'common', soon: true },
  { id: 'bubble.thought', label: 'Thought cloud', tier: 'common', soon: true },
  { id: 'bubble.shout', label: 'Shout', tier: 'common', soon: true },
  { id: 'bubble.heart', label: 'Heart', tier: 'rare', soon: true },
  { id: 'bubble.scroll', label: 'Royal scroll', tier: 'rare', soon: true },
];

const tag = <R extends Reward>(kind: R['kind'], list: Entry<R>[]): R[] => list.map((r) => ({ ...r, kind }) as R);

// Every reward, grouped by kind in KINDS order.
export const REWARDS: Reward[] = [
  ...tag<ThemeReward>('theme', THEMES),
  ...tag<BrushReward>('brush', BRUSHES),
  ...tag<StickerReward>('sticker', STICKERS),
  ...tag<OutfitReward>('outfit', OUTFITS),
  ...tag<BubbleReward>('bubble', BUBBLES),
];

const BY_ID = new Map(REWARDS.map((r) => [r.id, r]));

export const rewardById = (id: string): Reward | undefined => BY_ID.get(id);

// A card standing for a pick-one kind's default (KINDS `none`): what shows
// with nothing chosen. Not a real reward: every player has it, and choosing
// it saves no id (inventory.tsx choose(kind, null)).
export function noneOf(kind: Kind): Reward | null {
  const label = (KINDS[kind] as { none?: string }).none;
  return label ? ({ id: `${kind}.none`, kind, label, tier: 'common' } as Reward) : null;
}

export const isNone = (r: Reward) => r.id === `${r.kind}.none`;

export const rewardsOf = <K extends Kind>(kind: K) => REWARDS.filter((r): r is Extract<Reward, { kind: K }> => r.kind === kind);
