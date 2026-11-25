import { PACK, pigOffEntry } from '../../arcade/games/memory/pack';
import { similarity } from '../../arcade/games/memory/score';
import { nudge, startGameOnServer, touchRoom } from '../../lib/rooms';
import { showToast } from '../../components/Toast';
import { PIG_OFF_TRIES, pigOffOutcome } from '../rules';
import type { PigOff } from '../wire';
import type { Engine, EngineFns } from './engine';

// ---- Pig Off (../rules): the tie-breaker at the end of a game ----
export function installPigOff(e: Engine) {
  const {
    pigOffRef,
    pigOffUsedRef,
    roundRef,
    roomRef,
    stageRef,
    isKeeperRef,
    phaseRef,
    scoresRef,
    usernameRef,
    startingRef,
    dbPhaseRef,
    targetRef,
    setPigOff,
    setStage,
    setTurn,
    setScores,
  } = e;

  // The Pig Off on now, as every phone has it, and as the screens see it (a copy).
  const setPigOffBoth = (p: PigOff | null) => {
    pigOffRef.current = p;
    setPigOff(p ? { ...p, drawings: { ...p.drawings }, matches: p.matches && { ...p.matches } } : null);
  };

  // The keeper starts each attempt (the drawing for it, from the pack's easier
  // part, not one this game has used), and the tied players who are away are
  // told it's their turn to draw.
  const startPigOff = (players: string[], attempt: number) => {
    if (!e.actsForClock()) return;
    const entry = pigOffEntry(pigOffUsedRef.current);
    e.send('pigoff', { round: roundRef.current, attempt, players, entry });
    nudge(roomRef.current, 'draw', e.awayIds(players));
  };

  // The tied players still in the room (one who taps Leave game drops out of it).
  const pigOffPlayers = () => {
    const names = e.orderedNames();
    return (pigOffRef.current?.players ?? []).filter((n) => names.includes(n));
  };

  // Every phone, as an attempt starts.
  const onPigOff = (attempt: number, players: string[], entry: number) => {
    e.clearClock();
    if (!pigOffUsedRef.current.includes(entry)) pigOffUsedRef.current.push(entry);
    setPigOffBoth({ attempt, players, entry, drawings: {}, matches: null, winner: '' });
    stageRef.current = attempt;
    setStage(attempt);
    setTurn(null);
    e.go('/pigoff');
    e.beginStage('pigoff');
    e.changed();
  };

  // A tied player's drawing from memory, as every phone hears it. The keeper
  // scores the attempt once every tied player still in has drawn.
  const onPigOffDrawing = (name: string, strokes: string[]) => {
    const po = pigOffRef.current;
    if (!po || po.matches || !po.players.includes(name) || po.drawings[name]) return;
    po.drawings[name] = strokes;
    setPigOffBoth(po);
    e.changed();
    maybePigOffDone();
  };
  const pigOffAllIn = () => {
    const po = pigOffRef.current;
    return !!po && !po.matches && pigOffPlayers().every((n) => !!po.drawings[n]);
  };
  const maybePigOffDone = () => {
    if (isKeeperRef.current && phaseRef.current === 'pigoff' && pigOffAllIn()) sendPigOffResult();
  };

  // The keeper scores every drawing against the one shown (the solo game's
  // score.ts; one that never came is blank, 0) and says who won, if anyone
  // did outright, so every phone shows and counts the same.
  const sendPigOffResult = () => {
    const po = pigOffRef.current;
    if (!e.actsForClock() || !po || po.matches) return;
    const shown = PACK[po.entry]?.strokes ?? [];
    const players = pigOffPlayers();
    const matches = Object.fromEntries(players.map((n) => [n, similarity(po.drawings[n] ?? [], shown)]));
    const drawings = Object.fromEntries(players.map((n) => [n, po.drawings[n] ?? []]));
    const { winner } = pigOffOutcome(matches, players);
    e.send('pigoff-result', { round: roundRef.current, attempt: po.attempt, matches, drawings, winner });
  };

  // Every phone: the results. The winner takes a point, which settles the
  // tie, and the results show (their own clock).
  const onPigOffResult = (matches: Record<string, number>, drawings: Record<string, string[]>, winner: string) => {
    const po = pigOffRef.current;
    if (!po || po.matches) return;
    po.matches = matches;
    po.drawings = { ...po.drawings, ...drawings };
    po.players = po.players.filter((n) => n in matches);
    po.winner = winner && winner in matches ? winner : '';
    if (po.winner) {
      scoresRef.current = { ...scoresRef.current, [po.winner]: (scoresRef.current[po.winner] ?? 0) + 1 };
      setScores({ ...scoresRef.current });
    }
    setPigOffBoth(po);
    e.beginStage('pigoff');
    e.changed();
  };

  // The keeper, when the results have had their time: the game is over if
  // someone won (or it's been tied PIG_OFF_TRIES times: they share the win,
  // or only one of them is left), else again with just the ones still tied.
  const pigOffNext = () => {
    const po = pigOffRef.current;
    if (!e.actsForClock() || !po?.matches) return;
    const names = e.orderedNames();
    const tied = pigOffOutcome(po.matches, po.players).tied.filter((n) => names.includes(n));
    if (po.winner || tied.length < 2 || po.attempt >= PIG_OFF_TRIES) e.endGame(roundRef.current);
    else startPigOff(tied, po.attempt + 1);
  };

  // The keeper's clock ran out: the drawing time (score what's in), or the results.
  const pigOffTimeUp = () => {
    if (!pigOffRef.current?.matches) sendPigOffResult();
    else pigOffNext();
  };

  // This player's drawing, handed in once (Done, or the clock running out).
  const submitPigOff = (strokes: string[]) => {
    const po = pigOffRef.current;
    if (!po || po.matches || !po.players.includes(usernameRef.current) || po.drawings[usernameRef.current]) return;
    e.send('pigoff-drawing', { round: roundRef.current, attempt: po.attempt, name: usernameRef.current, strokes });
    touchRoom(roomRef.current);
  };

  // Dev builds only (the ghost players' panel, src/dev/local): straight from
  // the lobby into a Pig Off between this player (the host) and `name`, both
  // on the points to win, to test it without playing a whole game. The room
  // is closed to newcomers as a real start does. This phone opens the Pig
  // Off itself rather than waiting for its own message back, which a phone
  // in the lobby would take as a game it missed the start of; when the echo
  // does come, it's already there and ignores it.
  const devTieWith = __DEV__
    ? async (name: string) => {
        const code = roomRef.current;
        const me = usernameRef.current;
        // From the lobby, or back in it after a game (still 'gameover' there, as startGame allows).
        const p = phaseRef.current;
        if (!code || startingRef.current || (p !== 'lobby' && p !== 'gameover') || !e.actsForClock() || !e.orderedNames().includes(name)) return;
        startingRef.current = true; // a second tap while this one's on its way does nothing
        try {
          if (!(await startGameOnServer(code))) {
            showToast('Couldn’t start the Pig Off. Check your connection and try again.', 3000);
            return;
          }
          if (code !== roomRef.current) return;
          dbPhaseRef.current = 'playing';
          scoresRef.current = { [me]: targetRef.current, [name]: targetRef.current };
          setScores({ ...scoresRef.current });
          const players = [me, name];
          const entry = pigOffEntry(pigOffUsedRef.current);
          e.send('pigoff', { round: roundRef.current, attempt: 1, players, entry });
          onPigOff(1, players, entry);
        } finally {
          startingRef.current = false;
        }
      }
    : undefined;

  Object.assign(e, {
    setPigOffBoth,
    startPigOff,
    onPigOff,
    onPigOffDrawing,
    onPigOffResult,
    pigOffAllIn,
    maybePigOffDone,
    sendPigOffResult,
    pigOffNext,
    pigOffTimeUp,
    submitPigOff,
    devTieWith,
  } satisfies Partial<EngineFns>);
}
