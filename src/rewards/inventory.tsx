import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUBBLE_MAX, KINDS, rewardById, type Kind } from './catalog';

// What this player has won (src/rewards/catalog.ts): the ids of the rewards
// they own; for each kind that is picked one at a time (a theme, an outfit),
// the one they chose; and what their pig's speech bubble says. Read once at
// launch, before anything under the
// provider draws, so a chosen theme is known before the first frame; written
// through on every change, like the theme settings (src/theme/theme.tsx).
//
// It lives only on this phone (or in this browser): there are no accounts,
// so rewards don't follow a player to another device and go with the app's
// data. Fine for cosmetics. An id the catalog doesn't list (from a newer
// version of the app) is kept in storage but otherwise ignored.

const KEY = 'squigglepig.inventory';
const VERSION = 1; // saved with the data, for any future change of shape

type State = { owned: ReadonlySet<string>; chosen: Partial<Record<Kind, string>>; bubbleText: string };

const EMPTY: State = { owned: new Set(), chosen: {}, bubbleText: '' };

// Speech-bubble words as the scoreboard will show them: one line, no runs of
// spaces, at most BUBBLE_MAX characters (counted as the player sees them, so
// an emoji is one).
export function cleanBubbleText(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, BUBBLE_MAX).join('').trim();
}

// The saved value, read defensively: on the web anyone can edit it.
function parse(raw: string | null): State {
  if (!raw) return EMPTY;
  try {
    const saved = JSON.parse(raw);
    const owned = new Set<string>(Array.isArray(saved?.owned) ? saved.owned.filter((id: unknown) => typeof id === 'string') : []);
    const chosen: State['chosen'] = {};
    if (saved?.chosen && typeof saved.chosen === 'object') {
      for (const [kind, id] of Object.entries(saved.chosen)) if (typeof id === 'string') chosen[kind as Kind] = id;
    }
    const bubbleText = typeof saved?.bubbleText === 'string' ? cleanBubbleText(saved.bubbleText) : '';
    return { owned, chosen, bubbleText };
  } catch {
    return EMPTY;
  }
}

type InventoryCtx = {
  owned: ReadonlySet<string>;
  owns: (id: string) => boolean;
  // Give the player a reward. False if they already had it or the catalog
  // doesn't know the id.
  grant: (id: string) => boolean;
  // The reward chosen for a pick-one kind, if the player still owns it.
  chosen: (kind: Kind) => string | null;
  // Choose an owned reward of a pick-one kind; null goes back to the default.
  choose: (kind: Kind, id: string | null) => void;
  // What the pig's speech bubble says (cleaned: see cleanBubbleText). Kept
  // even while no bubble is chosen, so switching bubbles keeps the words.
  bubbleText: string;
  setBubbleText: (text: string) => void;
  // Forget everything (the Rewards screen offers it in development builds).
  reset: () => void;
};

const Ctx = createContext<InventoryCtx | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  // The newest state, so several changes in one tick build on each other.
  const latest = useRef(state);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        latest.current = parse(raw);
        setState(latest.current);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const commit = useCallback((next: State) => {
    latest.current = next;
    setState(next);
    AsyncStorage.setItem(
      KEY,
      JSON.stringify({ v: VERSION, owned: [...next.owned], chosen: next.chosen, bubbleText: next.bubbleText })
    ).catch(() => {});
  }, []);

  const grant = useCallback(
    (id: string) => {
      const s = latest.current;
      if (s.owned.has(id) || !rewardById(id)) return false;
      commit({ ...s, owned: new Set(s.owned).add(id) });
      return true;
    },
    [commit]
  );

  const choose = useCallback(
    (kind: Kind, id: string | null) => {
      const s = latest.current;
      if (KINDS[kind].pick !== 'one') return;
      if (id !== null && (rewardById(id)?.kind !== kind || !s.owned.has(id))) return;
      const chosen = { ...s.chosen };
      if (id) chosen[kind] = id;
      else delete chosen[kind];
      commit({ ...s, chosen });
    },
    [commit]
  );

  const setBubbleText = useCallback(
    (text: string) => {
      const s = latest.current;
      const bubbleText = cleanBubbleText(text);
      if (bubbleText !== s.bubbleText) commit({ ...s, bubbleText });
    },
    [commit]
  );

  const reset = useCallback(() => commit(EMPTY), [commit]);

  const value = useMemo<InventoryCtx>(
    () => ({
      owned: state.owned,
      owns: (id) => state.owned.has(id),
      grant,
      chosen: (kind) => {
        const id = state.chosen[kind];
        return id && state.owned.has(id) && rewardById(id) ? id : null;
      },
      choose,
      bubbleText: state.bubbleText,
      setBubbleText,
      reset,
    }),
    [state, grant, choose, setBubbleText, reset]
  );

  return <Ctx.Provider value={value}>{loaded ? children : null}</Ctx.Provider>;
}

export function useInventory(): InventoryCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInventory needs an <InventoryProvider> above it');
  return ctx;
}
