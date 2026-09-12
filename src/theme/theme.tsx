import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useColorScheme, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Defs, Image as SvgImage, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, type Theme } from './tokens';

// Which palette the app shows. 'system' follows the device setting (app.json
// sets userInterfaceStyle "automatic" so we're told about it); the in-app
// toggle pins 'light' or 'dark', and that choice survives restarts.
export type ThemeMode = 'system' | 'light' | 'dark';
type ThemeName = 'light' | 'dark';

const STORAGE_KEY = 'squigglepig.theme';
// Dark mode is not ready to ship, so it is hidden until unlocked: while
// locked the app is always light (whatever the device or a pinned mode says)
// and the toggle is not shown. Typing "activate dark mode" as the username on
// the create-game screen unlocks it (app/create.tsx); the unlock persists.
const UNLOCK_KEY = 'squigglepig.theme.unlocked';
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
  unlocked: boolean; // whether dark mode is available at all (see UNLOCK_KEY)
  setUnlocked: (on: boolean) => void;
};

type Wipe = { uri: string; to: ThemeName };
type Size = { width: number; height: number };

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [unlocked, setUnlockedState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Restore the pinned mode (and the unlock) before the first frame so a
  // dark-mode player never sees a teal flash at launch (the splash screen
  // covers the wait).
  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, UNLOCK_KEY])
      .then(([[, v], [, u]]) => {
        if (v === 'light' || v === 'dark') setModeState(v);
        setUnlockedState(u === '1');
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const chosen: ThemeName = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const name: ThemeName = unlocked ? chosen : 'light';
  const theme = themes[name];

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
  }, []);

  const setUnlocked = useCallback((on: boolean) => {
    setUnlockedState(on);
    AsyncStorage.setItem(UNLOCK_KEY, on ? '1' : '0').catch(() => {});
  }, []);

  // The transition: the OLD screen is photographed
  // (react-native-view-shot), the palette flips underneath the photo, and the
  // photo is wiped away behind a soft edge so the NEW screen shows through —
  // up from the bottom going dark (night rises), down from the top going light
  // (day breaks). See <ThemeTransition/>; <ThemeSnapshotTarget/> marks what
  // gets photographed (the screens, not the toggle floating above them).
  const shotRef = useRef<View | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [pending, setPending] = useState<ThemeName | null>(null);
  const [wipe, setWipe] = useState<Wipe | null>(null);

  const toggle = useCallback(() => {
    if (pending) return; // one at a time
    const to: ThemeName = name === 'dark' ? 'light' : 'dark';
    setPending(to); // the glyph starts morphing now
    captureRef(shotRef, { format: 'jpg', quality: 0.95, result: 'tmpfile' })
      .then((uri) => setWipe({ uri, to }))
      .catch(() => {
        // No photo (e.g. web): just flip.
        setMode(to);
        setPending(null);
      });
  }, [pending, name, setMode]);

  // The photo is on screen and decoded (it looks identical to the live screen
  // under it), so the palette can flip without anyone seeing it happen.
  const onReady = useCallback(() => {
    if (wipe) setMode(wipe.to);
  }, [wipe, setMode]);
  const onDone = useCallback(() => {
    setWipe(null);
    setPending(null);
  }, []);

  const value = useMemo(
    () => ({ theme, mode, showing: pending ?? name, setMode, toggle, unlocked, setUnlocked }),
    [theme, mode, pending, name, setMode, toggle, unlocked, setUnlocked]
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
  const dark = wipe?.to === 'dark';

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

  // Going dark the body sits over the screen with the strip below it, and both
  // move up; going light the strip is above and both move down.
  const bodyY = p.interpolate({ inputRange: [0, 1], outputRange: dark ? [0, -travel] : [0, travel] });
  const edgeY = p.interpolate({ inputRange: [0, 1], outputRange: dark ? [height, height - travel] : [-edge, -edge + travel] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="wipe-edge" x1="0" y1={dark ? '0' : '1'} x2="0" y2={dark ? '1' : '0'}>
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
  return ctx ? ctx.theme : system === 'dark' ? themes.dark : themes.light;
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
// `factory` is a module-level constant and there are only two themes, so the
// memo hits every render after the first for a given scheme.
export function useThemedStyles<T>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
