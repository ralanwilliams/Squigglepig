import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Configure these in a .env file at the project root (see .env.example):
//   EXPO_PUBLIC_SUPABASE_URL=...   (Settings -> Data API -> Project URL)
//   EXPO_PUBLIC_SUPABASE_KEY=...   (Settings -> API Keys -> Publishable key, sb_publishable_...)
// The legacy "anon" key also works, but the publishable key is the current standard.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? // backwards compatible
  '';

// True once the developer has supplied real Supabase credentials.
export const supabaseReady = url.length > 0 && key.length > 0;

if (!supabaseReady) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Squigglepig] Supabase env vars are missing. Add EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_KEY to a .env file, then restart with `npx expo start -c`.'
  );
}

// Placeholder values keep the app from crashing on boot before credentials are set;
// realtime simply will not connect until real values are provided.
//
// The session is the player's guest id (see signIn below), kept on the phone
// (in the browser, for the web version) so it's the same player every launch.
export const supabase = createClient(
  supabaseReady ? url : 'https://placeholder.supabase.co',
  supabaseReady ? key : 'placeholder-key',
  {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  }
);

// The session's token is refreshed on a timer, which a backgrounded app can't
// run, so it's only kept ticking while the app is on screen.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// Every player is a Supabase user: on first use the app signs in anonymously
// (no sign-up screen, nothing asked), which gives the phone a stable id that
// room membership and the push token hang off (supabase/rooms.sql). Resolves
// to the user's id, or null when it can't sign in (offline, no keys, or
// anonymous sign-ins switched off in the dashboard). The saved session is
// read every time (getSession refreshes an expired token), so this is always
// the session the next request goes out with. `fresh` throws it away first,
// for when the server no longer knows that guest.
let signingIn: Promise<string | null> | null = null;
export async function signIn(fresh = false): Promise<string | null> {
  if (!supabaseReady) return null;
  if (!fresh) {
    const id = await currentUserId();
    if (id) return id;
  }
  // One new guest at a time: calls that arrive meanwhile wait for it.
  if (!signingIn) {
    signingIn = (async () => {
      if (fresh) await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.warn('[auth] guest sign-in failed:', error.message);
        return null;
      }
      return data.user?.id ?? null;
    })()
      .catch(() => null)
      .finally(() => {
        signingIn = null;
      });
  }
  return signingIn;
}

// The guest already signed in on this phone, without signing anyone in.
export async function currentUserId(): Promise<string | null> {
  if (!supabaseReady) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}
