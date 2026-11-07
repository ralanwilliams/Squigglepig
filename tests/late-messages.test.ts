import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  finalStage,
  phaseForStage,
  verdictForAdvance,
  verdictForCell,
  verdictForChainScored,
  verdictForGameOver,
  verdictForRevealStep,
  verdictForRound,
  verdictForToReveal,
  verdictForViewAck,
  type Position,
} from '../src/state/rules';

// Bug: a phone that was off screen (here: three sessions on one phone, two
// always in the background) woke with timers that had been waiting, and sent
// game messages from a moment the room had already moved past. The room
// applied them: the reveal started over and scored the same chains again.
// Every game message now carries its round, and each phone holds it up
// against where its own game is (./rules "Messages that come late").

const at = (p: Partial<Position>): Position => ({
  phase: 'lobby',
  round: 0,
  stage: 0,
  revealIndex: 0,
  revealStep: 0,
  chains: 0,
  ...p,
});

// A game as every phone sees it, message by message, moving `pos` on as
// GameContext's handlers do. Every message of a real game must apply.
function playGame(players: number, rounds: number) {
  const log: string[] = [];
  let pos = at({ phase: 'prompts' });
  const expectApply = (what: string, verdict: string) => {
    log.push(`${what}: ${verdict}`);
    assert.equal(verdict, 'apply', `${what} at ${JSON.stringify(pos)}`);
  };
  for (let round = 0; round < rounds; round++) {
    expectApply(`round ${round}`, verdictForRound(pos, round));
    pos = { ...pos, phase: 'view', round, stage: 0, revealIndex: 0, revealStep: 0, chains: players };
    expectApply('view-ack', verdictForViewAck(pos, round));
    for (let s = 1; s <= finalStage(players); s++) {
      expectApply(`advance ${s}`, verdictForAdvance(pos, s, round));
      pos = { ...pos, stage: s, phase: phaseForStage(s) };
      for (let c = 0; c < players; c++) expectApply(`cell ${c}@${s}`, verdictForCell(pos, c, s, round));
    }
    expectApply('to-reveal', verdictForToReveal(pos, round));
    pos = { ...pos, phase: 'reveal', revealIndex: 0, revealStep: 1 };
    for (let c = 0; c < players; c++) {
      for (let step = 1; step <= finalStage(players); step++) {
        expectApply(`mark ${c}:${step}`, verdictForRevealStep(pos, c, step, round));
        pos = { ...pos, revealStep: step };
        if (step < finalStage(players)) {
          expectApply(`step ${c}:${step + 1}`, verdictForRevealStep(pos, c, step + 1, round));
          pos = { ...pos, revealStep: step + 1 };
        }
      }
      expectApply(`chain-scored ${c}`, verdictForChainScored(pos, c, round));
      pos = { ...pos, revealIndex: c + 1, revealStep: 1 };
    }
  }
  expectApply('game-over', verdictForGameOver(pos, rounds - 1));
  return log;
}

describe('a real game is never held up', () => {
  test('3 players, 3 rounds: every message applies', () => {
    assert.ok(playGame(3, 3).length > 40);
  });
  test('12 players, 2 rounds: every message applies', () => {
    playGame(12, 2);
  });
});

