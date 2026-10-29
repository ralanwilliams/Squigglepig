import { requireOptionalNativeModule } from 'expo';

// The phone's own lock on one app, for the endless hunt's padlock
// (src/arcade/RunShell.tsx), from the app's native module ScreenPin
// (modules/screen-pin).
//
// Android: pinScreen asks Android to pin the app (it asks the person first,
// "Pin this app?"); pinned, the home button and switching apps do nothing
// until it's unpinned, with the phone's own gesture or unpinScreen. Needs no
// permission.
//
// iPhone: an app can't pin itself. Guided Access is the person's own
// (Settings › Accessibility › Guided Access, started with a triple-click of
// the side button); guidedAccessOn says whether it's on, so the game can
// suggest it.
//
// Where the module isn't there (the web, Expo Go) none of it does anything.
type ScreenPin = {
  pin(): void;
  unpin(): void;
  isPinned(): Promise<boolean>;
};

const native = requireOptionalNativeModule<ScreenPin>('ScreenPin');

export function pinScreen() {
  try {
    native?.pin();
  } catch {
    // Not pinned: the game's own lock still holds.
  }
}

export function unpinScreen() {
  try {
    native?.unpin();
  } catch {
    // Already unpinned (with the phone's own gesture).
  }
}

// iPhone: whether Guided Access is on now. Android: whether the app is pinned.
export async function guidedAccessOn(): Promise<boolean> {
  try {
    return (await native?.isPinned()) ?? false;
  } catch {
    return false;
  }
}

// Whether there's a native lock to be had at all (not on the web or in Expo Go).
export const canPin = !!native;
