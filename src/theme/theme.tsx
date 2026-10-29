import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, View, useColorScheme, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Defs, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type Theme } from './tokens';
import { UNLOCKABLE, dayKey, paletteFor, seasonEnd, skinFor, type Birthday, type Skin } from './skins';
import { BIRTHDAYS_KEY, fetchBirthdays, parseBirthdays } from '../lib/birthdays';
import { useInventory } from '../rewards/inventory';

// Which palette the app shows. 'system' follows the device setting (app.json
// sets userInterfaceStyle "automatic" so we're told about it); the in-app
// toggle pins 'light' or 'dark', and that choice survives restarts.
export type ThemeMode = 'system' | 'light' | 'dark';
type ThemeName = 'light' | 'dark';

// Two accessibility settings sit beside it, each following an OS setting until
// the player pins it from the menu (src/components/MenuDrawer.tsx):
//   contrast — the high-contrast palettes (iOS "Increase Contrast", Android
//              "High contrast text", a browser's prefers-contrast: more);
//   motion   — Reduce motion: the theme flips without the wipe, and the
//              walkthrough, toggle glyph and trough rest on still frames.
// A third, `seasonal`, is the app's own: the seasonal skin (src/theme/skins),
// a birthday or holiday, shows by date unless the player turns it off. It is
// on by default, and has a switch in two places: there, and beside the theme
// cards on the Rewards screen's Themes tab (app/rewards.tsx).
//
// The skin showing is, first to last: a birthday or holiday (while Seasonal
// themes is on), else the theme the player chose from what they've won (the
// inventory, src/rewards/inventory.tsx), else classic. Choosing a theme puts
// it on at once, over the birthday or holiday on now (`pinChoice`): it stays
// until that one ends, so the next one shows, and once that's over the
// chosen theme is back.
export type ContrastMode = 'system' | 'normal' | 'high';
export type MotionMode = 'system' | 'full' | 'reduced';

const STORAGE_KEY = 'squigglepig.theme';
const CONTRAST_KEY = 'squigglepig.contrast';
const MOTION_KEY = 'squigglepig.motion';
const SEASONAL_KEY = 'squigglepig.seasonal';
const PIN_KEY = 'squigglepig.themePin';
const WIPE_MS = 700; // the sweep
const FLIP_AT_MS = 90; // how far into the sweep the palette flips under the photo
const EDGE = 0.18; // soft leading edge, as a share of the screen height

type ThemeCtx = {
  theme: Theme;
  mode: ThemeMode;
  // The theme the screen is heading to. Equals theme.name except during the
  // wipe — the toggle glyph follows this so it morphs the moment it is
  // tapped, while the old screen is still being swept away.
  showing: ThemeName;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void; // light <-> dark, relative to what's showing now
  // Make a change that restyles the whole screen (choosing a theme) behind
  // the same sweep as the light / dark switch: `apply` runs once the old
  // screen is covered. Up like nightfall, or (the default) down like daybreak.
  sweep: (apply: () => void, up?: boolean) => void;
  contrast: ContrastMode;
  highContrast: boolean; // what is showing: the pinned setting, else the OS
  setContrast: (c: ContrastMode) => void;
  motion: MotionMode;
  reducedMotion: boolean; // likewise
  setMotion: (m: MotionMode) => void;
  seasonal: boolean;
  setSeasonal: (on: boolean) => void;
  skin: Skin | null; // the skin showing (seasonal or chosen), if any
  season: Skin | null; // the birthday or holiday in season today, showing or not
  // A theme was just chosen: show it over the birthday or holiday on today
  // until that one ends. With none on, it shows until the next one starts.
  pinChoice: () => void;
  // A screen whose art changes with the light itself (useFadesWithTheme)
  // registers while it's up (+1) and leaves (-1).
  fadesItself: (delta: number) => void;
};

// The photo of the old screen, which way it is swept away, and the change it
// covers (run once the photo is showing).
type Wipe = { uri: string; up: boolean; apply: () => void };
type Size = { width: number; height: number };
// The birthday or holiday a chosen theme shows over (its skin id), and the
// last day of it (seasonEnd), so a pin made this Halloween is over by next.
type Pin = { id: string; until: string };

function parsePin(raw: string | null): Pin | null {
  try {
    const p = raw ? JSON.parse(raw) : null;
    return p && typeof p.id === 'string' && typeof p.until === 'string' ? { id: p.id, until: p.until } : null;
  } catch {
    return null;
  }
}

