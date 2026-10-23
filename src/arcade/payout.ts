import { REWARDS, type Reward } from '../rewards/catalog';
import type { Prize } from './engine';

// What a banked pot offers (engine.ts Prize). A common or rare prize offers up
// to OFFER rewards of that tier, picked at random from the ones the player
// doesn't own yet, to choose one of; the top prize ('any') offers every reward
// they don't own. A tier with nothing left offers from the other tier
// instead; with nothing left at all the list is empty (the player has won
// everything there is).
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
  if (prize === 'any') return pool;
  const tier = pool.filter((r) => r.tier === prize);
  return shuffle(tier.length ? tier : pool, rand).slice(0, OFFER);
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
