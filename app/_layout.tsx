import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { ThemeProvider, ThemeSnapshotTarget, ThemeTransition, useTheme } from '../src/theme/theme';
import { ThemeToggleOverlay } from '../src/components/ThemeToggle';
import { ToastOverlay } from '../src/components/Toast';
import { playMusic, preloadSounds, stopMusic } from '../src/lib/sound';

// Screens with the theme playing: everything from launch up to the moment the
// round starts. It stops on /view (the "your prompt" screen) and stays off
// through drawing, guessing, reveal and the scoreboard; if a new game drops
// everyone back into /prompts or /lobby it starts again from the top.
const MUSIC_SCREENS = new Set(['/', '/index', '/join', '/create', '/lobby', '/prompts', '/waiting']);

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
        <ThemeProvider>
          <GameProvider>
            <Shell />
          </GameProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Everything that needs the resolved theme: the status bar, the navigator
// (wrapped so the theme transition can photograph it), the wipe that sweeps
// the old screen away when the theme flips, and the dark-mode toggle floating
// over every screen — in that order, so the toggle's glyph keeps morphing on
// top while the wipe passes underneath it.
function Shell() {
  const theme = useTheme();
  return (
    <>
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
      <ThemeToggleOverlay />
      <ToastOverlay />
    </>
  );
}
