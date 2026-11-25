import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveView, type ViewInput } from '../src/state/game/view';
import { chain, drawing, members, prompt } from './helpers/game';

// What the screens see that's worked out from the game (src/state/game/view.ts).

const ids = (names: string[]) => names.map((n) => `id-${n}`);

const input = (over: Partial<ViewInput> = {}): ViewInput => ({
  username: 'Ann',
  members: members(['Ann', 'Bob', 'Cat']),
  presentIds: ids(['Ann', 'Bob', 'Cat']),
  status: 'connected',
  gameNames: [],
  phase: 'lobby',
  stage: 0,
  chains: [],
  revealIndex: 0,
  judgeWait: '',
  roster: [],
  skip: new Set(),
  versions: new Map(),
  leader: '',
  ...over,
});

describe('who is here', () => {
  test('players are everyone still in the room, oldest first', () => {
    const v = deriveView(input({ members: members(['Ann', 'Bob', 'Cat'], { Bob: 5000 }) }));
    assert.deepEqual(v.players, ['Ann', 'Cat']);
  });

  test('away is whoever is in the room without the app open', () => {
    assert.deepEqual(deriveView(input({ presentIds: ids(['Ann']) })).away, ['Bob', 'Cat']);
  });

  test('nobody is away before presence has reported, or while not connected', () => {
    assert.deepEqual(deriveView(input({ presentIds: [] })).away, []);
    assert.deepEqual(deriveView(input({ presentIds: ids(['Ann']), status: 'connecting' })).away, []);
  });

  test('departed is whoever played this game but has left the room', () => {
    const v = deriveView(input({ members: members(['Ann', 'Bob', 'Cat'], { Bob: 5000 }), gameNames: ['Ann', 'Bob', 'Cat'] }));
    assert.deepEqual(v.departed, ['Bob']);
  });
});

describe('the host and starting', () => {
  test('the host is the longest in, and can start', () => {
    const v = deriveView(input());
    assert.equal(v.host, 'Ann');
    assert.equal(v.canStart, true);
  });

  test('someone else can start only while the host is away', () => {
    assert.equal(deriveView(input({ username: 'Bob' })).canStart, false);
    assert.equal(deriveView(input({ username: 'Bob', presentIds: ids(['Bob', 'Cat']) })).canStart, true);
  });

  test('a phone on an old app is outdated', () => {
    const v = deriveView(input({ versions: new Map([['id-Bob', 1], ['id-Cat', 99]]) }));
    assert.deepEqual(v.outdated, ['Bob']);
  });
});

describe('the judge', () => {
  const chains = [chain(prompt('a cat', 'Bob'), drawing('Cat'))];

  test("the chain's owner judges it while they're here", () => {
    const v = deriveView(input({ phase: 'reveal', chains, leader: 'Cat' }));
    assert.equal(v.judge, 'Bob');
    assert.equal(v.isJudge, false);
  });

  test("nobody, while the reveal waits for an owner who's away", () => {
    const v = deriveView(input({ phase: 'reveal', chains, presentIds: ids(['Ann', 'Cat']), judgeWait: 'Bob' }));
    assert.equal(v.judge, '');
  });

  test('the round leader once the wait is over, or the first one here if they are away too', () => {
    const away = ids(['Ann', 'Cat']);
    assert.equal(deriveView(input({ phase: 'reveal', chains, presentIds: away, leader: 'Cat' })).judge, 'Cat');
    const v = deriveView(input({ phase: 'reveal', chains, presentIds: away, leader: 'Bob' }));
    assert.equal(v.leader, 'Ann');
    assert.equal(v.judge, 'Ann');
    assert.equal(v.isJudge, true);
  });
});

describe('still working', () => {
  const roster = ['Ann', 'Bob', 'Cat'];

  test('on a turn stage, who has yet to hand in, this player aside', () => {
    const chains = [chain(prompt('x', 'Ann')), chain(), chain()];
    assert.deepEqual(deriveView(input({ phase: 'prompts', roster, chains })).stillWorking, ['Bob', 'Cat']);
  });

  test('nobody outside a turn stage', () => {
    assert.deepEqual(deriveView(input({ phase: 'reveal', roster, chains: [chain(), chain(), chain()] })).stillWorking, []);
  });
});
