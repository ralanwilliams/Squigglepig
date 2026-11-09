import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { askConfirm, closeConfirm, confirmLeave, goAhead } from '../src/lib/confirm';

describe('the question', () => {
  test('going ahead runs once, however fast it is tapped', () => {
    let left = 0;
    confirmLeave('It costs this.', () => left++);
    goAhead();
    goAhead();
    assert.equal(left, 1);
  });
  test('closing it does not go ahead', () => {
    let left = 0;
    confirmLeave('It costs this.', () => left++);
    closeConfirm();
    goAhead();
    assert.equal(left, 0);
  });
  test('a new question replaces the one that was up', () => {
    const ran: string[] = [];
    askConfirm({ title: 'a', lines: [], cancel: 'no', confirm: 'yes', onConfirm: () => ran.push('a') });
    askConfirm({ title: 'b', lines: [], cancel: 'no', confirm: 'yes', onConfirm: () => ran.push('b') });
    goAhead();
    assert.deepEqual(ran, ['b']);
  });
});
