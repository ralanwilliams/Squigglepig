import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { SOUNDS } from '../assets/assets';

// Sound effects. One long-lived player per clip, created on first use (or up
// front by preloadSounds) and kept for the life of the app: playing a sound is
// a seek-to-start and play on an already-loaded player, so it fires at once
// and nothing is allocated per tap. The previous version built a fresh native
// player for every call and relied on a "finished" event to tear it down —
// slow to start, and a leak whenever that event never came.
//
// Sound is a non-critical enhancement: failures are logged, never thrown.

const players = new Map<number, AudioPlayer>();

// Short clips mix with whatever else is playing (a podcast, Spotify) rather
// than ducking or silencing it; a party game's grunt is not worth interrupting
// someone's music for. Also plays through the iOS silent switch.
setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch((e) =>
  console.warn('sound: audio mode not set', e),
);

function player(mod: number): AudioPlayer {
  let p = players.get(mod);
  if (!p) {
    p = createAudioPlayer(mod);
    players.set(mod, p);
  }
  return p;
}

// Create every player now so the first tap of a session is not the one that
// waits for the file to load. Call once at app start.
export function preloadSounds() {
  try {
    for (const mod of Object.values(SOUNDS)) player(mod);
  } catch (e) {
    console.warn('sound: preload failed', e);
  }
}

// Play a clip from the start. A clip already playing restarts.
export function playSound(mod: number, volume = 0.3) {
  try {
    const p = player(mod);
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch (e) {
    console.warn('sound: play failed', e);
  }
}

// The theme: looping background music for the screens before play starts
// (app/_layout.tsx decides which). Moving between those screens keeps it
// going rather than restarting it. Starts and stops are faded — expo-audio
// has no native ramp, so the volume is stepped from JS — and a stop rewinds
// so the next start is from the top.
export const MUSIC_FADE_MS = 800;
const MUSIC_VOLUME = 0.3;
const FADE_STEP_MS = 40;

let fade: ReturnType<typeof setInterval> | null = null;
let fadingTo: number | null = null; // target volume of the ramp in progress

// Ramp the theme's volume to `to`, then run `done`. A ramp already in
// progress is replaced, so a start during a fade-out simply turns around.
function rampMusic(p: AudioPlayer, to: number, done?: () => void) {
  if (fade) clearInterval(fade);
  fadingTo = to;
  const from = p.volume;
  const steps = Math.max(1, Math.round(MUSIC_FADE_MS / FADE_STEP_MS));
  let i = 0;
  fade = setInterval(() => {
    i += 1;
    p.volume = from + ((to - from) * i) / steps;
    if (i >= steps) {
      clearInterval(fade!);
      fade = null;
      fadingTo = null;
      done?.();
    }
  }, FADE_STEP_MS);
}

export function playMusic() {
  try {
    const p = player(SOUNDS.theme);
    p.loop = true;
    if (p.playing && fadingTo === null) return; // already on and steady
    if (!p.playing) {
      p.volume = 0;
      p.play();
    }
    rampMusic(p, MUSIC_VOLUME);
  } catch (e) {
    console.warn('sound: music start failed', e);
  }
}

// Fade out and stop. Does nothing when the theme is already off or already
// fading out, so several triggers can race for it (the pool filling, then the
// route change a moment later).
export function stopMusic() {
  try {
    const p = players.get(SOUNDS.theme);
    if (!p || !p.playing || fadingTo === 0) return;
    rampMusic(p, 0, () => {
      p.pause();
      p.seekTo(0).catch(() => {});
    });
  } catch (e) {
    console.warn('sound: music stop failed', e);
  }
}
