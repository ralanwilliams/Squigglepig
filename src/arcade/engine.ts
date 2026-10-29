// The rules of a solo run, shared by every mini-game (src/arcade/games):
// up to ROUNDS rounds, each with less time than the last. Every round won
// climbs the pot ladder. A win that reaches a new step of it (newTier) lets
// the player bank the pot or risk it on the next round; any other win goes
// on to the next round by itself, since there's nothing new to bank. A wrong
// answer, or running out of time, loses the pot. Winning the last round
// banks it automatically.
//
// Plain data and a reducer, no React: RunShell (RunShell.tsx) holds the state
// and draws each phase.

import type { Tier } from '../rewards/catalog';

export const ROUNDS = 10;

// Seconds for round n (1-based): 23 for the first, two fewer each round, never
// under 6. A game can set its own (games/index.ts Game.seconds).
export const roundSeconds = (n: number) => Math.max(6, 25 - 2 * n);

// What a banked pot pays: a reward of that tier (catalog.ts Tier; payout.ts).
// Premium, the top, is for winning every round.
export type Prize = Tier;

// The pot ladder: rounds won to reach each prize. Nothing can be banked below
// the first step.
export const LADDER: { won: number; prize: Prize; label: string }[] = [
  { won: 3, prize: 'common', label: 'Common' },
  { won: 6, prize: 'rare', label: 'Rare' },
  { won: ROUNDS, prize: 'premium', label: 'Premium' },
];

// The run's rules in a line each, the same for every game, for the intro
// under the game's own line (RunShell.tsx). A choice comes at every step
// short of the last, which banks itself.
export const RULES = [
  'Win rounds in a row to earn a prize.',
  `At ${LADDER.filter((s) => s.won < ROUNDS).map((s) => s.won).join(' and ')} wins, bank your prize or risk it for a bigger one.`,
  'Lose a round and you lose the pot.',
];

// The prize in the pot after `won` rounds won, if any.
export function prizeFor(won: number): Prize | null {
  let prize: Prize | null = null;
  for (const step of LADDER) if (won >= step.won) prize = step.prize;
  return prize;
}

// Whether winning the `won`th round reached a new step: the only time the
// pot can be banked.
export const newTier = (won: number) => LADDER.some((s) => s.won === won);

export type Run =
  | { phase: 'ready' } // the game's intro, before round 1
  | { phase: 'round'; round: number; until: number } // playing round `round` until `until` (epoch ms)
  // Won `won` rounds so far, the last one at `at` (epoch ms) with its clock
  // set to `until`. The round's screen stays up, its clock stopped where it
  // was answered: at a new tier until the player banks or keeps going, else
  // for a moment before the next round (RunShell.tsx).
  | { phase: 'between'; won: number; until: number; at: number }
  // The pot is gone, at `at` (epoch ms). A full-screen game's round stays up
  // under the news, its clock (set to `until`) stopped there
  // (games/index.ts Game.fullScreen).
  | { phase: 'lost'; won: number; timeout: boolean; detail?: string; until: number; at: number }
  | { phase: 'payout'; won: number; prize: Prize }; // banked: choose the prize

export type RunAction =
  | { type: 'start'; until: number } // into round 1
  | { type: 'result'; won: boolean; at: number; timeout?: boolean; detail?: string } // the round in play is over, at `at`
  | { type: 'next'; until: number } // keep going: into the next round
  | { type: 'bank' } // take what's in the pot
  | { type: 'restart' }; // back to the intro, for another run

export const START: Run = { phase: 'ready' };

export function runReducer(run: Run, action: RunAction): Run {
  switch (action.type) {
    case 'start':
      return run.phase === 'ready' ? { phase: 'round', round: 1, until: action.until } : run;
    case 'result': {
      // Only the round in play can end, once (a late timeout after an answer is ignored).
      if (run.phase !== 'round') return run;
      const won = run.round - 1;
      if (!action.won) return { phase: 'lost', won, timeout: !!action.timeout, detail: action.detail, until: run.until, at: action.at };
      if (run.round === ROUNDS) return { phase: 'payout', won: ROUNDS, prize: 'premium' };
      return { phase: 'between', won: run.round, until: run.until, at: action.at };
    }
    case 'next':
      return run.phase === 'between' ? { phase: 'round', round: run.won + 1, until: action.until } : run;
    case 'bank': {
      if (run.phase !== 'between') return run;
      const prize = prizeFor(run.won);
      return prize && newTier(run.won) ? { phase: 'payout', won: run.won, prize } : run;
    }
    case 'restart':
      return START;
  }
}
