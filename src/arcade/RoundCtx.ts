import { createContext } from 'react';

// How a round's frame (RoundFrame in RunShell.tsx, or FieldFrame.tsx for a
// full-screen game) reaches the run around it. RunShell provides it; a frame
// is a component of its own rather than one made inside RunShell, so it keeps
// its identity from render to render and the round's content isn't remounted.

// The end of a round whose screen stays up: as data, so each frame draws it
// its own way (Stage's headings and buttons, or the full-screen card).
export type Settled = {
  at: number; // when the round ended (epoch ms): the clock stops there
  lost: boolean;
  title?: string; // heads a lost round's card ("Out of time!")
  lines: string[];
  actions: { name: string; onPress: () => void }[];
};

export type RoundCtxValue = {
  round: number;
  seconds: number;
  until: number;
  // When a full-screen game's round starts (epoch ms), after its count in
  // (RoundCountdown.tsx); its clock waits until then. Unset on Stage.
  startsAt?: number;
  expire: () => void;
  leave: () => void;
  settled?: Settled;
  // A game with an endless hunt of its own (Game.endless): in a run, the way
  // into it, on the pot ladder slider; in it, the hunt.
  toEndless?: () => void;
  endless?: Endless;
};

// The endless hunt (RunShell.tsx): no clock and no prizes, the level in
// place of the clock, the difficulty and play time in place of the slider,
// and the lock.
export type Endless = {
  level: number;
  difficulty: number; // DifficultyMeter.tsx DIFFICULTIES
  setDifficulty: (d: number) => void; // deals the level again
  playTime: number; // minutes, 0 for no limit (FieldFrame.tsx PLAY_TIMES)
  setPlayTime: (minutes: number) => void; // counted from now
  restAt?: number; // when the play time is up (epoch ms)
  // Once it's up, the piggy's rest: 'up', and then the game ends. If it was
  // locked then, going back into the game finds it 'still' (resting), locked,
  // until it's unlocked.
  rest?: 'up' | 'still';
  back: () => void; // to a run of the game, from round 1
  game: string; // its name, for the way back
  locked: boolean;
  lock: () => void;
  unlock: () => void;
};

export const RoundCtx = createContext<RoundCtxValue | null>(null);
