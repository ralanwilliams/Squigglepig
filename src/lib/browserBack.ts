// Holding a browser's Back (src/lib/backGuard.ts). A browser has already moved
// by the time it says so, so the move is undone with nobody else (the router)
// hearing about either part of it, and the screen stays exactly as it was. Apart
// from React Native so it can be tested (tests/browser-back.test.ts).
//
// The router comes down the stack with history.go, and that lands here as the
// same popstate as the player pressing Back, often after the game's next screen
// has put Back on hold. So history.go is marked as the router's, and each entry
// is numbered as the router makes it, so that a move of any size or direction
// (Forward, a jump from the Back button's list) is undone exactly.
//
// The window's listeners are heard in the order they were added, capture or not
// (in Chrome), so this has to run before the router starts listening.
//
// A browser only says so for moves within the page as it was loaded. After a
// reload, Back to an entry from before it loads the page instead, with no chance
// to ask. That's the same as closing the tab: the player is only away, and the
// saved session takes them straight back into the room.

// The router's go lands well inside this (around 50ms in Firefox; its own wait is
// 100ms). It may never land, if there's nowhere to go, so it doesn't wait forever.
const ROUTER_MS = 1000;

export type BrowserWindow = {
  history: Pick<History, 'state' | 'pushState' | 'replaceState' | 'go'>;
  addEventListener(type: 'popstate', listener: (e: PopStateEvent) => void, capture: boolean): void;
};

// `held` is what to do about Back right now, if it's being held.
export function holdBrowserBack(win: BrowserWindow, held: () => (() => void) | null, now: () => number = Date.now) {
  const { history } = win;
  const pushState = history.pushState.bind(history);
  const replaceState = history.replaceState.bind(history);
  const go = history.go.bind(history);

  let here: number = history.state?.n ?? 0;
  history.pushState = (state, title, url) => pushState({ ...state, n: ++here }, title, url);
  history.replaceState = (state, title, url) => replaceState({ ...state, n: here }, title, url);

  let routerUntil = 0;
  history.go = (delta) => {
    routerUntil = now() + ROUTER_MS;
    go(delta);
  };

  let undoing = false;
  win.addEventListener(
    'popstate',
    (e) => {
      if (undoing) {
        undoing = false;
        e.stopImmediatePropagation();
        return;
      }
      const to = e.state?.n;
      if (typeof to !== 'number') return; // not one of the app's entries: nothing to measure
      const router = now() < routerUntil;
      routerUntil = 0;
      const onBack = router ? null : held();
      if (!onBack) {
        here = to;
        return;
      }
      e.stopImmediatePropagation();
      if (to !== here) {
        undoing = true;
        go(here - to);
      }
      onBack();
    },
    true
  );
}
