import { REWARDS, type Reward } from '../rewards/catalog';
import type { Prize } from './engine';

// The tiers to offer from, in order, for each prize.
const FALLBACK: Record<Prize, Prize[]> = {
  common: ['common', 'rare', 'premium'],
  rare: ['rare', 'common', 'premium'],
  premium: ['premium', 'rare', 'common'],
};

// What a banked pot offers (engine.ts Prize): up to OFFER rewards of its
// tier, picked at random from the ones the player doesn't own yet, to choose
// one of. A tier with nothing left offers from the nearest one that has
// something (premium falls back to rare, then common); with nothing left at
// all the list is empty (the player has won everything there is).
//
// Rewards still coming soon (catalog.ts `soon`) are never offered, except in
// development builds, so the payout can be tried with a full catalog.

export const OFFER = 3;

// The rewards the player could still be given.
export function unowned(owned: ReadonlySet<string>, includeSoon = __DEV__): Reward[] {
  return REWARDS.filter((r) => !owned.has(r.id) && (includeSoon || !r.soon));
}

export function offers(prize: Prize, owned: ReadonlySet<string>, rand: () => number = Math.random, includeSoon = __DEV__): Reward[] {
  const pool = unowned(owned, includeSoon);
  for (const tier of FALLBACK[prize]) {
    const list = pool.filter((r) => r.tier === tier);
    if (list.length) return shuffle(list, rand).slice(0, OFFER);
  }
  return [];
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
