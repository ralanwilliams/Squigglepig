import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { holdBrowserBack, type BrowserWindow } from '../src/lib/browserBack';

// A browser's history, as far as the guard can see it: entries in a list, and
// moves that land later (as popstate), the way a real one's do. A listener added
// after the guard's stands in for the router.
function browser() {
  const entries: unknown[] = [{ id: 'first' }];
  let at = 0;
  const pending: number[] = [];
  const listeners: ((e: PopStateEvent) => void)[] = [];
  const history = {
    get state() {
      return entries[at];
    },
    pushState(state: unknown) {
      entries.length = ++at;
      entries.push(state);
    },
    replaceState(state: unknown) {
      entries[at] = state;
    },
    go(delta: number) {
      pending.push(delta);
    },
  };
  const win = {
    history,
    addEventListener(_: 'popstate', listener: (e: PopStateEvent) => void) {
      listeners.push(listener);
    },
  } as unknown as BrowserWindow;
  // Moves `delta` and tells the listeners, until one of them stops it.
  const land = (delta: number) => {
    at += delta;
    let stopped = false;
    const e = { state: entries[at], stopImmediatePropagation: () => (stopped = true) } as unknown as PopStateEvent;
    for (const l of listeners) {
      l(e);
      if (stopped) break;
    }
  };
  // Everything that has been asked for lands.
  const settle = () => {
    while (pending.length) land(pending.shift()!);
  };
  // What's on the current entry, written behind the guard's back.
  const raw = (state: unknown) => {
    entries[at] = state;
  };
  return { win, history: win.history, land, settle, raw, at: () => at, listeners };
}

// The guard set up over a browser on home, then `n` entries pushed over it.
function setup(pushes = 1) {
  const b = browser();
  let guard: (() => void) | null = null;
  let asked = 0;
  let clock = 1000;
  holdBrowserBack(b.win, () => guard, () => clock);
  let routerHeard = 0;
  b.listeners.push(() => routerHeard++);
  b.history.replaceState({ id: 'home' }, '');
  for (let i = 1; i <= pushes; i++) b.history.pushState({ id: `screen${i}` }, '');
  return {
    ...b,
    hold: () => (guard = () => asked++),
    release: () => (guard = null),
    tick: (ms: number) => (clock += ms),
    asked: () => asked,
    routerHeard: () => routerHeard,
  };
}

describe('Back held in a browser', () => {
  test('a press asks, and the browser goes back to where it was with the router none the wiser', () => {
    const t = setup();
    t.hold();
    t.land(-1);
    assert.equal(t.asked(), 1);
    t.settle();
    assert.equal(t.at(), 1);
    assert.equal(t.routerHeard(), 0);
  });
  test('not held, the router hears it', () => {
    const t = setup();
    t.land(-1);
    assert.equal(t.asked(), 0);
    assert.equal(t.routerHeard(), 1);
    assert.equal(t.at(), 0);
  });
  test('asks every time', () => {
    const t = setup();
    t.hold();
    t.land(-1);
    t.settle();
    t.land(-1);
    t.settle();
    assert.equal(t.asked(), 2);
    assert.equal(t.at(), 1);
  });
});

describe("the router's own moves", () => {
  // Bug: a game starting during a solo game. The router comes down the stack
  // with history.go, and the game's screen puts Back on hold before it lands.
  test('one that lands after Back went on hold is let through, unasked', () => {
    const t = setup(2);
    t.history.go(-1);
    t.hold();
    t.settle();
    assert.equal(t.asked(), 0);
    assert.equal(t.routerHeard(), 1);
    assert.equal(t.at(), 1);
  });
  test('the very next press is still held', () => {
    const t = setup(2);
    t.history.go(-1);
    t.hold();
    t.settle();
    t.land(-1);
    assert.equal(t.asked(), 1);
    t.settle();
    assert.equal(t.at(), 1);
  });
  test('one that never lands (nowhere to go) only holds off a press for a moment', () => {
    const t = setup();
    t.history.go(-5); // and it never lands
    t.hold();
    t.tick(5000);
    t.land(-1);
    assert.equal(t.asked(), 1);
  });
});

describe('moves other than one step back', () => {
  // Bug: a rehome leaves an entry ahead of the game. Forward was undone with
  // another forward, and a jump back by just one step.
  test('Forward is undone by going back', () => {
    const t = setup(2);
    t.history.go(-1);
    t.settle();
    t.hold();
    t.land(1);
    assert.equal(t.asked(), 1);
    t.settle();
    assert.equal(t.at(), 1);
    assert.equal(t.routerHeard(), 1); // only the router's own move
  });
  test('a jump of several is undone exactly', () => {
    const t = setup(3);
    t.hold();
    t.land(-3);
    assert.equal(t.asked(), 1);
    t.settle();
    assert.equal(t.at(), 3);
  });
  test('after a move let through, it still measures from the right place', () => {
    const t = setup(3);
    t.land(-1); // not held: the router goes back a screen
    t.hold();
    t.land(-1);
    t.settle();
    assert.equal(t.at(), 2);
  });
  test('an entry with no number (not made through the router) is left alone', () => {
    const t = setup();
    t.hold();
    t.raw({ id: 'not ours' });
    t.land(0);
    assert.equal(t.asked(), 0);
    assert.equal(t.routerHeard(), 1);
  });
});
