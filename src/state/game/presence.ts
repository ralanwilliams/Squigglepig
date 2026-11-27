import { wireAvatar } from '../../avatar/avatar';
import { roomState, type Member } from '../../lib/rooms';
import {
  PROTOCOL,
  activeMembers as activeOf,
  clockLine,
  computeSkips as skipsFor,
  electKeeper as electKeeperOf,
  isGameOn,
  presentNames as presentOf,
  readyNames as readyOf,
} from '../rules';
import type { Engine, EngineFns } from './engine';
import { closedMessage } from './messages';

// ---- Who's here, and who keeps the clock ----
// The SERVER knows who is in the room (members); the channel's presence says
// who has the app on screen right now. The KEEPER, the phone that keeps the
// game's clock, is elected from the two (../rules electKeeper).
export function installPresence(e: Engine) {
  const {
    subscribedRef,
    awakeRef,
    channelRef,
    userIdRef,
    usernameRef,
    syncedRef,
    myAvatarRef,
    membersRef,
    presenceRef,
    isKeeperRef,
    keeperRef,
    gameNamesRef,
    skipRef,
    phaseRef,
    rosterRef,
    roomRef,
    dbPhaseRef,
    clockTimerRef,
    setGameNames,
    setMembersState,
  } = e;

  // Everyone still in the room (not left), oldest first: the round roster.
  const activeMembers = () => activeOf(membersRef.current);
  const orderedNames = () => activeMembers().map((m) => m.name);
  // The ones with the app open right now.
  const presentNames = () => presentOf(membersRef.current, presenceRef.current);
  // The ones here and caught up: who can judge (../rules readyNames).
  const readyNames = () => readyOf(membersRef.current, presenceRef.current);
  // User ids of players still in the room but away, optionally only those
  // named (this round's roster) — who gets a "your turn" notification.
  const awayIds = (names?: string[]) => {
    const here = new Set(presenceRef.current.map((p) => p.id));
    return activeMembers()
      .filter((m) => !here.has(m.id) && (!names || names.includes(m.name)))
      .map((m) => m.id);
  };
  const hasLeft = (name: string) => membersRef.current.some((m) => m.name === name && m.leftAt != null);

  // This phone in presence: here, and whether it's caught up. Never while
  // it's off screen: the room sees it as away, and doesn't wait on it.
  const track = () => {
    if (!subscribedRef.current || !awakeRef.current) return;
    channelRef.current?.track({
      userId: userIdRef.current,
      username: usernameRef.current,
      synced: syncedRef.current,
      avatar: wireAvatar(myAvatarRef.current),
      v: PROTOCOL,
    });
  };

  // Where this phone stands to step in for the keeper: 0 if it is the keeper,
  // 1, 2, … for the caught-up phones on screen after it (../rules clockLine),
  // -1 if it can't (off screen, or catching up itself).
  const clockRank = () => {
    if (isKeeperRef.current) return 0;
    if (!syncedRef.current || !awakeRef.current) return -1;
    const i = clockLine(membersRef.current, presenceRef.current, keeperRef.current).indexOf(usernameRef.current);
    return i < 0 ? -1 : i + 1;
  };

  const addGameNames = (...lists: string[][]) => {
    let added = false;
    for (const list of lists) {
      for (const n of list) {
        if (n && !gameNamesRef.current.has(n)) {
          gameNamesRef.current.add(n);
          added = true;
        }
      }
    }
    if (added) setGameNames([...gameNamesRef.current]);
  };

  // Who is out of this round's rotation (../rules computeSkips).
  const computeSkips = () => {
    skipRef.current = skipsFor(phaseRef.current, rosterRef.current, membersRef.current);
  };

  // Elect the clock's keeper from who's here (../rules electKeeper).
  const electKeeper = () => electKeeperOf(membersRef.current, presenceRef.current);

  const updateKeeper = () => {
    const name = electKeeper();
    const me = usernameRef.current;
    // Never while off screen (goAway): this phone has left presence, and the
    // room elects someone who's there.
    const keeps = name !== '' && name === me && awakeRef.current;
    const became = keeps && keeperRef.current !== me;
    keeperRef.current = name;
    isKeeperRef.current = keeps;
    // A phone that hands the clock over drops it, so it can arm a fresh one
    // if the role comes back to it.
    if (!keeps) e.clearClock();
    if (keeps && !syncedRef.current) {
      e.restore();
      return;
    }
    if (became && phaseRef.current !== 'lobby' && !clockTimerRef.current) {
      e.armForCurrentStage(false); // took over mid-round — resume the clock
    }
    // A new keeper saves the game at once: the copy on the server may be one a
    // keeper left as it went away, marked paused, which this replaces.
    if (became && isGameOn(phaseRef.current)) e.changed();
    // Someone leaving may be exactly what unblocks the current stage (a
    // skipped player is no longer waited for), so re-check completion now;
    // and someone coming or going may be the judge the reveal waits for, or
    // the last tied player the Pig Off waits on.
    e.maybeAdvanceStage();
    e.maybePigOffDone();
    e.maybeAutoRule();
    e.updateJudgeWait();
  };

  const setMembers = (list: Member[], elect = true) => {
    membersRef.current = [...list].sort((a, b) => a.joinedAt - b.joinedAt || a.name.localeCompare(b.name));
    setMembersState(membersRef.current);
    computeSkips();
    if (elect) updateKeeper();
  };

  // Fetch who's in the room again (the server says when it changes). If the
  // server has a game on and this phone doesn't, or the other way round,
  // this phone missed it starting or ending (it was off screen): catch up.
  const refreshMembers = async () => {
    const code = roomRef.current;
    if (!code) return;
    const res = await roomState(code);
    if (code !== roomRef.current) return;
    if (res.status === 'closed') return e.closeLocally(closedMessage(code, res.reason));
    if (res.status !== 'ok') return;
    dbPhaseRef.current = res.phase;
    setMembers(res.members);
    if ((res.phase === 'playing') !== isGameOn(phaseRef.current)) e.resync();
  };

  Object.assign(e, {
    track,
    orderedNames,
    presentNames,
    readyNames,
    awayIds,
    hasLeft,
    clockRank,
    addGameNames,
    computeSkips,
    updateKeeper,
    setMembers,
    refreshMembers,
  } satisfies Partial<EngineFns>);
}
