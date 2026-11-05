// Free text players type (names, prompts, guesses, the pig's speech bubble)
// and room codes. Everything typed goes through here before it's sent, and
// everything received from other phones goes through here again, since anyone
// can send anything: a phone running a changed copy of the app isn't held to
// the text boxes' limits.
//
// cleanText keeps what can be seen and drops what can't: control characters,
// zero-width and direction marks, blank "filler" letters. Without that, "Sam"
// and "Sam" plus an invisible mark are two different names that look the
// same, so one player could pass as another. The pieces that glue emoji
// together (the zero-width joiner, variation selectors, tag letters) are kept
// only inside emoji and the scripts that need them: 👩‍💻 and ❤️ survive. Every kind of space
// becomes a plain one, runs of them become one, and the ends are trimmed.
// supabase/rooms.sql (clean_name) does the same to names on the server.

// Names are what the game keys scores and turns by, so the server keeps them
// unique within a room (supabase/rooms.sql) and no longer than this.
export const NAME_MAX = 24;
// A prompt or a guess: a short phrase, as in the game.
export const PHRASE_MAX = 60;

// The server makes room codes from these (supabase/rooms.sql, create_room):
// no I, O, 0 or 1, which are easy to mix up.
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;

const isSpace = (cp: number) =>
  (cp >= 0x09 && cp <= 0x0d) ||
  cp === 0x20 ||
  cp === 0x85 ||
  cp === 0xa0 ||
  cp === 0x1680 ||
  (cp >= 0x2000 && cp <= 0x200a) ||
  cp === 0x2028 ||
  cp === 0x2029 ||
  cp === 0x202f ||
  cp === 0x205f ||
  cp === 0x3000;

// Never seen, never needed in a name or a phrase.
const isInvisible = (cp: number) =>
  cp <= 0x1f ||
  (cp >= 0x7f && cp <= 0x9f) ||
  cp === 0xad || // soft hyphen
  cp === 0x34f || // combining grapheme joiner
  cp === 0x61c || // Arabic letter mark
  cp === 0x115f || // Hangul fillers
  cp === 0x1160 ||
  cp === 0x17b4 ||
  cp === 0x17b5 ||
  (cp >= 0x180b && cp <= 0x180f) || // Mongolian selectors, vowel separator
  cp === 0x200b || // zero-width space
  cp === 0x200e || // direction marks
  cp === 0x200f ||
  (cp >= 0x202a && cp <= 0x202e) || // direction overrides
  (cp >= 0x2060 && cp <= 0x206f) || // word joiner, invisible operators, direction isolates
  cp === 0x2800 || // blank Braille cell
  cp === 0x3164 || // Hangul filler
  cp === 0xfeff || // byte-order mark
  cp === 0xffa0 || // halfwidth Hangul filler
  (cp >= 0xfff0 && cp <= 0xfffb) ||
  (cp >= 0x1d173 && cp <= 0x1d17a) || // musical formatting
  cp === 0xe0001; // language tag

// Joiners: the zero-width joiner (👩‍💻) and non-joiner (needed in Persian and
// some Indian scripts). Kept only between two letters that aren't plain ASCII.
const isJoiner = (cp: number) => cp === 0x200c || cp === 0x200d;
// Glue after an emoji: variation selectors (❤️) and tag letters (🏴 flags).
// Kept only after a letter that isn't plain ASCII.
const isGlue = (cp: number) => (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0020 && cp <= 0xe007f);
const isWide = (cp: number | undefined) => cp !== undefined && cp >= 0x80 && !isSpace(cp);

export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  // Far more than any real text this long could need, invisible marks and
  // all: a huge message from a changed app is cut down before the work below.
  const cps = Array.from(raw.slice(0, max * 8).normalize('NFC'), (c) => c.codePointAt(0)!);
  let out: number[] = [];
  for (const cp of cps) {
    if (isSpace(cp)) {
      if (out.length && out[out.length - 1] !== 0x20) out.push(0x20);
    } else if (!isInvisible(cp)) {
      out.push(cp);
    }
  }
  // Then the glue and joiners, once everything invisible around them has
  // gone, over and over until nothing more goes: taking one away can leave
  // another next to plain ASCII ("Sam" + joiner + selector loses the joiner,
  // and then the selector sits after the m). Each pass drops something or
  // ends it.
  for (;;) {
    const was = out;
    out = [];
    was.forEach((cp, i) => {
      const prev = out[out.length - 1];
      const next = was[i + 1];
      if (isGlue(cp)) {
        if (isWide(prev)) out.push(cp);
      } else if (isJoiner(cp)) {
        if (isWide(prev) && !isJoiner(prev) && isWide(next) && !isJoiner(next)) out.push(cp);
      } else {
        out.push(cp);
      }
    });
    if (out.length === was.length) break;
  }
  let chars = out.map((cp) => String.fromCodePoint(cp));
  if (chars.length > max) chars = chars.slice(0, max);
  // Trimmed, and, if it was cut short mid-emoji, no joiner left at the end.
  return chars.join('').trim().replace(/[\u200C\u200D]+$/, '').trim();
}

export const cleanName = (raw: unknown) => cleanText(raw, NAME_MAX);
export const cleanPhrase = (raw: unknown) => cleanText(raw, PHRASE_MAX);

// What the room code box keeps as it's typed or pasted: capitals (any case
// can be typed), only the letters and digits a code is made of, and no more
// than a code's length. The server capitalises too (join_room), so a code
// that comes in some other way still finds its room.
export function cleanRoomCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let code = '';
  for (const c of raw.toUpperCase()) {
    if (ROOM_CODE_CHARS.includes(c)) code += c;
    if (code.length === ROOM_CODE_LENGTH) break;
  }
  return code;
}

export const isRoomCode = (code: string) => code.length === ROOM_CODE_LENGTH && cleanRoomCode(code) === code;
