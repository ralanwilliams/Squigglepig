import { nudge, touchRoom } from '../../lib/rooms';
import { cleanPhrase } from '../../lib/text';
import { shuffle } from '../../lib/shuffle';
import {
  chainForStage,
  finalStage,
  isEmptyTurn,
  isGameOn,
  isLate,
  isTurnPhase,
  mergeCell,
  phaseForStage,
  playerForChain,
  prevFor,
  stillToGo,
  type Cell,
  type Chain,
} from '../rules';
import { FALLBACK_PROMPTS, HAND_IN_RETRY_MS, HAND_IN_TRIES } from './constants';
import type { Engine, EngineFns } from './engine';
import { sameTurn, turnKey, type Handed, type Turn } from './types';

// ---- Turns: the prompts, then drawing and guessing in turn ----
export function installTurns(e: Engine) {
  const {
    stageRef,
    rosterRef,
    usernameRef,
    myChainRef,
    roundRef,
    chainsRef,
    phaseRef,
    handedRef,
    mendRef,
    deadlinesRef,
    roomRef,
    skipRef,
    advancedForRef,
    isKeeperRef,
    revealIndexRef,
    rulingsRef,
    awakeRef,
    syncedRef,
    heldRef,
    setStage,
    setPrev,
    setTurn,
    setChains,
  } = e;

  // ---- Chain assignment (../rules: chainForStage, prevFor) ----
  const routeForStage = (s: number) => {
    stageRef.current = s;
    setStage(s);
    const roster = rosterRef.current;
    const n = roster.length;
    // Stage 0 = the round's prompts: write the one the chain you own starts from.
    const p = phaseForStage(s);
    const myPos = roster.indexOf(usernameRef.current);
    if (myPos < 0 || n === 0) {
      // Not part of this round's roster -> watch.
      myChainRef.current = -1;
      setPrev(null);
      setTurn(null);
      e.go('/waiting');
      e.beginStage(p);
      return;
    }
    // chainForStage(pos, 0) === pos, so the prompt you write starts the very
    // chain you own — the one you'll judge at the end. The prompts screen stays
    // up once it's in (it says Player ready) until everyone's is.
    const c = chainForStage(myPos, s, n);
    myChainRef.current = c;
    setTurn({ round: roundRef.current, stage: s, chain: c });
    if (s === 0) {
      setPrev(null);
      e.go('/prompts');
      e.beginStage('prompts');
      return;
    }
    setPrev(prevFor(chainsRef.current[c], s));
    // A turn that's in already (handed in before the app closed, and caught
    // up since): wait with everyone else, rather than be handed it again.
    e.go(chainsRef.current[c]?.cells[s] ? '/waiting' : p === 'draw' ? '/drawing' : '/guessing');
    e.beginStage(p);
  };

  // The turn this player is on right now, if any.
  const currentTurn = (): Turn | null =>
    isTurnPhase(phaseRef.current) && myChainRef.current >= 0
      ? { round: roundRef.current, stage: stageRef.current, chain: myChainRef.current }
      : null;

  // ---- Handing a turn in, and mending one that went missing ----
  // A turn goes out on the channel and comes back to this phone too (every
  // phone hears its own messages): back, it reached the room. If it doesn't
  // come back within HAND_IN_RETRY_MS it's sent again, a couple of times,
  // while its round lasts.
  const sendHanded = (h: Handed) => {
    h.tries += 1;
    e.send('cell', { round: h.round, chain: h.chain, stage: h.stage, cell: h.cell });
    setTimeout(() => {
      if (handedRef.current.get(turnKey(h)) !== h || h.echoed || h.tries >= HAND_IN_TRIES) return;
      if (!roomRef.current || roundRef.current !== h.round || !isGameOn(phaseRef.current)) return;
      sendHanded(h);
    }, HAND_IN_RETRY_MS);
  };
  const handIn = (t: Turn, cell: Cell) => {
    const h: Handed = { ...t, cell, echoed: false, tries: 0 };
    handedRef.current.set(turnKey(t), h);
    sendHanded(h);
  };

  // The keeper's copy of the game (its next-stage message, the reveal's
  // chains, its answer to a phone catching up) has turn `t` empty, but this
  // phone has it with something in it: the turn never reached the keeper,
  // which filled it in blank. Send it again so every phone mends its copy
  // (mergeCell keeps the real one). The player who handed it in sends it at
  // once; anyone else who has it waits a moment and only sends it if nobody
  // has meanwhile (the player may be away). Once per turn.
  const mend = (t: Turn, incoming: Cell | undefined) => {
    if (incoming && !isEmptyTurn(incoming)) return;
    const key = turnKey(t);
    if (mendRef.current.has(key)) return;
    const mine = handedRef.current.get(key);
    const have = mine?.cell ?? chainsRef.current[t.chain]?.cells[t.stage];
    if (!have || isEmptyTurn(have)) return;
    const resend = () => {
      mendRef.current.set(key, null);
      if (!roomRef.current || roundRef.current !== t.round || !isGameOn(phaseRef.current)) return;
      console.log('[game] mending turn', key);
      e.send('cell', { round: t.round, chain: t.chain, stage: t.stage, cell: have });
    };
    if (mine) resend();
    else mendRef.current.set(key, setTimeout(resend, 400 + Math.random() * 1200));
  };
  // A turn this phone is waiting to send again arrived with something in it
  // (someone else mended it first): nobody else need. (A turn simply handed
  // in leaves mendRef alone, so it can still be mended if the keeper turns
  // out to have missed it.)
  const mended = (key: string) => {
    const pending = mendRef.current.get(key);
    if (pending === undefined) return;
    if (pending) clearTimeout(pending);
    mendRef.current.set(key, null);
  };
  const forgetTurns = () => {
    handedRef.current.clear();
    for (const pending of mendRef.current.values()) if (pending) clearTimeout(pending);
    mendRef.current.clear();
    deadlinesRef.current.clear();
  };

  // Every phone's copy of each turn, checked against the keeper's (onAdvance).
  const mendAll = (incoming: Chain[], upTo: number) => {
    const round = roundRef.current;
    incoming.forEach((chain, c) => {
      for (let s = 1; s <= upTo; s++) mend({ round, chain: c, stage: s }, chain.cells[s]);
    });
  };

  // ---- Moving the stage on (the keeper emits, everyone reacts) ----
  // Who is responsible for chain c this stage (the inverse of chainForStage).
  const assignedPlayer = (c: number, s: number) => playerForChain(rosterRef.current, c, s);

  const forceAdvance = () => {
    if (!e.actsForClock()) return;
    const s = stageRef.current;
    const n = rosterRef.current.length;
    // Fill any missing cells so the chains stay well-formed, under the name of
    // the player who owed each one: a stand-in prompt (FALLBACK_PROMPTS, none
    // used twice in a round), an empty drawing or guess, a skipped turn for
    // someone out of the rotation, or one marked `left` for someone who left
    // when too few would have carried on to take them out of it.
    const taken = new Set(chainsRef.current.map((ch) => (ch.cells[0]?.kind === 'prompt' ? ch.cells[0].text : '')));
    const spare = shuffle(FALLBACK_PROMPTS.filter((text) => !taken.has(text)));
    chainsRef.current.forEach((ch, c) => {
      if (ch.cells[s]) return;
      const who = n ? (assignedPlayer(c, s) ?? '') : '';
      if (s === 0) {
        ch.cells[0] = { kind: 'prompt', text: spare.shift() ?? FALLBACK_PROMPTS[c % FALLBACK_PROMPTS.length], author: who };
        return;
      }
      const mark = skipRef.current.has(who) ? { skip: true as const } : e.hasLeft(who) ? { left: true as const } : {};
      ch.cells[s] =
        s % 2 === 1
          ? { kind: 'drawing', data: '', author: who, ...mark }
          : { kind: 'caption', text: '', author: who, ...mark };
    });
    doAdvance();
  };

  // The prompts (stage 0), then production runs stages 1..finalStage(n)
  // (../rules). A new turn: everyone in the rotation who's away is told it's
  // their turn.
  const doAdvance = () => {
    if (!e.actsForClock()) return;
    const s = stageRef.current;
    if (advancedForRef.current >= s) return; // already advanced past this stage
    advancedForRef.current = s;
    const n = rosterRef.current.length;
    const round = roundRef.current;
    if (s >= finalStage(n)) {
      e.send('to-reveal', { round, chains: chainsRef.current });
    } else {
      e.send('advance', { round, stage: s + 1, cells: chainsRef.current.map((ch) => ch.cells[s]) });
      nudge(roomRef.current, phaseForStage(s + 1) === 'draw' ? 'draw' : 'guess', e.awayIds(rosterRef.current));
    }
  };

  // Whether every chain has its cell for this stage, or its turn belongs to
  // someone out of the rotation: nobody still to go (../rules stillToGo).
  const stageSettled = () =>
    rosterRef.current.length > 0 &&
    stillToGo(rosterRef.current, chainsRef.current, stageRef.current, skipRef.current).length === 0;

  // Keeper: advance the stage as soon as it's settled (every prompt is in, or
  // every drawing or guess). Away players are waited for until the clock runs
  // out (forceAdvance). Runs both when a cell lands and when the room's list
  // changes.
  const maybeAdvanceStage = () => {
    if (!isKeeperRef.current) return;
    if (!isTurnPhase(phaseRef.current)) return;
    const settled = stageSettled();
    const filled = chainsRef.current.filter((ch) => ch.cells[stageRef.current]).length;
    console.log('[game] stage', stageRef.current, '—', filled, 'of', rosterRef.current.length, 'cells in, settled:', settled);
    if (settled) {
      e.clearClock();
      forceAdvance(); // fills the skipped players' turns, then advances
    }
  };

  // ---- Broadcast handlers (fire on every client, including the sender) ----
  // A turn handed in (or sent again to mend the room's copy). One already
  // ruled at the reveal stays as it was judged.
  const onCell = (chain: number, s: number, cell: Cell) => {
    if (!chainsRef.current[chain]) return;
    const key = turnKey({ round: roundRef.current, chain, stage: s });
    const mine = handedRef.current.get(key);
    if (mine && cell.author === usernameRef.current) mine.echoed = true; // it reached the room
    if (!isEmptyTurn(cell)) mended(key);
    if (phaseRef.current === 'reveal' && chain === revealIndexRef.current && rulingsRef.current[s] !== undefined) return;
    chainsRef.current[chain].cells[s] = mergeCell(chainsRef.current[chain].cells[s], cell) as Cell;
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    if (s === stageRef.current) maybeAdvanceStage();
    e.changed();
  };

  // The keeper's copy of the stage just played comes with the next one: a
  // turn it has empty that this phone has real is kept (mergeCell), and sent
  // again so the keeper and everyone else get it too (mend).
  const onAdvance = (newStage: number, cells: Cell[]) => {
    const round = roundRef.current;
    cells.forEach((cell, i) => {
      if (!chainsRef.current[i] || !cell) return;
      mend({ round, chain: i, stage: newStage - 1 }, cell);
      chainsRef.current[i].cells[newStage - 1] = mergeCell(chainsRef.current[i].cells[newStage - 1], cell) as Cell;
    });
    setChains(chainsRef.current.map((c) => ({ cells: [...c.cells] })));
    routeForStage(newStage);
    e.changed();
  };

  // ---- Public actions ----
  // Hand in a turn: a prompt at the round's start, a drawing (JSON) on a
  // drawing stage, a guess on a guessing one. A prompt stays on its screen,
  // which says Player ready until everyone's is in. `forTurn` is the turn the screen was opened for (its
  // `turn`); without it, the current one. One handed in after its turn has
  // passed (Submit tapped, or the clock running out, just as the stage moved
  // on; or the screen closing with a drawing on it) still goes to that turn,
  // where it mends the blank the keeper filled in (mergeCell), and the player
  // stays where the game has taken them. An empty one that late is nothing
  // to send. `closing`: handed in by a screen as it closes, which never
  // moves the player (the screen is going because they're already going
  // somewhere).
  //
  // But one handed in long after its own clock ran out (isLate) comes from a
  // screen that slept through its deadline, waking before the phone has
  // caught up: it counts only if the room still has that stage open, which
  // the phone can't tell until it has caught up, so it's held until then
  // (markSynced). If the room has moved on, the turn was missed.
  const submitCell = (data: string, forTurn?: Turn | null, closing = false) => {
    // Nothing is handed in from off screen (a screen closing as the game
    // moves on behind the phone's back): a player who isn't there misses the turn.
    if (!awakeRef.current) return;
    const now = currentTurn();
    const t = forTurn ?? now;
    if (!t || t.chain < 0 || t.stage < 0 || !roomRef.current) return;
    const stagePhase = phaseForStage(t.stage);
    const cell: Cell =
      stagePhase === 'prompts'
        ? { kind: 'prompt', text: cleanPhrase(data), author: usernameRef.current }
        : stagePhase === 'draw'
          ? { kind: 'drawing', data, author: usernameRef.current }
          : { kind: 'caption', text: cleanPhrase(data), author: usernameRef.current };
    // An empty prompt is no prompt: a stand-in takes its place when the clock runs out.
    if (cell.kind === 'prompt' && !cell.text) return;
    const current = sameTurn(t, now);
    if (handedRef.current.has(turnKey(t))) return;
    if (isLate(deadlinesRef.current.get(turnKey(t)) ?? 0, Date.now())) {
      if (!syncedRef.current) {
        heldRef.current = { turn: t, data, closing };
        return;
      }
      if (!current) return;
    }
    if (!current && (isEmptyTurn(cell) || t.round !== roundRef.current)) return;
    handIn(t, cell);
    if (!isEmptyTurn(cell)) touchRoom(roomRef.current);
    if (current && !closing && t.stage > 0) e.go('/waiting');
  };

  // Let a guessing turn go without a guess (the clock ran out on an empty
  // box): the keeper fills it in empty. Only if it's still that turn, and not
  // from a screen that slept through its deadline: catching up moves the
  // player on from that one.
  const passTurn = (forTurn?: Turn | null) => {
    const now = currentTurn();
    if (forTurn && !syncedRef.current && isLate(deadlinesRef.current.get(turnKey(forTurn)) ?? 0, Date.now())) return;
    if (!forTurn || sameTurn(forTurn, now)) e.go('/waiting');
  };

  Object.assign(e, {
    routeForStage,
    currentTurn,
    mendAll,
    forgetTurns,
    stageSettled,
    maybeAdvanceStage,
    forceAdvance,
    onCell,
    onAdvance,
    submitCell,
    passTurn,
  } satisfies Partial<EngineFns>);
}