const Ctx = createContext<ThemeCtx | null>(null);
const WipeCtx = createContext<{
  shotRef: React.RefObject<View | null>;
  // The photographed view's real size. Not the window's: on Android that
  // leaves out the system navigation bar, and a full-height photo squeezed
  // into a shorter box shifts the whole screen up by that much mid-wipe.
  size: Size;
  setSize: (s: Size) => void;
  wipe: Wipe | null;
  onReady: () => void;
  onDone: () => void;
} | null>(null);

// An OS accessibility flag, kept live: read once, then follow its change event.
// On web the browser's media query stands in for it.
function useOsFlag(read: (() => Promise<boolean>) | null, event: string | null, media: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(media) : null;
      if (!mq) return;
      setOn(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setOn(e.matches);
      mq.addEventListener?.('change', onChange);
      return () => mq.removeEventListener?.('change', onChange);
    }
    if (!read || !event) return;
    read().then(setOn).catch(() => {});
    const sub = AccessibilityInfo.addEventListener(event as 'reduceMotionChanged', setOn);
    return () => sub.remove();
  }, [read, event, media]);
  return on;
}

const HC_READ =
  Platform.OS === 'ios'
    ? AccessibilityInfo.isDarkerSystemColorsEnabled
    : Platform.OS === 'android'
      ? AccessibilityInfo.isHighTextContrastEnabled
      : null;
const HC_EVENT =
  Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : Platform.OS === 'android' ? 'highTextContrastChanged' : null;

function useOsHighContrast() {
  return useOsFlag(HC_READ, HC_EVENT, '(prefers-contrast: more)');
}

function useOsReduceMotion() {
  return useOsFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged', '(prefers-reduced-motion: reduce)');
}

