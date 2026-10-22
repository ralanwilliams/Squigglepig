import type { MonthDay } from './types';

// Holidays that move from year to year.

const md = (d: Date): MonthDay => [d.getMonth() + 1, d.getDate()];

// The `days`th day after (or before, when negative) a date, as [month, day].
export function shift(year: number, [m, d]: MonthDay, days: number): MonthDay {
  return md(new Date(year, m - 1, d + days));
}

// Easter Sunday (Western), by the anonymous Gregorian computus.
export function easterSunday(year: number): MonthDay {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

// US Thanksgiving: the fourth Thursday of November.
export function thanksgivingDay(year: number): MonthDay {
  const first = new Date(year, 10, 1).getDay(); // 0 = Sunday
  return [11, 1 + ((4 - first + 7) % 7) + 21];
}
