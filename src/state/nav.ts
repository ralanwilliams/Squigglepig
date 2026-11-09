import { isGameOn, type Phase } from './rules';

// Where a room's game takes the player, apart from the router so it can be
// tested (tests/nav.test.ts). GameContext's `go` and its Back handling ask
// these, and do what they say.

// The screens a room is played on. The rest of the app — home, solo games,
// Your pig, Rewards — a player can look around while they're in a room and
// nothing is going on in it.
const ROOM_SCREENS = new Set(['/lobby', '/prompts', '/view', '/drawing', '/guessing', '/waiting', '/reveal', '/scoreboard']);
export const isRoomScreen = (path: string) => ROOM_SCREENS.has(path);

// How to get from `here` to the room's screen `path`:
//   'replace' — a room screen gives way to the next (a fresh one each time,
//               so a new turn starts afresh);
//   'push'    — over home, so Back (from the lobby or scoreboard) comes home;
//   'rehome'  — from anywhere else (Create, Join, a solo game, Your pig):
//               down to home, then over it, so home is right under the room's
//               screen whatever was open before. (A room link opens Join over
//               whatever is on screen, another room's game included.)
//   'stay'    — the player is looking around elsewhere and nothing in the room
//               needs them: the lobby only comes to them when asked (`force`:
//               joining, or Back to room).
export type Nav = 'replace' | 'push' | 'rehome' | 'stay';
export function navFor(here: string, path: string, force = false): Nav {
  if (isRoomScreen(here)) return 'replace';
  if (path === '/lobby' && !force) return 'stay';
  return here === '/' ? 'push' : 'rehome';
}

// A phone catching up (the host's answer, or a restored game) finds the room
// in its lobby: does it go there? Not if it's already in the lobby — going
// again would swap the screen for a fresh copy, the jump every time a phone
// joined or reconnected. Yes if its game ended while it was away, or it's on
// the waiting screen it reconnected to (GameContext connect).
export const lobbyOnCatchUp = (was: Phase, here: string) => isGameOn(was) || here === '/waiting';

// Whether Back is held (src/lib/backGuard.ts): during a game, on its screens.
// The game moves the player on by itself, so Back only ever means leaving, and
// asks first. In the lobby and on the scoreboard it goes home, still in the room.
// The waiting screen always counts: it's also where a phone back in a game waits
// to catch up, its own phase still the lobby until the host answers.
export const holdsBack = (inRoom: boolean, phase: Phase, here: string) =>
  inRoom && isRoomScreen(here) && (isGameOn(phase) || here === '/waiting');

// What leaving the room costs, for the question Leave game asks. Nobody can
// join a game under way (rooms.sql join_room), a player who left included.
export const leaveCost = (gameOn: boolean) =>
  gameOn ? "You'll leave this game, and you can't rejoin until it's over." : "You'll leave this room.";
