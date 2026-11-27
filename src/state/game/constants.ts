// Timings for the live game on this phone. (The game's own clock, the one
// every player sees, is in src/lib/timers.ts.)

// A turn handed in that hasn't come back from the channel after this long is
// sent again, up to HAND_IN_TRIES times in all (turns.ts handIn).
export const HAND_IN_RETRY_MS = 4000;
export const HAND_IN_TRIES = 3;
// How long the judge's phone waits on an empty turn before marking it ✗, so a
// turn being sent again (mend) can land first (reveal.ts maybeAutoRule).
export const AUTO_RULE_MS = 2000;
// Catching up (sync.ts resync): asks for the game this often, and after this
// many asks with no answer picks it up from the server's copy instead (restore).
export const ASK_EVERY_MS = 2000;
export const ASK_TRIES = 3;
// Answering a phone that's catching up (sync.ts onRequestState): the keeper at
// once, the caught-up phones after it this far apart, in case it's gone quiet.
export const ANSWER_STAGGER_MS = 700;
// Back on screen (appState.ts checkConnection): how long a heartbeat has to be
// answered before the connection counts as dead.
export const PROBE_MS = 3000;
// The room's channel closed for good (channel.ts ensureChannel): a new one
// opens this long after, so a channel the server keeps closing (a token it
// won't take) is retried calmly rather than in a tight loop.
export const REOPEN_MS = 2000;

// Stand-ins for a prompt nobody wrote (its owner was away, or the clock ran
// out on them), so a chain never stalls for want of one.
export const FALLBACK_PROMPTS = [
  'a cat riding a skateboard',
  'the world’s angriest banana',
  'a robot falling in love',
  'a haunted sandwich',
  'a penguin on vacation',
  'a dragon who is afraid of fire',
];
