// Per-stage timer durations (seconds). Tuned for a fast, snappy party game.
// Every screen and the host's authoritative clock read from here.
export const TIMERS = {
  prompt: 30, // filling the trough: this long for each prompt it needs (promptsTime)
  view: 20, // Round 1: read the prompt for the chain you own + will judge
  draw: 60, // illustrate the prompt / caption you were handed
  caption: 45, // caption the drawing you were handed
  reveal: 60, // per-chain: how long the judge has to rule before auto-skip
};

// How long everyone has to fill the trough: TIMERS.prompt for each prompt it
// needs (GameContext promptsNeededFor, the number under the trough). The game
// starts the moment the trough is full, so this is only the most it can take:
// 3 players playing to 5 points need 9 prompts (4:30), 4 players 8 (4:00),
// 12 players 12 (6:00).
export const promptsTime = (needed: number) => needed * TIMERS.prompt;

// The host waits this many extra seconds past a stage deadline before force-
// advancing, so a player's last-second (or auto-submitted) input still lands.
export const HOST_GRACE = 2;

// The countdown turns red/urgent at or below this many seconds remaining.
export const URGENT_AT = 10;
