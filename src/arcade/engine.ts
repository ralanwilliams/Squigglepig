// The rules of a solo run, shared by every mini-game (src/arcade/games):
// up to ROUNDS rounds, each with less time than the last. Every round won
// climbs the pot ladder; between rounds the player banks what's in the pot or
// risks it on the next round. A wrong answer, or running out of time, loses
// the pot. Winning the last round banks it automatically.
//
// Plain data and a reducer, no React: RunShell (RunShell.tsx) holds the state
// and draws each phase.

export const ROUNDS = 10;

// Seconds for round n (1-based): 23 for the first, two fewer each round, never
// under 6. A game can set its own (games/index.ts Game.seconds).
export const roundSeconds = (n: number) => Math.max(6, 25 - 2 * n);

// What a banked pot pays: a common reward, a rare one, or the pick of every
// reward the player doesn't own yet (payout.ts).
export type Prize = 'common' | 'rare' | 'any';

// The pot ladder: rounds won to reach each prize. Nothing can be banked below
// the first step.
export const LADDER: { won: number; prize: Prize; label: string }[] = [
  { won: 3, prize: 'common', label: 'Common' },
  { won: 6, prize: 'rare', label: 'Rare' },
  { won: ROUNDS, prize: 'any', label: 'Pick any' },
];

// The prize in the pot after `won` rounds won, if any.
export function prizeFor(won: number): Prize | null {
  let prize: Prize | null = null;
  for (const step of LADDER) if (won >= step.won) prize = step.prize;
  return prize;
}

// The next step up the ladder from `won`, if there is one.
export const nextStep = (won: number) => LADDER.find((s) => s.won > won) ?? null;

export type Run =
  | { phase: 'ready' } // the game's intro, before round 1
  | { phase: 'round'; round: number; until: number } // playing round `round` until `until` (epoch ms)
  // Won `won` rounds so far, the last one at `at` (epoch ms) with its clock
  // set to `until`: bank, or keep going. The round's screen stays up, its
  // clock stopped where it was answered.
  | { phase: 'between'; won: number; until: number; at: number }
  | { phase: 'lost'; won: number; timeout: boolean; detail?: string } // the pot is gone
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
      if (!action.won) return { phase: 'lost', won, timeout: !!action.timeout, detail: action.detail };
      if (run.round === ROUNDS) return { phase: 'payout', won: ROUNDS, prize: 'any' };
      return { phase: 'between', won: run.round, until: run.until, at: action.at };
    }
    case 'next':
      return run.phase === 'between' ? { phase: 'round', round: run.won + 1, until: action.until } : run;
    case 'bank': {
      if (run.phase !== 'between') return run;
      const prize = prizeFor(run.won);
      return prize ? { phase: 'payout', won: run.won, prize } : run;
    }
    case 'restart':
      return START;
  }
}
