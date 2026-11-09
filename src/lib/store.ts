import { useSyncExternalStore } from 'react';

// A value kept outside React, for what's set from anywhere and shown by one
// component mounted once (a question, what Back does): the value, a way to
// change it, and a hook that redraws whoever is watching it.
export function createStore<T>(initial: T) {
  let value = initial;
  const watchers = new Set<() => void>();
  const watch = (w: () => void) => {
    watchers.add(w);
    return () => {
      watchers.delete(w);
    };
  };
  return {
    get: () => value,
    set(next: T) {
      if (next === value) return;
      value = next;
      watchers.forEach((w) => w());
    },
    useValue: () => useSyncExternalStore(watch, () => value),
  };
}
