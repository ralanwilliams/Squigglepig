import { router } from 'expo-router';
import { isRoomScreen, navFor } from '../nav';
import type { Engine, EngineFns } from './engine';

// ---- Getting around ----
// In the lobby or on the scoreboard, Back goes home and the player stays in
// the room: they can play solo, dress their pig, and come back with Home's
// Back to room (returnToRoom). When the game starts, or moves on, `go`
// brings them to its screen wherever they are. During a game Back asks if
// they want to leave, the same as Leave game (room.ts askToLeave).
// GameProvider keeps pathRef (and the room's screen) up to date as the
// player moves.
export function installNavigation(e: Engine) {
  const { pathRef, roomScreenRef, roomRef } = e;

  // To the room's screen `path`, however it's reached from here (../nav).
  // The router takes its calls in order, so 'rehome' is one move.
  const go = (path: string, force = false) => {
    roomScreenRef.current = path;
    const how = navFor(pathRef.current, path, force);
    if (how === 'stay') return;
    if (how === 'push') router.push(path);
    else if (how === 'rehome') {
      router.dismissTo('/');
      router.push(path);
    } else router.replace(path);
    pathRef.current = path; // until the navigator says so (two in a row)
  };
  // Home's Back to room, and a link to the room already in. Join opened by
  // a link tapped in the room sits over the room's screen: back down to it,
  // as it was (a drawing in progress and all), not a fresh copy over it. If
  // it isn't there, dismissTo puts it in Join's place.
  const returnToRoom = () => {
    if (!roomRef.current) return;
    const path = roomScreenRef.current;
    const here = pathRef.current;
    if (here === path) return;
    if (here === '/' || isRoomScreen(here)) return go(path, true);
    router.dismissTo(path);
    pathRef.current = path;
  };
  // Out of the room: home, unless the player is somewhere else already.
  const goHome = () => {
    if (isRoomScreen(pathRef.current)) router.dismissTo('/');
  };

  Object.assign(e, { go, returnToRoom, goHome } satisfies Partial<EngineFns>);
}
