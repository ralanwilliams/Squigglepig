import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists just enough to auto-rejoin a room after the app is closed/reopened:
// the room code and the player's chosen username. Host status is NOT stored —
// it is derived live from who has been in the room longest (see GameContext),
// so it survives drops and reconnects automatically.
const KEY = 'squigglepig.session';

export type SavedSession = { room: string; username: string };

export async function saveSession(s: SavedSession) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export async function loadSession(): Promise<SavedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.room && parsed?.username) return parsed;
  } catch {}
  return null;
}

export async function clearSession() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
