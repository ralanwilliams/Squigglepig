import { REWARDS, type Reward, type Tier } from '../rewards/catalog';
import type { Prize } from './engine';

// The tiers to offer from, in order, for each prize.
const FALLBACK: Record<Prize, Prize[]> = {
  common: ['common', 'rare', 'premium'],
  rare: ['rare', 'common', 'premium'],
  premium: ['premium', 'rare', 'common'],
};

// What a banked pot offers (engine.ts Prize): every reward of its tier the
// player doesn't own yet, to choose one of (PayoutScreen.tsx). A tier with
// nothing left offers from the nearest one that has something (premium falls
// back to rare, then common), and says which (`tier`); with nothing left at
// all the list is empty (the player has won everything there is).
//
// Rewards still coming soon (catalog.ts `soon`) are never offered, except in
// development builds, so the payout can be tried with a full catalog.

// The rewards the player could still be given.
export function unowned(owned: ReadonlySet<string>, includeSoon = __DEV__): Reward[] {
  return REWARDS.filter((r) => !owned.has(r.id) && (includeSoon || !r.soon));
}

export function prizes(prize: Prize, owned: ReadonlySet<string>, includeSoon = __DEV__): { tier: Tier; list: Reward[] } {
  const pool = unowned(owned, includeSoon);
  for (const tier of FALLBACK[prize]) {
    const list = pool.filter((r) => r.tier === tier);
    if (list.length) return { tier, list };
  }
  return { tier: prize, list: [] };
}
