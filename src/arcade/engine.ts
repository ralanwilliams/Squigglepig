// The rules of a solo run, shared by every mini-game (src/arcade/games):
// up to ROUNDS rounds, each with less time than the last. Every round won
// climbs the pot ladder. A win that reaches a new step of it (newTier) lets
// the player bank the pot or risk it on the next round; any other win goes
// on to the next round by itself, since there's nothing new to bank. Winning
// the last round banks it automatically.
//
// A run has LIVES in reserve. A lost round (a wrong answer, or out of time)
// uses one up, and the round is played again from the start (the same
// puzzle, or a fresh one of the same difficulty: games/index.ts
// Game.replay). A round lost with none left loses the pot.
//
// Plain data and a reducer, no React: RunShell (RunShell.tsx) holds the state
// and draws each phase.

import type { Tier } from '../rewards/catalog';

export const ROUNDS = 10;
export const LIVES = 2; // in reserve, for every game's run

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
  `You have ${LIVES} spare lives. Lose a round and you use one to try it again. Lose one with none left and you lose the pot.`,
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

// `lives` throughout is the lives left in reserve.
export type Run =
  | { phase: 'ready' } // the game's intro, before round 1
  // Playing round `round` until `until` (epoch ms); `attempt` counts its
  // goes, from 1, each a fresh start.
  | { phase: 'round'; round: number; until: number; lives: number; attempt: number }
  // Won `won` rounds so far, the last one at `at` (epoch ms) with its clock
  // set to `until`. The round's screen stays up, its clock stopped where it
  // was answered: at a new tier until the player banks or keeps going, else
  // for a moment before the next round (RunShell.tsx).
  | { phase: 'between'; won: number; until: number; at: number; lives: number; attempt: number }
  // Round `round` lost at `at` (epoch ms), wrong or out of time, and a life
  // in reserve used up for it: its screen stays up, its clock stopped,
  // before it's played again (RunShell.tsx).
  | { phase: 'missed'; round: number; timeout: boolean; detail?: string; until: number; at: number; lives: number; attempt: number }
  // The pot is gone, at `at` (epoch ms), a round lost with no lives left. A
  // full-screen game's round stays up under the news, its clock (set to
  // `until`) stopped there (games/index.ts Game.fullScreen).
  | { phase: 'lost'; won: number; timeout: boolean; detail?: string; until: number; at: number; lives: number; attempt: number }
  | { phase: 'payout'; won: number; prize: Prize }; // banked: choose the prize

export type RunAction =
  | { type: 'start'; until: number } // into round 1, with LIVES in reserve
  | { type: 'result'; won: boolean; at: number; timeout?: boolean; detail?: string } // the round in play is over, at `at`
  | { type: 'next'; until: number } // keep going: into the next round
  | { type: 'retry'; until: number } // a life used: the round again
  | { type: 'bank' } // take what's in the pot
  | { type: 'restart' }; // back to the intro, for another run

export const START: Run = { phase: 'ready' };

export function runReducer(run: Run, action: RunAction): Run {
  switch (action.type) {
    case 'start':
      return run.phase === 'ready' ? { phase: 'round', round: 1, until: action.until, lives: LIVES, attempt: 1 } : run;
    case 'result': {
      // Only the round in play can end, once (a late timeout after an answer is ignored).
      if (run.phase !== 'round') return run;
      const { round, until, lives, attempt } = run;
      const won = round - 1;
      const timeout = !!action.timeout;
      if (!action.won && lives > 0) {
        return { phase: 'missed', round, timeout, detail: action.detail, until, at: action.at, lives: lives - 1, attempt };
      }
      if (!action.won) return { phase: 'lost', won, timeout, detail: action.detail, until, at: action.at, lives, attempt };
      if (round === ROUNDS) return { phase: 'payout', won: ROUNDS, prize: 'premium' };
      return { phase: 'between', won: round, until, at: action.at, lives, attempt };
    }
    case 'next':
      return run.phase === 'between' ? { phase: 'round', round: run.won + 1, until: action.until, lives: run.lives, attempt: 1 } : run;
    case 'retry':
      return run.phase === 'missed' ? { phase: 'round', round: run.round, until: action.until, lives: run.lives, attempt: run.attempt + 1 } : run;
    case 'bank': {
      if (run.phase !== 'between') return run;
      const prize = prizeFor(run.won);
      return prize && newTier(run.won) ? { phase: 'payout', won: run.won, prize } : run;
    }
    case 'restart':
      return START;
  }
}
