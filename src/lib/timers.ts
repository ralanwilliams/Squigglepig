// Dev builds only: EXPO_PUBLIC_DEV_TIMER_SCALE=0.25 (set where Metro starts)
// runs every game clock below at a quarter of its length, to play whole
// games quickly when testing. Every phone served by the same Metro gets the
// same value, so their clocks agree. Release builds always use 1.
const SCALE = typeof __DEV__ !== 'undefined' && __DEV__ ? Number(process.env.EXPO_PUBLIC_DEV_TIMER_SCALE) || 1 : 1;
const scaled = (seconds: number, min = 2) => (SCALE === 1 ? seconds : Math.max(min, Math.round(seconds * SCALE)));

// Per-stage timer durations (seconds). Tuned for a fast, snappy party game.
// Every screen and the host's authoritative clock read from here.
export const TIMERS = {
  prompt: scaled(30), // each round's start: write the prompt your chain starts from
  draw: scaled(60), // illustrate the prompt / caption you were handed
  caption: scaled(45), // caption the drawing you were handed
  reveal: scaled(60), // per-chain: how long the judge has to rule before auto-skip
};

// A Pig Off (src/state/rules.ts), in seconds: the announcement (shorter for
// a second go), the drawing shown, the drawing from memory, and the results.
export const PIG_OFF = {
  intro: scaled(8, 3),
  again: scaled(5, 3),
  flash: 3, // as the solo game's first round (src/arcade/games/memory)
  draw: scaled(20, 5),
  results: scaled(9, 4),
};
// From an attempt's start to its drawing time running out.
export const pigOffIntro = (attempt: number) => (attempt > 1 ? PIG_OFF.again : PIG_OFF.intro);
export const pigOffTime = (attempt: number) => pigOffIntro(attempt) + PIG_OFF.flash + PIG_OFF.draw;

// The keeper of the game's clock waits this many extra seconds past a stage
// deadline before force-advancing, so a player's last-second (or
// auto-submitted) input still lands.
export const HOST_GRACE = 2;

// When a chain comes up at the reveal and its owner is away, the reveal waits
// this many seconds for them (they're sent a notification) before someone
// else judges it in their place.
export const JUDGE_WAIT = scaled(15, 4);

// The clock's backup (state/game/clock.ts): when the game is this many seconds past
// due to move on and hasn't, a phone that isn't keeping the clock moves it on
// itself, the next phone in line BACKUP_STAGGER seconds after that one.
export const BACKUP_AFTER = 5;
export const BACKUP_STAGGER = 2;

// The countdown turns red/urgent at or below this many seconds remaining.
export const URGENT_AT = 10;
