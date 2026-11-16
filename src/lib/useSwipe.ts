import { useMemo, useRef } from 'react';
import { PanResponder, type GestureResponderHandlers } from 'react-native';

// A sideways swipe on whatever view is handed these handlers: left for the
// next thing, right for the one before. It only takes over a stroke that is
// clearly sideways, so taps and up-and-down scrolls under it carry on as
// usual. The walkthrough's steps and SwipePager's pages.
const START = 16; // how far sideways before it's a swipe at all
const FAR = 48; // how far it has to have gone, let go, to count

export function useSwipe(onNext: () => void, onPrev: () => void): GestureResponderHandlers {
  // The latest callbacks, without rebuilding the responder each render.
  const fns = useRef({ onNext, onPrev });
  fns.current = { onNext, onPrev };
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > START && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx < -FAR) fns.current.onNext();
          else if (g.dx > FAR) fns.current.onPrev();
        },
      }).panHandlers,
    []
  );
}
