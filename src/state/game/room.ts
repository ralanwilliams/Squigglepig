import { supabase, supabaseReady } from '../../lib/supabase';
import { createRoom, joinRoom, leaveRoomOnServer, roomState } from '../../lib/rooms';
import { clearSession, saveSession, savePendingLeave, takePendingLeave } from '../../lib/session';
import { clearRoomNotifications, registerForPush } from '../../lib/push';
import { closeConfirm, confirmLeave } from '../../lib/confirm';
import { showToast } from '../../components/Toast';
import { cleanName, cleanRoomCode, isRoomCode } from '../../lib/text';
import { isRoomScreen, leaveCost } from '../nav';
import { MIN_PLAYERS, PROTOCOL, isGameOn } from '../rules';
import type { Engine, EngineFns } from './engine';
import type { EntryStatus } from './types';

// ---- In and out of a room ----
export function installRoom(e: Engine) {
  const {
    roomRef,
    usernameRef,
    userIdRef,
    roundRef,
    phaseRef,
    syncedRef,
    versionsRef,
    dbPhaseRef,
    pathRef,
    advanceTimerRef,
    snapTimerRef,
    judgeTimerRef,
    reopenTimerRef,
    heldRef,
    dueRef,
    rulesRef,
    outboxRef,
    channelRef,
    subscribedRef,
    membersRef,
    presenceRef,
    isKeeperRef,
    keeperRef,
    restoringRef,
    rosterRef,
    skipRef,
    gameNamesRef,
    chainsRef,
    scoresRef,
    pigOffUsedRef,
    setPhase,
    setUsername,
    setRoom,
    setStatus,
    setStatusDetail,
    setRoster,
    setRound,
    setMembersState,
    setPresentIds,
    setReadyIds,
    setGameNames,
    setAvatars,
    setChains,
    setScores,
    setPrev,
    setTurn,
    setJudgeWait,
    setRules,
    setResuming,
  } = e;

  // Create a room (room = null) or join one by its code. `rejoin` only goes
  // back to a room this phone is still in (the home screen, at launch): if
  // it isn't any more, that's 'not_found', never a fresh join of a new room
  // that happens to have the same code. Resolves to how it went;
  // entryMessage says what to tell the player.
  const enterRoom = async (roomCode: string | null, name: string, rejoin = false): Promise<EntryStatus> => {
    const user = cleanName(name);
    const code = roomCode === null ? null : cleanRoomCode(roomCode);
    // The code first: on Join Game, a missing code is the thing to explain.
    if (code === '') return 'no_code';
    if (code !== null && !isRoomCode(code)) return 'bad_code';
    if (!user) return 'no_name';
    if (!supabaseReady) return 'no_keys';
    if (code && code === roomRef.current) {
      // Already in it: back to wherever that game is.
      e.returnToRoom();
      return 'ok';
    }
    const res = code ? await joinRoom(code, user, rejoin) : await createRoom(user);
    if (res.status !== 'ok') return res.status;
    if (roomRef.current) resetLocal(); // the server has already taken us out of the old room
    await connect(res.room, res.name, res.userId);
    return 'ok';
  };

  const connect = async (code: string, user: string, userId: string) => {
    usernameRef.current = user;
    userIdRef.current = userId;
    roomRef.current = code;
    roundRef.current = 0;
    phaseRef.current = 'lobby';
    syncedRef.current = false;
    setPhase('lobby');
    setUsername(user);
    setRoom(code);
    setStatus('connecting');
    setStatusDetail('');
    saveSession({ room: code, username: user });
    versionsRef.current.set(userId, PROTOCOL);
    // In the room on screen: its notification is out of date.
    clearRoomNotifications();
    // Joining or creating a room already took the server out of every other
    // one, so a Leave game still waiting to be sent has nothing left to do
    // (and sent later, it would take the player out of this room if it's the
    // same one they've come back to).
    takePendingLeave();

    // Who's in the room, before the channel opens, so the host shows at once
    // and the first presence sync can already tell who keeps the clock.
    const st = await roomState(code);
    if (roomRef.current !== code) return;
    if (st.status === 'ok') {
      dbPhaseRef.current = st.phase;
      e.setMembers(st.members, false);
    }

    // The channel is members-only (supabase/rooms.sql), so it needs the
    // guest's token before it's opened.
    await supabase.realtime.setAuth();
    if (roomRef.current !== code) return;
    e.openChannel(code, userId);

    // The lobby goes right over home (Create or Join go, and whatever Join
    // was opened over), so Back from it goes home, still in the room. A game
    // already on (coming back to it
    // after the app closed) shows the waiting screen until the room's answer
    // brings this phone to the game's own screen (applyState): not the lobby
    // first, and then the game.
    e.go(dbPhaseRef.current === 'playing' ? '/waiting' : '/lobby', true);
    // The first lobby is where the phone asks to send notifications.
    registerForPush(true);
  };

  // Forget the room on this phone (the server is told separately, or already knows).
  const resetLocal = () => {
    // "Leave?" has no room left to ask about. (Elsewhere, the question is a solo
    // game's own, which carries on.)
    if (isRoomScreen(pathRef.current)) closeConfirm();
    e.clearClock();
    e.stopAsking();
    e.forgetAnswers();
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = null;
    if (judgeTimerRef.current) clearTimeout(judgeTimerRef.current);
    judgeTimerRef.current = null;
    if (reopenTimerRef.current) clearTimeout(reopenTimerRef.current);
    reopenTimerRef.current = null;
    e.forgetTurns();
    e.forgetDocks();
    heldRef.current = null;
    dueRef.current = { key: '', since: 0, acted: 0 };
    versionsRef.current = new Map();
    rulesRef.current = 1;
    outboxRef.current = [];
    clearSession();
    const channel = channelRef.current;
    channelRef.current = null;
    subscribedRef.current = false;
    if (channel) supabase.removeChannel(channel);
    roomRef.current = '';
    membersRef.current = [];
    presenceRef.current = [];
    isKeeperRef.current = false;
    keeperRef.current = '';
    syncedRef.current = false;
    restoringRef.current = false;
    dbPhaseRef.current = 'lobby';
    phaseRef.current = 'lobby';
    rosterRef.current = [];
    setRoster([]);
    skipRef.current = new Set();
    gameNamesRef.current = new Set();
    chainsRef.current = [];
    scoresRef.current = {};
    roundRef.current = 0;
    setRound(0);
    setPhase('lobby');
    setMembersState([]);
    setPresentIds([]);
    setReadyIds([]);
    setGameNames([]);
    setAvatars({});
    setRoom('');
    setChains([]);
    setScores({});
    setPrev(null);
    setTurn(null);
    setJudgeWait('');
    e.setPigOffBoth(null);
    pigOffUsedRef.current = [];
    setRules(1);
    setResuming(false);
  };

  // Leave game: the only way out of a room, short of it closing. Back to the
  // home screen.
  const leaveRoom = () => {
    const code = roomRef.current;
    if (code) {
      leaveRoomOnServer(code).then((ok) => {
        if (!ok) savePendingLeave(code); // offline: told the next time the app opens
      });
    }
    resetLocal();
    e.goHome();
  };
  // Leave game, and Back during a game, ask first. The game carries on behind
  // the question: it has other players waiting on it. What it costs goes by the
  // server's phase too: a phone back in a game is in the lobby until it catches
  // up, but the server won't let it rejoin. If too few would be left to play on
  // without this player, the game ends for everyone (rooms.sql leave_room_as),
  // and the question says so.
  const askToLeave = () => {
    const gameOn = isGameOn(phaseRef.current) || dbPhaseRef.current === 'playing';
    confirmLeave(leaveCost(gameOn, gameOn && e.orderedNames().length - 1 < MIN_PLAYERS), leaveRoom);
  };

  // The room closed under us (idle too long, or too few players left in its
  // game to play on): back to the home screen, from the room's screens (a
  // player looking around elsewhere stays there), saying why.
  const closeLocally = (message: string) => {
    if (!roomRef.current) return;
    resetLocal();
    e.goHome();
    showToast(message, 5000);
  };

  Object.assign(e, {
    enterRoom,
    resetLocal,
    leaveRoom,
    askToLeave,
    closeLocally,
  } satisfies Partial<EngineFns>);
}