describe('late messages from a phone that was off screen are ignored', () => {
  // Round 1's reveal, on chain 2 (the scoring loop: a woken host's
  // to-reveal used to send everyone back to chain 1 to score it again).
  const reveal = at({ phase: 'reveal', round: 1, stage: 2, revealIndex: 2, revealStep: 1, chains: 3 });

  test('a second to-reveal for the round being revealed', () => {
    assert.equal(verdictForToReveal(reveal, 1), 'stale');
  });
  test('a to-reveal from an earlier round', () => {
    assert.equal(verdictForToReveal(reveal, 0), 'stale');
  });
  test('an advance from the round being revealed', () => {
    assert.equal(verdictForAdvance(reveal, 2, 1), 'stale');
  });
  test('a chain-scored for a chain already scored, or the same chain of an earlier round', () => {
    assert.equal(verdictForChainScored(reveal, 1, 1), 'stale');
    assert.equal(verdictForChainScored(reveal, 2, 0), 'stale');
  });
  test('a reveal step going backwards', () => {
    const later = { ...reveal, revealStep: 2 };
    assert.equal(verdictForRevealStep(later, 2, 1, 1), 'stale');
    assert.equal(verdictForRevealStep(later, 1, 2, 1), 'stale');
  });
  test('a round start that has already happened', () => {
    assert.equal(verdictForRound(reveal, 1), 'stale');
    assert.equal(verdictForRound(at({ phase: 'draw', round: 2, stage: 1, chains: 3 }), 2), 'stale');
  });
  test('an advance to a stage already reached', () => {
    const drawing = at({ phase: 'draw', round: 1, stage: 3, chains: 5 });
    assert.equal(verdictForAdvance(drawing, 3, 1), 'stale');
    assert.equal(verdictForAdvance(drawing, 2, 1), 'stale');
    assert.equal(verdictForAdvance(drawing, 2, null), 'stale');
  });
  test('a turn from an earlier round', () => {
    assert.equal(verdictForCell(at({ phase: 'draw', round: 2, stage: 1, chains: 3 }), 0, 1, 1), 'stale');
  });
  test('a second game-over', () => {
    assert.equal(verdictForGameOver(at({ phase: 'gameover', round: 2 }), 2), 'stale');
  });
  test('a view-ack from an earlier round', () => {
    assert.equal(verdictForViewAck(at({ phase: 'view', round: 2, chains: 3 }), 1), 'stale');
  });
});

describe('a phone that missed something catches up instead of guessing', () => {
  test('a stage further on than the next one', () => {
    assert.equal(verdictForAdvance(at({ phase: 'draw', round: 0, stage: 1, chains: 5 }), 3, 0), 'resync');
  });
  test('a message from a later round', () => {
    const drawing = at({ phase: 'draw', round: 0, stage: 1, chains: 3 });
    assert.equal(verdictForAdvance(drawing, 2, 1), 'resync');
    assert.equal(verdictForChainScored(drawing, 0, 1), 'resync');
  });
  test('the reveal under way while this phone is still on a turn', () => {
    assert.equal(verdictForRevealStep(at({ phase: 'caption', round: 0, stage: 2, chains: 3 }), 0, 1, 0), 'resync');
  });
  test('the next round before this phone saw the last chain scored', () => {
    assert.equal(verdictForRound(at({ phase: 'reveal', round: 0, revealIndex: 1, chains: 3 }), 1), 'resync');
  });
  test('the game under way while this phone is in the lobby or on the scoreboard', () => {
    assert.equal(verdictForRound(at({ phase: 'lobby' }), 0), 'resync');
    assert.equal(verdictForRound(at({ phase: 'gameover', round: 3 }), 0), 'resync');
    assert.equal(verdictForAdvance(at({ phase: 'prompts' }), 1, 0), 'resync');
  });
  test('an app that does not say which round, where late and missed look alike', () => {
    const reveal = at({ phase: 'reveal', round: 1, revealIndex: 1, revealStep: 1, chains: 3 });
    assert.equal(verdictForToReveal(reveal, null), 'resync');
    assert.equal(verdictForAdvance(reveal, 1, null), 'resync');
  });
});

describe('apps that do not send a round still play', () => {
  test('in order, without rounds, everything applies', () => {
    let pos = at({ phase: 'view', round: 0, stage: 0, chains: 3 });
    assert.equal(verdictForViewAck(pos, null), 'apply');
    assert.equal(verdictForAdvance(pos, 1, null), 'apply');
    pos = { ...pos, phase: 'draw', stage: 1 };
    assert.equal(verdictForCell(pos, 0, 1, null), 'apply');
    assert.equal(verdictForAdvance(pos, 2, null), 'apply');
    pos = { ...pos, phase: 'caption', stage: 2 };
    assert.equal(verdictForToReveal(pos, null), 'apply');
    pos = { ...pos, phase: 'reveal', revealIndex: 0, revealStep: 1 };
    assert.equal(verdictForRevealStep(pos, 0, 1, null), 'apply');
    assert.equal(verdictForChainScored(pos, 0, null), 'apply');
    assert.equal(verdictForGameOver(pos, null), 'apply');
  });
});
