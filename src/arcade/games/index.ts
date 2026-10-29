import type React from 'react';
import type { GlyphName } from '../../components/Glyph';
import { bigger } from './bigger';
import { memory } from './memory';
import { pigpen } from './pigpen';
import { trivia } from './trivia';
import { truffles } from './truffles';

// Every solo mini-game. A game supplies only what's its own: its rounds. The
// run around them (the timer, the round count, the pot, banking, the payout)
// is RunShell's (src/arcade/RunShell.tsx), the same for every game.
//
// To add a game, give it a folder beside trivia/ exporting a Game, and list it
// in GAMES. The Solo button on Home and the game list (app/arcade) show
// whatever is playable here; a `dev` game shows in development builds only.

// What a round is drawn into: Stage's two panes, with the timer, round count
// and pot added by the run. `focus` is the art pane (the question, the
// picture), `controls` the rail (the answers). `fitFocus` scales a focus that
// can grow too tall, as Stage's does. `onExpire`, if given, is called when the
// clock runs out instead of the round being lost on time: the round settles
// itself (calls onResult), as a drawing is scored on what's there.
// `stoppedAt` (epoch ms) stops the clock there, for a round that's been
// answered but is still showing how it went before it calls onResult.
export type Frame = (props: {
  focus: React.ReactNode;
  controls?: React.ReactNode;
  fitFocus?: boolean;
  onExpire?: () => void;
  stoppedAt?: number;
}) => React.ReactElement;

export type RoundProps<S> = {
  spec: S; // this round's puzzle, from makeRun
  round: number; // 1-based
  // The round is over: right or wrong. `detail` is shown when it was wrong
  // ("The answer was Paris"); `timedOut` when it was lost on time, for a game
  // that settles its own clock (Frame onExpire). Only the first call counts.
  onResult: (won: boolean, detail?: string, timedOut?: boolean) => void;
  Frame: Frame;
  // Set once the round is over and its screen is staying up: won, under the
  // choice to keep going or bank it, or lost, under the news. `at` is when
  // (epoch ms). A round stops taking input then.
  ended?: { won: boolean; at: number };
  // Set while a full-screen game's round counts in (RoundCountdown.tsx): the
  // field is under a curtain and its clock hasn't started. Take no input.
  held?: boolean;
};

export type Game<S = unknown> = {
  id: string; // in the URL: /arcade/<id>
  label: string;
  glyph: GlyphName;
  blurb: string; // one line on the intro screen: what you do each round
  // Every round's puzzle for one run, ROUNDS of them, hardest last. May load
  // (a question list); the intro waits for it.
  makeRun: () => S[] | Promise<S[]>;
  Round: React.ComponentType<RoundProps<S>>;
  // Seconds for round n (1-based), for a game whose rounds need longer than
  // the engine's roundSeconds.
  seconds?: (round: number) => number;
  // The round fills the screen (FieldFrame.tsx) instead of Stage's two panes:
  // `focus` is drawn edge to edge, the run's clock, pot and Leave float over
  // it with the game's `controls`, each round counts in (3, 2, 1, Go!) before
  // its clock starts, and the end of the round, won or lost, comes up on it
  // rather than on a screen of its own.
  fullScreen?: true;
  // An endless hunt of the game's own, switched on from a round's pot ladder
  // slider (RunShell.tsx): levels with no clock and no prizes that never
  // end. Level n's puzzle (from 1) at difficulty d (0 … 4, easiest first:
  // DifficultyMeter.tsx DIFFICULTIES). A full-screen game's only.
  endless?: (level: number, difficulty: number) => S;
  dev?: true; // a test game, for development builds only
};

export const GAMES: Game<any>[] = [trivia, memory, truffles, pigpen, bigger];

// The games this build offers.
export const PLAYABLE = GAMES.filter((g) => __DEV__ || !g.dev);

export const gameById = (id: string | undefined) => PLAYABLE.find((g) => g.id === id);
