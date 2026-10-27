import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  useFonts,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import { GameProvider } from '../src/state/GameContext';
import { InventoryProvider } from '../src/rewards/inventory';
import { ThemeProvider, ThemeSnapshotTarget, ThemeTransition, useTheme } from '../src/theme/theme';
import { ThemeToggleOverlay } from '../src/components/ThemeToggle';
import { ToastOverlay } from '../src/components/Toast';
import { TroughDropLayer } from '../src/components/TroughDrops';
import { playMusic, preloadSounds, stopMusic } from '../src/lib/sound';
import { useAppFrame } from '../src/theme/responsive';

// Screens with the theme playing: everything from launch up to the moment the
// round starts (plus /licenses and /rewards, which open from Home's menu, the
// solo game list, /arcade, and Your pig, /pig). It stops on /view (the "your
// prompt" screen) and stays off through drawing, guessing, reveal and the
// scoreboard, and through a solo run (/arcade/<game>); if a new game drops
// everyone back into /prompts or /lobby it starts again from the top.
const MUSIC_SCREENS = new Set(['/', '/index', '/licenses', '/rewards', '/pig', '/arcade', '/join', '/create', '/lobby', '/prompts', '/waiting']);

// Installed as a PWA (Add to Home Screen; on an iPhone, navigator.standalone):
// the system bars are always black, whatever the palette (Shell).
const STANDALONE =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true);
const BAR = '#000000';

export default function RootLayout() {
  // Load Roboto (Bootswatch Materia's font). Render regardless so the UI is
  // never blocked; text simply upgrades to Roboto once loaded.
  useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });

  // Follow the device accelerometer — allow portrait and landscape. Load the
  // sound clips now so the first button press doesn't wait on them.
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    preloadSounds();
  }, []);

  // Theme music follows the route (see MUSIC_SCREENS). Moving between music
  // screens leaves it running; the first non-music screen stops it.
  const pathname = usePathname();
  useEffect(() => {
    if (MUSIC_SCREENS.has(pathname)) playMusic();
    else stopMusic();
  }, [pathname]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <InventoryProvider>
          <ThemeProvider>
            <GameProvider>
              <Shell />
            </GameProvider>
          </ThemeProvider>
        </InventoryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Everything that needs the resolved theme: the status bar, the navigator
// (wrapped so the theme transition can photograph it), the wipe that sweeps
// the old screen away when the theme flips, seasonal props falling into the
// trough from the top of the screen, and the dark-mode toggle floating over
// every screen — in that order, so the toggle's glyph keeps morphing on top
// while the wipe passes underneath it.
//
// On web all of it sits in a frame centred in the browser window, capped in
// width so an ultrawide monitor doesn't pull the panes apart (useAppFrame);
// the window around it shows the screen background. On native the frame is
// simply the whole screen.
function Shell() {
  const theme = useTheme();
  const frame = useAppFrame();
  const insets = useSafeAreaInsets();

  // On the web (a tab, or installed as a PWA) the browser's own bars and the
  // page behind the app follow the palette too — dark mode, a holiday, a won
  // theme: the toolbar / status bar color (theme-color) and the page's
  // background, which shows in the strips round the app (an iPhone's status
  // bar and home indicator) and when the page bounces. public/index.html
  // starts them right for the OS's light or dark mode, before this runs.
  // Installed as a PWA they're black instead, and so are the strips at the
  // top and bottom insets, where the app runs under the system bars.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const page = STANDALONE ? BAR : theme.background;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', page));
    document.documentElement.style.backgroundColor = page;
    document.body.style.backgroundColor = page;
  }, [theme.background]);

  return (
    <View style={[styles.window, { backgroundColor: theme.background }]}>
      <View style={[styles.frame, Platform.OS === 'web' && { maxWidth: frame.width }]}>
        <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
        <ThemeSnapshotTarget>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: theme.background },
            }}
          />
        </ThemeSnapshotTarget>
        <ThemeTransition />
        <TroughDropLayer />
        <ThemeToggleOverlay />
        <ToastOverlay />
      </View>
      {STANDALONE ? (
        <>
          <View pointerEvents="none" style={[styles.bar, { top: 0, height: insets.top }]} />
          <View pointerEvents="none" style={[styles.bar, { bottom: 0, height: insets.bottom }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  window: { flex: 1, alignItems: 'center' },
  frame: { flex: 1, width: '100%' },
  bar: { position: 'absolute', left: 0, right: 0, backgroundColor: BAR },
});
