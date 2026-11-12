import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prizes } from '../src/arcade/payout';
import { REWARDS, type Tier } from '../src/rewards/catalog';

const of = (tier: Tier) => REWARDS.filter((r) => r.tier === tier && !r.soon);
const ids = (list: { id: string }[]) => list.map((r) => r.id).sort();

describe('a banked pot offers every prize of its tier', () => {
  test('a new player is offered all of the tier, not a few', () => {
    for (const tier of ['common', 'rare', 'premium'] as const) {
      const offer = prizes(tier, new Set(), false);
      assert.equal(offer.tier, tier);
      assert.deepEqual(ids(offer.list), ids(of(tier)));
    }
  });

  test('what is already won is left out', () => {
    const won = of('common').slice(0, 3).map((r) => r.id);
    const offer = prizes('common', new Set(won), false);
    assert.equal(offer.list.length, of('common').length - 3);
    assert.ok(offer.list.every((r) => !won.includes(r.id)));
  });

  test('a tier with nothing left offers the nearest one that has something, and says which', () => {
    const allPremium = new Set(of('premium').map((r) => r.id));
    const offer = prizes('premium', allPremium, false);
    assert.equal(offer.tier, 'rare');
    assert.deepEqual(ids(offer.list), ids(of('rare')));
  });

  test('with everything won there is nothing to offer', () => {
    const offer = prizes('common', new Set(REWARDS.map((r) => r.id)), true);
    assert.deepEqual(offer.list, []);
  });

  test('a reward still coming soon is never offered in a release build', () => {
    assert.ok(prizes('common', new Set(), false).list.every((r) => !r.soon));
  });
});
