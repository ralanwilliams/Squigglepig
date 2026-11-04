import AsyncStorage from '@react-native-async-storage/async-storage';

// Persists just enough to rejoin a room after the app is closed/reopened:
// the room code and the player's chosen username. The server remembers that
// the player is in the room (supabase/rooms.sql); this is how the phone
// remembers which room to go back to. Host status is NOT stored — it is
// derived live from who has been in the room longest (see GameContext), so it
// survives drops and reconnects automatically.
const KEY = 'squigglepig.session';
// A Leave game the server hasn't heard about yet (tapped while offline).
const LEAVE_KEY = 'squigglepig.pendingLeave';

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

export async function savePendingLeave(room: string) {
  try {
    await AsyncStorage.setItem(LEAVE_KEY, room);
  } catch {}
}

export async function takePendingLeave(): Promise<string | null> {
  try {
    const room = await AsyncStorage.getItem(LEAVE_KEY);
    if (room) await AsyncStorage.removeItem(LEAVE_KEY);
    return room;
  } catch {
    return null;
  }
}
