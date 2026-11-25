import { supabase } from '../../lib/supabase';
import { stepAway, touchRoom } from '../../lib/rooms';
import { clearRoomNotifications } from '../../lib/push';
import { PROBE_MS } from './constants';
import type { Engine, EngineFns } from './engine';

// ---- Off screen and back ----
// GameProvider calls goAway when the app goes to the background and comeBack
// when it's on screen again.
export function installAppState(e: Engine) {
  const { roomRef, subscribedRef, channelRef, awayCallRef, setResuming } = e;

  // Off screen: stand down, and leave presence at once, so the room sees this
  // player as away (their notifications start, the next one in line keeps the
  // clock, someone else judges) instead of waiting on a phone that's asleep.
  // Their seat in the game is kept: away players stay in the rotation. The
  // server hears too (stepAway): when everyone in a game is away, it tells
  // them all it's paused. Until it's caught up again, the game screens'
  // clocks don't run out (`resuming`).
  const goAway = () => {
    const code = roomRef.current;
    if (!code) return;
    e.standDown();
    setResuming(true);
    if (subscribedRef.current) void channelRef.current?.untrack();
    awayCallRef.current = stepAway(code);
  };

  // The connection may have died while the phone slept and still look open:
  // the Realtime client only notices after a missed heartbeat, up to ~50 s
  // later, and everything sent meanwhile is lost. So a heartbeat goes now, and
  // if it's still unanswered after PROBE_MS a second one goes, which, with
  // one pending, is the client's heartbeat timeout: it gives up on that
  // connection and opens a fresh one at once, and the room's channel rejoins
  // by itself (its SUBSCRIBED catches up). The heartbeat also brings the
  // connection's sign-in token up to date.
  const checkConnection = () => {
    const realtime = supabase.realtime;
    if (!realtime.isConnected()) {
      realtime.connect();
      return;
    }
    void realtime.sendHeartbeat();
    setTimeout(() => {
      if (realtime.isConnected() && realtime.pendingHeartbeatRef) void realtime.sendHeartbeat();
    }, PROBE_MS);
  };

  // Back on screen: that counts as activity (and says the player is back:
  // after the server has heard they went away, if that's still on its way, so
  // the two can't land the wrong way round), the room's notification is out
  // of date, the connection may have died while the phone slept, and the game
  // may have moved on without this phone, so it rejoins presence (not caught
  // up) and catches up (resync; if the game started or ended meanwhile,
  // refreshMembers notices).
  const comeBack = () => {
    const code = roomRef.current;
    if (!code) return;
    clearRoomNotifications();
    checkConnection();
    void awayCallRef.current.finally(() => {
      if (roomRef.current === code) touchRoom(code, true);
    });
    e.resync(true);
    e.refreshMembers();
  };

  Object.assign(e, { goAway, comeBack } satisfies Partial<EngineFns>);
}
