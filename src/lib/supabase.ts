import 'react-native-url-polyfill/auto';
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
export const supabase = createClient(
  supabaseReady ? url : 'https://placeholder.supabase.co',
  supabaseReady ? key : 'placeholder-key',
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  }
);
