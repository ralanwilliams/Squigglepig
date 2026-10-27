// A small seeded random number generator (mulberry32): the same seed gives
// the same numbers, so a round's field is the same every time it's drawn (a
// turned phone draws it again) and a run's rounds are settled when it starts.
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
