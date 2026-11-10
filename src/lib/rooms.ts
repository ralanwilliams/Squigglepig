import { currentUserId, signIn, supabase } from './supabase';

// The server's side of a room (supabase/rooms.sql): who is in it, whether a
// game is on, and the host's snapshot of that game. The game itself still runs
// over the room's live channel (src/state/GameContext.tsx); these calls are
// the parts that have to outlast a closed app.

// How long a room may go without anyone doing anything in it before the
// server closes it (close_idle_rooms in supabase/rooms.sql says the same).
export const IDLE_MINUTES = 10;

export type Member = {
  id: string; // the player's user id
  name: string;
  joinedAt: number; // epoch ms
  leftAt: number | null; // set when they tapped Leave game during a game
};

export type RoomPhase = 'lobby' | 'playing';

export type Entry =
  | { status: 'ok'; room: string; name: string; userId: string }
  | { status: 'not_found' | 'in_progress' | 'room_full' | 'name_taken' | 'bad_name' | 'offline' };

// Why a room closed: nobody did anything in it for IDLE_MINUTES, or too few
// players were left in its game to play on (supabase/rooms.sql close_room).
export type ClosedReason = 'idle' | 'players';

export type RoomState =
  | { status: 'ok'; phase: RoomPhase; members: Member[]; snapshot: any }
  | { status: 'closed'; reason: ClosedReason }
  | { status: 'offline' };

// Calls one of the room functions as the signed-in guest. Null when it can't
// reach the server, or the call fails.
//
// Two problems get one more try. An expired token (a phone that slept
// through its refresh) is refreshed. A guest the server no longer has at all
// (tidied away after months unused, or a reset project: the insert's
// reference to the user fails, 23503, or no user came through) signs in as a
// new guest. Nothing else does that: a new guest isn't in any of the old
// one's rooms.
async function call<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T; userId: string } | null> {
  let userId = await signIn();
  if (!userId) return null;
  let { data, error } = await supabase.rpc(fn, args);
  if (error && /jwt expired/i.test(error.message)) {
    await supabase.auth.refreshSession().catch(() => {});
    ({ data, error } = await supabase.rpc(fn, args));
  } else if (error && (error.code === '23503' || /not signed in/i.test(error.message))) {
    userId = await signIn(true);
    if (!userId) return null;
    ({ data, error } = await supabase.rpc(fn, args));
  }
  if (error) {
    console.warn(`[rooms] ${fn} failed:`, error.message);
    return null;
  }
  return { data: data as T, userId };
}

const entry = (res: { data: any; userId: string } | null): Entry =>
  !res
    ? { status: 'offline' }
    : res.data?.status === 'ok'
      ? { status: 'ok', room: res.data.room, name: res.data.name, userId: res.userId }
      : { status: res.data?.status ?? 'offline' };

export async function createRoom(name: string): Promise<Entry> {
  return entry(await call('create_room', { p_name: name }));
}

// Join a room, or come back to one you're already in. With `rejoin`, only
// the latter: a room you aren't in is 'not_found'.
export async function joinRoom(code: string, name: string, rejoin = false): Promise<Entry> {
  return entry(await call('join_room', { p_code: code, p_name: name, p_rejoin: rejoin }));
}

export async function leaveRoomOnServer(code: string): Promise<boolean> {
  return !!(await call('leave_room', { p_code: code }));
}

export async function roomState(code: string, withSnapshot = false): Promise<RoomState> {
  const res = await call<any>('room_state', { p_code: code, p_snapshot: withSnapshot });
  if (!res) return { status: 'offline' };
  if (res.data?.status !== 'ok') return { status: 'closed', reason: asClosedReason(res.data?.reason) };
  return {
    status: 'ok',
    phase: res.data.phase === 'playing' ? 'playing' : 'lobby',
    members: (res.data.members ?? []).map((m: any) => ({
      id: String(m.id),
      name: String(m.name),
      joinedAt: Number(m.joinedAt) || 0,
      leftAt: m.leftAt == null ? null : Number(m.leftAt),
    })),
    snapshot: res.data.snapshot ?? null,
  };
}

export const asClosedReason = (v: unknown): ClosedReason => (v === 'players' ? 'players' : 'idle');

// The app went off screen: the player is away until they're back (touchRoom).
// When everyone in a game is, the server tells them it's paused.
export function stepAway(code: string): Promise<unknown> {
  return code ? call('step_away', { p_code: code }) : Promise.resolve();
}

// Something a person did in the room (or coming back to it): it isn't idle,
// and they're not away. Bursts are thinned to one call a minute per room (the
// server only needs to know it's well inside IDLE_MINUTES); `now` skips the
// wait, for coming back to the app.
const lastTouch: Record<string, number> = {};
export function touchRoom(code: string, now = false) {
  if (!code) return;
  const t = Date.now();
  if (!now && t - (lastTouch[code] ?? 0) < 60_000) return;
  lastTouch[code] = t;
  call('touch_room', { p_code: code });
}

export async function startGameOnServer(code: string): Promise<boolean> {
  const res = await call<boolean>('start_game', { p_code: code });
  return res?.data === true;
}

export function endGameOnServer(code: string) {
  call('end_game', { p_code: code });
}

export function saveSnapshot(code: string, state: unknown) {
  call('save_snapshot', { p_code: code, p_state: state });
}

// Notify away players (by user id) that the game started, it's their turn,
// their chain is up for judging, or the game is over. (A server that hasn't
// had rooms.sql run again since 2.9.0 knows only the first three, and ignores
// the others.)
export type Nudge = 'start' | 'draw' | 'guess' | 'judge' | 'over';
export function nudge(code: string, kind: Nudge, users: string[]) {
  if (users.length) call('nudge', { p_code: code, p_kind: kind, p_users: users });
}

// Deleting one (null) needs no guest: a phone that never signed in has no
// token on the server, so it isn't signed in just to say so.
export async function setPushToken(token: string | null): Promise<boolean> {
  if (token === null && !(await currentUserId())) return true;
  return !!(await call('set_push_token', { p_token: token }));
}
