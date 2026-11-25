import { endGameOnServer, nudge, startGameOnServer } from '../../lib/rooms';
import { showToast } from '../../components/Toast';
import { MIN_PLAYERS, PROTOCOL, gameRules, outdatedPlayers, tiedLeaders, type Cell, type Rules } from '../rules';
import type { Engine, EngineFns } from './engine';

// ---- Games and rounds (the keeper emits, everyone reacts) ----
export function installRounds(e: Engine) {
  const {
    roomRef,
    roundRef,
    revealIndexRef,
    chainsRef,
    scoresRef,
    targetRef,
    rulesRef,
    pigOffUsedRef,
    gameNamesRef,
    dbPhaseRef,
    syncedRef,
    rosterRef,
    leaderRef,
    advancedForRef,
    membersRef,
    versionsRef,
    startingRef,
    setTarget,
    setRules,
    setScores,
    setChains,
    setGameNames,
    setRound,
    setRoster,
    setRevealIndex,
  } = e;

  // The game is over: everyone to the scoreboard, the room opens to newcomers
  // again and the server forgets the game, and anyone away is told.
  const endGame = (round: number) => {
    e.send('game-over', { round });
    endGameOnServer(roomRef.current);
    nudge(roomRef.current, 'over', e.awayIds());
  };

  // The roster is rebuilt from the room's players at the start of every round
  // (away ones included), so anyone who has left the room is naturally dropped
  // from the rotation. If too few remain, end the game. The round number moves
  // on when the 'round' message comes back (onRound), on every phone alike,
  // the keeper's included. Anyone away is told to come back and write their
  // prompt (a server whose rooms.sql predates 'prompt' ignores it).
  const nextRound = () => {
    if (!e.actsForClock()) return;
    const next = roundRef.current + 1;
    const roster = e.orderedNames();
    if (roster.length < MIN_PLAYERS) return endGame(roundRef.current);
    e.send('round', { round: next, roster, leader: roster[next % roster.length] });
    nudge(roomRef.current, 'prompt', e.awayIds(roster));
  };

  // The round's last chain is scored: the game is over if anyone has reached
  // the points to win, otherwise the next round. Over with two or more of
  // those still in sharing the top score, a Pig Off settles it first.
  const finishRound = () => {
    if (!e.actsForClock() || revealIndexRef.current < chainsRef.current.length) return;
    const won = Object.values(scoresRef.current).some((v) => v >= targetRef.current);
    if (!won) return nextRound();
    const tied = tiedLeaders(scoresRef.current, e.orderedNames());
    if (tied.length > 1) e.startPigOff(tied, 1);
    else endGame(roundRef.current);
  };

  // ---- Broadcast handlers (fire on every client, including the sender) ----
  // A new game: scores and all start over, and round 0 starts at once, with
  // the room's players as its roster (every phone has the same list).
  const onToPrompts = (t: number, playedTo: Rules, roster: string[]) => {
    targetRef.current = t;
    setTarget(t);
    rulesRef.current = playedTo;
    setRules(playedTo);
    e.forgetDocks();
    scoresRef.current = {};
    setScores({});
    chainsRef.current = [];
    setChains([]);
    e.setPigOffBoth(null);
    pigOffUsedRef.current = [];
    e.forgetTurns();
    gameNamesRef.current = new Set();
    setGameNames([]);
    dbPhaseRef.current = 'playing';
    // A new game is the whole state: anyone who was still catching up is caught up.
    if (!syncedRef.current) e.markSynced();
    onRound(0, roster, roster[0] ?? '');
  };

  // A round starts with its prompts: chain c is OWNED by roster[c], who writes
  // the prompt it starts from (stage 0) and judges it at the reveal. Nobody
  // draws their own: stage 1 hands each chain to the player after its owner.
  const onRound = (r: number, roster: string[], lead: string) => {
    roundRef.current = r;
    setRound(r);
    e.forgetTurns();
    e.forgetDocks();
    rosterRef.current = roster;
    setRoster(roster);
    e.addGameNames(roster);
    leaderRef.current = lead;
    advancedForRef.current = -1; // stages start at 0 (the prompts) this round
    revealIndexRef.current = 0;
    setRevealIndex(0);
    chainsRef.current = roster.map(() => ({ cells: [] as Cell[] }));
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    e.routeForStage(0);
    e.computeSkips();
    e.changed();
  };

  // The game is over. (Whoever sent this has told the server: endGame. A
  // 2.9.0 keeper tells it as its own message comes back.)
  const onGameOver = () => {
    e.clearClock();
    dbPhaseRef.current = 'lobby';
    e.go('/scoreboard');
    e.beginStage('gameover');
  };

  // ---- Public actions ----
  // Once per tap: a second tap while the first is still on its way does
  // nothing (two players tapping New game together is onToPrompts' to sort).
  const startGame = async (t: number) => {
    const code = roomRef.current;
    if (!code || startingRef.current || e.orderedNames().length < MIN_PLAYERS) return;
    const old = outdatedPlayers(membersRef.current, versionsRef.current);
    if (old.length) {
      showToast(`${old.join(', ')} ${old.length === 1 ? 'needs' : 'need'} to update Squigglepig first.`, 4000);
      return;
    }
    startingRef.current = true;
    try {
      // The server closes the room to newcomers first.
      if (!(await startGameOnServer(code))) {
        showToast('Couldn’t start the game. Check your connection and try again.', 3000);
        return;
      }
      if (code !== roomRef.current) return;
      dbPhaseRef.current = 'playing';
      // The scoring rules every phone in the game knows (../rules gameRules).
      const rules = gameRules(membersRef.current, versionsRef.current);
      e.send('to-prompts', { target: Math.max(1, t), rules, roster: e.orderedNames(), v: PROTOCOL });
      nudge(code, 'start', e.awayIds());
    } finally {
      startingRef.current = false;
    }
  };

  Object.assign(e, {
    endGame,
    finishRound,
    onToPrompts,
    onRound,
    onGameOver,
    startGame,
  } satisfies Partial<EngineFns>);
}
