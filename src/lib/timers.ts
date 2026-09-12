// Per-stage timer durations (seconds). Tuned for a fast, snappy party game.
// Every screen and the host's authoritative clock read from here.
export const TIMERS = {
  prompts: 120, // everyone fills the shared prompt pool up to the target count
  view: 20, // Round 1: read the prompt for the chain you own + will judge
  draw: 60, // illustrate the prompt / caption you were handed
  caption: 45, // caption the drawing you were handed
  reveal: 60, // per-chain: how long the judge has to rule before auto-skip
};

// The host waits this many extra seconds past a stage deadline before force-
// advancing, so a player's last-second (or auto-submitted) input still lands.
export const HOST_GRACE = 2;

// The countdown turns red/urgent at or below this many seconds remaining.
export const URGENT_AT = 10;
