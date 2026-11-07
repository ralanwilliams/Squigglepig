import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Whether this install has finished (or skipped) the first-run walkthrough
// (src/components/Walkthrough.tsx). Until it has, Home opens the walkthrough on
// every launch. The flag lives in app storage, so an app update keeps it and
// only uninstalling (or clearing the app's data) brings the walkthrough back.
const KEY = 'squigglepig.tutorial.done';

export async function tutorialDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true; // storage unavailable: don't trap the player in the walkthrough
  }
}

export function markTutorialDone() {
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}

// Whether the walkthrough is open now. There's one for the whole app
// (WalkthroughOverlay, mounted once in the root layout): Home opens it on a
// first launch, and the menu's "How to play" row (MenuDrawer.tsx) from any
// screen with the menu. Kept here, not with the walkthrough, so the menu can
// open it without importing the screen layout it's drawn on.
let open = false;
const watchers = new Set<() => void>();
function setOpen(on: boolean) {
  if (on === open) return;
  open = on;
  watchers.forEach((w) => w());
}
const watch = (w: () => void) => {
  watchers.add(w);
  return () => {
    watchers.delete(w);
  };
};
export const showWalkthrough = () => setOpen(true);
export const closeWalkthrough = () => setOpen(false);
export const useWalkthroughOpen = () => useSyncExternalStore(watch, () => open);