// The skin in season today: a birthday from the Supabase list, else a
// holiday. The date is checked again, and the list fetched again, whenever
// the app comes back to the foreground, so a phone left on the lobby
// overnight changes with the date and a newly added birthday shows up.
// `saved` is the list kept on the phone (read with the other settings, before
// the first frame); a fetched list replaces it.
function useSeasonSkin(saved: Birthday[] | null) {
  const [today, setToday] = useState(() => new Date());
  const [fetched, setFetched] = useState<Birthday[] | null>(null);
  useEffect(() => {
    let live = true;
    const refresh = () =>
      fetchBirthdays().then((list) => {
        if (live && list) setFetched(list);
      });
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      setToday(new Date());
      refresh();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  const birthdays = fetched ?? saved;
  const season = useMemo(() => skinFor(today, birthdays ?? []), [today, birthdays]);
  return { season, today };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const osHighContrast = useOsHighContrast();
  const osReduceMotion = useOsReduceMotion();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [contrast, setContrastState] = useState<ContrastMode>('system');
  const [motion, setMotionState] = useState<MotionMode>('system');
  const [seasonal, setSeasonalState] = useState(true);
  const [savedBirthdays, setSavedBirthdays] = useState<Birthday[] | null>(null);
  const { season, today } = useSeasonSkin(savedBirthdays);
  const [pin, setPin] = useState<Pin | null>(null);
  const chosen = UNLOCKABLE[useInventory().chosen('theme') ?? ''] ?? null;
  const [loaded, setLoaded] = useState(false);

  // Restore the pinned settings before the first frame so a
  // dark-mode player never sees a teal flash at launch (the splash screen
  // covers the wait).
  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, CONTRAST_KEY, MOTION_KEY, SEASONAL_KEY, BIRTHDAYS_KEY, PIN_KEY])
      .then(([[, v], [, c], [, m], [, z], [, b], [, p]]) => {
        if (v === 'light' || v === 'dark') setModeState(v);
        if (c === 'normal' || c === 'high') setContrastState(c);
        if (m === 'full' || m === 'reduced') setMotionState(m);
        if (z === 'off') setSeasonalState(false);
        setSavedBirthdays(parseBirthdays(b));
        setPin(parsePin(p));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const name: ThemeName = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const highContrast = contrast === 'system' ? osHighContrast : contrast === 'high';
  const reducedMotion = motion === 'system' ? osReduceMotion : motion === 'reduced';
  // The season gives way to a theme chosen while it was on.
  const pinned = !!season && pin?.id === season.id && dayKey(today) <= pin.until;
  const skin = (seasonal && !pinned ? season : null) ?? chosen;
  const theme = paletteFor(skin, name, highContrast);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const setContrast = useCallback((c: ContrastMode) => {
    setContrastState(c);
    AsyncStorage.setItem(CONTRAST_KEY, c).catch(() => {});
  }, []);

  const setMotion = useCallback((m: MotionMode) => {
    setMotionState(m);
    AsyncStorage.setItem(MOTION_KEY, m).catch(() => {});
  }, []);

  const setSeasonal = useCallback((on: boolean) => {
    setSeasonalState(on);
    AsyncStorage.setItem(SEASONAL_KEY, on ? 'on' : 'off').catch(() => {});
  }, []);

  const pinChoice = useCallback(() => {
    const next = season ? { id: season.id, until: seasonEnd(season, today) } : null;
    setPin(next);
    (next ? AsyncStorage.setItem(PIN_KEY, JSON.stringify(next)) : AsyncStorage.removeItem(PIN_KEY)).catch(() => {});
  }, [season, today]);

  // The transition: the OLD screen is photographed
  // (react-native-view-shot), the palette flips underneath the photo, and the
  // photo is wiped away behind a soft edge so the NEW screen shows through —
  // up from the bottom going dark (night rises), down from the top going light
  // (day breaks). See <ThemeTransition/>; <ThemeSnapshotTarget/> marks what
  // gets photographed (the screens, not the toggle floating above them).
  // With reduced motion there is no wipe: the palette simply flips. Choosing
  // a theme plays the same sweep (`sweep`).
  const shotRef = useRef<View | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [pending, setPending] = useState<ThemeName | null>(null);
  const [wipe, setWipe] = useState<Wipe | null>(null);
  const sweeping = useRef(false); // from the photo being taken until the sweep ends
  // Screens up now that fade their own art between day and night
  // (useFadesWithTheme): while there are any, the light / dark switch flips
  // the palette without the sweep, and they fade.
  const selfFaders = useRef(0);
  const fadesItself = useCallback((delta: number) => {
    selfFaders.current += delta;
  }, []);

  const sweep = useCallback(
    (apply: () => void, up = false) => {
      // One at a time: a change made while a sweep is running just happens.
      if (reducedMotion || sweeping.current) {
        apply();
        return;
      }
      sweeping.current = true;
      captureRef(shotRef, { format: 'jpg', quality: 0.95, result: 'tmpfile' })
        .then((uri) => setWipe({ uri, up, apply }))
        .catch(() => {
          // No photo (e.g. web): just change.
          sweeping.current = false;
          apply();
          setPending(null);
        });
    },
    [reducedMotion]
  );

  const toggle = useCallback(() => {
    if (pending) return; // one at a time
    const to: ThemeName = name === 'dark' ? 'light' : 'dark';
    if (reducedMotion || selfFaders.current > 0) {
      setMode(to);
      return;
    }
    setPending(to); // the glyph starts morphing now
    sweep(() => setMode(to), to === 'dark');
  }, [pending, name, setMode, reducedMotion, sweep]);

  // The photo is on screen and decoded (it looks identical to the live screen
  // under it), so the change can happen without anyone seeing it.
  const onReady = useCallback(() => {
    wipe?.apply();
  }, [wipe]);
  const onDone = useCallback(() => {
    sweeping.current = false;
    setWipe(null);
    setPending(null);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      mode,
      showing: pending ?? name,
      setMode,
      toggle,
      sweep,
      contrast,
      highContrast,
      setContrast,
      motion,
      reducedMotion,
      setMotion,
      seasonal,
      setSeasonal,
      skin,
      season,
      pinChoice,
      fadesItself,
    }),
    [
      theme, mode, pending, name, setMode, toggle, sweep,
      contrast, highContrast, setContrast, motion, reducedMotion, setMotion,
      seasonal, setSeasonal, skin, season, pinChoice, fadesItself,
    ]
  );
  const wipeValue = useMemo(() => ({ shotRef, size, setSize, wipe, onReady, onDone }), [size, wipe, onReady, onDone]);

  return (
    <Ctx.Provider value={value}>
      <WipeCtx.Provider value={wipeValue}>
        <View style={styles.fill}>{loaded ? children : null}</View>
      </WipeCtx.Provider>
    </Ctx.Provider>
  );
}

function useWipe() {
  const ctx = useContext(WipeCtx);
  if (!ctx) throw new Error('ThemeTransition / ThemeSnapshotTarget need a <ThemeProvider> above them');
  return ctx;
}

// Wrap the screens in this: it is what the transition photographs.
export function ThemeSnapshotTarget({ children }: { children: React.ReactNode }) {
  const { shotRef, size, setSize } = useWipe();
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };
  return (
    <View ref={shotRef} collapsable={false} style={styles.fill} onLayout={onLayout}>
      {children}
    </View>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// The wipe. Mount it once, above the snapshot target and BELOW the toggle
// (app/_layout.tsx), so the glyph keeps morphing on top while the old screen
// is swept away underneath it. Drawn entirely by react-native-svg — the photo
// behind a luminance mask (white = the old screen still shows) made of a
// solid body plus a gradient strip on its leading side; the pair slides off
// the screen, the strip sweeping across it.
export function ThemeTransition() {
  const { wipe, size, onReady, onDone } = useWipe();
  const win = useWindowDimensions();
  // Same box as the photo, so it lands pixel for pixel on the live screen.
  const width = size.width || win.width;
  const height = size.height || win.height;
  const p = useRef(new Animated.Value(0)).current; // 0 = photo fully showing, 1 = gone
  const cb = useRef({ onReady, onDone });
  cb.current = { onReady, onDone };

  const edge = Math.round(height * EDGE);
  const travel = height + edge;
  const up = !!wipe?.up;

  // Runs once the photo has decoded. The sweep starts at once; the palette
  // flips a few frames later, when the photo is certainly painted and the
  // strip has barely moved (onLoad can fire a frame before the draw, and
  // flipping then would flash the new screen before the photo covers it).
  const start = useCallback(() => {
    p.setValue(0);
    Animated.timing(p, {
      toValue: 1,
      duration: WIPE_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false, // SVG attributes
    }).start(() => cb.current.onDone());
    setTimeout(() => cb.current.onReady(), FLIP_AT_MS);
  }, [p]);

  if (!wipe) return null;

  // Going up (to dark) the body sits over the screen with the strip below it,
  // and both move up; going down the strip is above and both move down.
  const bodyY = p.interpolate({ inputRange: [0, 1], outputRange: up ? [0, -travel] : [0, travel] });
  const edgeY = p.interpolate({ inputRange: [0, 1], outputRange: up ? [height, height - travel] : [-edge, -edge + travel] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="wipe-edge" x1="0" y1={up ? '0' : '1'} x2="0" y2={up ? '1' : '0'}>
            <Stop offset="0" stopColor="#fff" />
            <Stop offset="1" stopColor="#000" />
          </LinearGradient>
          <Mask id="wipe" maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
            <AnimatedRect x="0" y={bodyY} width={width} height={height} fill="#fff" />
            <AnimatedRect x="0" y={edgeY} width={width} height={edge} fill="url(#wipe-edge)" />
          </Mask>
        </Defs>
        <SvgImage
          href={{ uri: wipe.uri }}
          x="0"
          y="0"
          width={width}
          height={height}
          preserveAspectRatio="none"
          mask="url(#wipe)"
          onLoad={start}
        />
      </Svg>
    </View>
  );
}

// The palette for whatever is showing now. Works outside the provider too
// (it just follows the device) so components stay usable in isolation.
export function useTheme(): Theme {
  const ctx = useContext(Ctx);
  const system = useColorScheme();
  return ctx ? ctx.theme : system === 'dark' ? themes.dark.normal : themes.light.normal;
}

// For a screen whose art changes with the light itself, like a game's field
// going from day to night: while it's mounted the light / dark switch skips
// the sweep (the screen fades instead).
export function useFadesWithTheme() {
  const fadesItself = useContext(Ctx)?.fadesItself;
  useEffect(() => {
    if (!fadesItself) return;
    fadesItself(1);
    return () => fadesItself(-1);
  }, [fadesItself]);
}

// Whether to hold still: the menu's Reduce motion setting, else the OS one.
// Like useTheme it works outside the provider (it just follows the OS).
export function useReducedMotion(): boolean {
  const ctx = useContext(Ctx);
  const os = useOsReduceMotion();
  return ctx ? ctx.reducedMotion : os;
}

// The skin showing, seasonal or chosen, if any (null outside the provider).
export function useSkin(): Skin | null {
  return useContext(Ctx)?.skin ?? null;
}

export function useThemeMode(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useThemeMode needs a <ThemeProvider> above it');
  return ctx;
}

// Component styles that mention a color are built per theme:
//
//   const makeStyles = (t: Theme) => StyleSheet.create({ card: { backgroundColor: t.surface } });
//   ...
//   const styles = useThemedStyles(makeStyles);
//
// `factory` is a module-level constant and there are only a handful of
// palettes (four, plus each skin's light and dark), each built once, so the
// memo hits every render after the first for a given palette.

export function useThemedStyles<T>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
