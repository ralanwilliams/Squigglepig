import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseReady } from './supabase';
import type { Birthday } from '../theme/skins/birthday';

// The birthdays the app celebrates come from the Supabase `birthdays` table
// (supabase/birthdays.sql), so adding or removing one needs no app update.
// The last list fetched is kept on the phone: ThemeProvider reads it before
// the first frame (no flash of the holiday theme on someone's birthday, and
// it works offline), then fetches a fresh one at launch and whenever the app
// comes back to the foreground.

export const BIRTHDAYS_KEY = 'squigglepig.birthdays';

// Keep only well-formed rows: a name the cake can hold, a real month and day.
function clean(rows: unknown): Birthday[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    const name = typeof r?.name === 'string' ? r.name.trim() : '';
    const month = Number(r?.month);
    const day = Number(r?.day);
    const ok = name.length >= 1 && name.length <= 24 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
    return ok && Number.isInteger(month) && Number.isInteger(day) ? [{ name, month, day }] : [];
  });
}

// The list saved on the phone, from AsyncStorage's raw value.
export function parseBirthdays(raw: string | null | undefined): Birthday[] {
  if (!raw) return [];
  try {
    return clean(JSON.parse(raw));
  } catch {
    return [];
  }
}

// The current list from Supabase, saved for next time; null if it couldn't be
// had (offline, not configured), so the saved one stays in use.
export async function fetchBirthdays(): Promise<Birthday[] | null> {
  if (!supabaseReady) return null;
  try {
    const { data, error } = await supabase.from('birthdays').select('name, month, day');
    if (error || !data) return null;
    const list = clean(data);
    AsyncStorage.setItem(BIRTHDAYS_KEY, JSON.stringify(list)).catch(() => {});
    return list;
  } catch {
    return null;
  }
}
