// Per-stage timer durations (seconds). Tuned for a fast, snappy party game.
// Every screen and the host's authoritative clock read from here.
export const TIMERS = {
  prompt: 30, // each round's start: write the prompt your chain starts from
  draw: 60, // illustrate the prompt / caption you were handed
  caption: 45, // caption the drawing you were handed
  reveal: 60, // per-chain: how long the judge has to rule before auto-skip
};

// The keeper of the game's clock waits this many extra seconds past a stage
// deadline before force-advancing, so a player's last-second (or
// auto-submitted) input still lands.
export const HOST_GRACE = 2;

// When a chain comes up at the reveal and its owner is away, the reveal waits
// this many seconds for them (they're sent a notification) before someone
// else judges it in their place.
export const JUDGE_WAIT = 15;

// The clock's backup (GameContext): when the game is this many seconds past
// due to move on and hasn't, a phone that isn't keeping the clock moves it on
// itself, the next phone in line BACKUP_STAGGER seconds after that one.
export const BACKUP_AFTER = 5;
export const BACKUP_STAGGER = 2;

// The countdown turns red/urgent at or below this many seconds remaining.
export const URGENT_AT = 10;
