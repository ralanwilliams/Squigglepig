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
  title?: string; // heads a lost round's full-screen card ("Out of time!")
  lines: string[];
  actions: { name: string; onPress: () => void }[];
};

export type RoundCtxValue = {
  round: number;
  seconds: number;
  until: number;
  expire: () => void;
  leave: () => void;
  settled?: Settled;
};

export const RoundCtx = createContext<RoundCtxValue | null>(null);
