import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUBBLE_MAX, KINDS, oneEach, rewardById, slotOf, type Kind } from './catalog';

// What this player has won (src/rewards/catalog.ts): the ids of the rewards
// they own; for each kind that is picked one at a time (a theme, a bubble),
// the one they chose; the outfits their pig has on, one per slot (a hat,
// sunglasses and a bow tie at once); the parts of themes they've put on their
// pig, and the parts of the showing theme they've taken off
// (src/avatar/themeParts.ts); and what their pig's speech bubble says. Read
// once at launch, before anything under the provider draws, so a chosen theme
// is known before the first frame; written through on every change, like the
// theme settings (src/theme/theme.tsx).
//
// It lives only on this phone (or in this browser): there are no accounts,
// so rewards don't follow a player to another device and go with the app's
// data. Fine for cosmetics. An id the catalog doesn't list (from a newer
// version of the app) is kept in storage but otherwise ignored.

const KEY = 'squigglepig.inventory';
const VERSION = 1; // saved with the data, for any future change of shape

// `parts` and `hidden` hold "<skin id>:<part>" (themeParts.ts parsePart). A
// part taken off one theme stays on another; `parts` has one per part.
type State = {
  owned: ReadonlySet<string>;
  chosen: Partial<Record<Kind, string>>;
  worn: string[];
  parts: string[];
  hidden: string[];
  bubbleText: string;
};

const EMPTY: State = { owned: new Set(), chosen: {}, worn: [], parts: [], hidden: [], bubbleText: '' };

const keyOf = (part: string) => part.slice(part.indexOf(':') + 1);

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
    // Saved before outfits had slots: the one chosen outfit is the one worn.
    const worn = Array.isArray(saved?.worn)
      ? oneEach(saved.worn.filter((id: unknown) => typeof id === 'string'))
      : chosen.outfit
        ? oneEach([chosen.outfit])
        : [];
    delete chosen.outfit;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && k.includes(':')) : []);
    const parts = strings(saved?.parts);
    const hidden = strings(saved?.hidden);
    const bubbleText = typeof saved?.bubbleText === 'string' ? cleanBubbleText(saved.bubbleText) : '';
    return { owned, chosen, worn, parts, hidden, bubbleText };
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
  // Outfits are worn rather than chosen: see `worn`.
  chosen: (kind: Kind) => string | null;
  // Choose an owned reward of a pick-one kind; null goes back to the default.
  // For an outfit, puts it on (wear); null takes them all off.
  choose: (kind: Kind, id: string | null) => void;
  // The outfits the pig has on, owned, one per slot, head first.
  worn: string[];
  // Put an owned outfit on, in place of whatever was in its slot, or take it off.
  wear: (id: string, on: boolean) => void;
  // Whether a reward is in use: its kind's chosen one, or an outfit worn.
  uses: (id: string) => boolean;
  // The theme parts on the pig in place of the showing theme's
  // (src/avatar/themeParts.ts), "<skin id>:<part>", one per part; and
  // wearing one (null wears none, back to the showing theme's). A theme's
  // hat or visor takes off an outfit in that slot, and the other way round.
  parts: string[];
  setPart: (key: string, skinId: string | null) => void;
  // The showing theme's parts taken off the pig, for the skin with this id,
  // and putting one back on or taking it off.
  hiddenFor: (skinId: string) => string[];
  showPart: (skinId: string, part: string, on: boolean) => void;
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
      JSON.stringify({
        v: VERSION,
        owned: [...next.owned],
        chosen: next.chosen,
        worn: next.worn,
        parts: next.parts,
        hidden: next.hidden,
        bubbleText: next.bubbleText,
      })
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

  const wear = useCallback(
    (id: string, on: boolean) => {
      const s = latest.current;
      const slot = slotOf(id);
      if (!slot || (on && !s.owned.has(id))) return;
      const rest = s.worn.filter((w) => w !== id && !(on && slotOf(w) === slot));
      // An outfit takes the place of a theme's part in its slot (a hat, a visor).
      const parts = on ? s.parts.filter((p) => keyOf(p) !== slot) : s.parts;
      commit({ ...s, worn: oneEach(on ? [id, ...rest] : rest), parts });
    },
    [commit]
  );

  const choose = useCallback(
    (kind: Kind, id: string | null) => {
      const s = latest.current;
      if (kind === 'outfit') {
        if (id) wear(id, true);
        else commit({ ...s, worn: [] });
        return;
      }
      if (KINDS[kind].pick !== 'one') return;
      if (id !== null && (rewardById(id)?.kind !== kind || !s.owned.has(id))) return;
      const chosen = { ...s.chosen };
      if (id) chosen[kind] = id;
      else delete chosen[kind];
      commit({ ...s, chosen });
    },
    [commit, wear]
  );

  const setPart = useCallback(
    (key: string, skinId: string | null) => {
      const s = latest.current;
      const parts = s.parts.filter((p) => keyOf(p) !== key);
      if (skinId) parts.push(`${skinId}:${key}`);
      const worn = skinId ? s.worn.filter((w) => slotOf(w) !== key) : s.worn;
      commit({ ...s, worn, parts });
    },
    [commit]
  );

  const showPart = useCallback(
    (skinId: string, part: string, on: boolean) => {
      const s = latest.current;
      const key = `${skinId}:${part}`;
      const hidden = s.hidden.filter((k) => k !== key);
      commit({ ...s, hidden: on ? hidden : [...hidden, key] });
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
      worn: state.worn.filter((id) => state.owned.has(id)),
      wear,
      uses: (id) => {
        const r = rewardById(id);
        if (!r || !state.owned.has(id)) return false;
        return r.kind === 'outfit' ? state.worn.includes(id) : state.chosen[r.kind] === id;
      },
      parts: state.parts,
      setPart,
      hiddenFor: (skinId) => state.hidden.filter((k) => k.startsWith(`${skinId}:`)).map((k) => k.slice(skinId.length + 1)),
      showPart,
      bubbleText: state.bubbleText,
      setBubbleText,
      reset,
    }),
    [state, grant, choose, wear, setPart, showPart, setBubbleText, reset]
  );

  return <Ctx.Provider value={value}>{loaded ? children : null}</Ctx.Provider>;
}

export function useInventory(): InventoryCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInventory needs an <InventoryProvider> above it');
  return ctx;
}
