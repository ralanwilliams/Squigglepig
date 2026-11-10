import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useIsFocused, useNavigation } from 'expo-router';
import { holdBrowserBack } from './browserBack';
import { closeConfirm } from './confirm';
import { createStore } from './store';

// What Back does while a game is on: it doesn't go back, it calls `onBack`,
// which asks first (src/lib/confirm.ts). One hook for every way a phone has of
// going back:
//
//   Android's back button or gesture   BackHandler
//   the swipe from the left edge on    the screen's own swipe is off
//     an iPhone or iPad                (gestureEnabled), BackSwipe.tsx stands in
//   a browser's Back                   popstate (./browserBack)
//
// It holds Back rather than blocking the navigator (usePreventRemove), which
// would stop the game moving the player on between turns too, and on an iPhone
// would slide the screen away before putting it back.
//
// The system's Home and app switcher can't be held by any app, on either
// platform, and don't need to be: the player is only away, and opening the app
// takes them straight back into the game.

const guard = createStore<(() => void) | null>(null);

export const useBackHeld = () => guard.useValue() !== null;
export const pressBack = () => guard.get()?.();

// As this file loads, ahead of the router, which only starts listening once the
// app has rendered. (The web build is one bundle, so nothing here loads late:
// asyncRoutes in app.json.)
if (Platform.OS === 'web' && typeof window !== 'undefined') holdBrowserBack(window, guard.get);

// While `on`, Back calls `onBack`. There's one guard at a time; the screens that
// use it can't be on show together. A question already up goes when the guard
// comes on (Leave game in the lobby, as the game starts: what it said leaving
// costs no longer holds) and when it comes off (the game ended, say).
export function useBackGuard(on: boolean, onBack: () => void) {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!on) return;
    const mine = () => latest.current();
    closeConfirm();
    guard.set(mine);
    // Added now, so it's heard ahead of the router's own (last in, first asked).
    const button = BackHandler.addEventListener('hardwareBackPress', () => {
      if (guard.get() !== mine) return false;
      mine();
      return true;
    });
    return () => {
      button.remove();
      if (guard.get() === mine) guard.set(null);
      closeConfirm();
    };
  }, [on]);
}

// The same for a screen that's otherwise free to swipe back from (a solo game):
// only while it's the one showing, with its swipe off for as long as it's on.
export function useScreenBackGuard(on: boolean, onBack: () => void) {
  const navigation = useNavigation();
  const focused = useIsFocused();
  useBackGuard(on && focused, onBack);
  useEffect(() => {
    if (!on) return;
    navigation.setOptions({ gestureEnabled: false });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [on]);
}
