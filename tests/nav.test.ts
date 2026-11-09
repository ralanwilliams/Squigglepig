import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { holdsBack, isRoomScreen, leaveCost, navFor } from '../src/state/nav';

// Bug: Back from the lobby showed "Reconnecting…" (the home screen that had
// put the lobby over itself never stopped checking), and there was nothing
// to do in the app while waiting for the game. Now the lobby sits over home:
// Back goes home, still in the room, and the game calls the player back.

describe('the lobby over home', () => {
  test('joining (or coming back) puts the lobby over home', () => {
    assert.equal(navFor('/', '/lobby', true), 'push');
  });
  test('from Create or Join, the lobby goes right over home, so Back goes home', () => {
    // Down to home, then over it: Join may have opened over anything (a room
    // link tapped mid-game opens it over that game's screen).
    assert.equal(navFor('/create', '/lobby', true), 'rehome');
    assert.equal(navFor('/join', '/lobby', true), 'rehome');
    assert.equal(navFor('/join', '/waiting', true), 'rehome');
  });
  test('Back to room from home goes back over home', () => {
    assert.equal(navFor('/', '/lobby', true), 'push');
    assert.equal(navFor('/', '/scoreboard', true), 'push');
  });
});

describe('looking around while waiting', () => {
  test('nothing in the room pulls a player away from a solo game or Your pig', () => {
    assert.equal(navFor('/arcade/memory', '/lobby'), 'stay');
    assert.equal(navFor('/pig', '/lobby'), 'stay');
    assert.equal(navFor('/', '/lobby'), 'stay');
  });
  test('the game starting brings them back, wherever they are, with home under it', () => {
    assert.equal(navFor('/', '/prompts'), 'push');
    assert.equal(navFor('/arcade/memory', '/prompts'), 'rehome');
    assert.equal(navFor('/rewards', '/prompts'), 'rehome');
    assert.equal(navFor('/lobby', '/prompts'), 'replace');
  });
  test('a new turn replaces the last one, even on the same screen', () => {
    assert.equal(navFor('/drawing', '/guessing'), 'replace');
    assert.equal(navFor('/drawing', '/drawing'), 'replace');
  });
});

describe('Back', () => {
  test('is held during a game, on its screens', () => {
    for (const here of ['/prompts', '/view', '/drawing', '/guessing', '/waiting', '/reveal']) {
      assert.ok(holdsBack(true, 'draw', here), here);
    }
  });
  test('goes home from the lobby and the scoreboard', () => {
    assert.ok(!holdsBack(true, 'lobby', '/lobby'));
    assert.ok(!holdsBack(true, 'gameover', '/scoreboard'));
  });
  test('works as usual elsewhere, and out of a room', () => {
    assert.ok(!holdsBack(true, 'draw', '/pig'));
    assert.ok(!holdsBack(false, 'lobby', '/drawing'));
  });
  test('home and the rest of the app are not room screens', () => {
    for (const p of ['/', '/create', '/join', '/arcade', '/pig', '/rewards', '/licenses']) assert.ok(!isRoomScreen(p), p);
  });
});

describe('Are you sure?', () => {
  test('during a game, says there is no coming back into it', () => {
    assert.match(leaveCost(true), /can't rejoin/);
  });
  test('in the lobby, only that it leaves the room', () => {
    assert.doesNotMatch(leaveCost(false), /rejoin/);
  });
  // Bug: a phone back in a game waits here with its own phase still the lobby
  // until the host answers, and Back went home without asking.
  test('Back is held on the waiting screen before the phone has caught up', () => {
    assert.ok(holdsBack(true, 'lobby', '/waiting'));
    assert.ok(!holdsBack(false, 'lobby', '/waiting'));
  });
});
