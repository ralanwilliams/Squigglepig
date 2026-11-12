import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM_MAX, ZOOM_STEPS, zoomLabel, zoomSettle, zoomStep } from '../src/lib/zoom';

describe('the drawing board zooms from 1× to 10×', () => {
  test('+ steps all the way in, and − all the way back out', () => {
    const ins = [1];
    while (ins[ins.length - 1] < ZOOM_MAX) ins.push(zoomStep(ins[ins.length - 1], 1));
    assert.deepEqual(ins, ZOOM_STEPS);
    const outs = [ZOOM_MAX];
    while (outs[outs.length - 1] > 1) outs.push(zoomStep(outs[outs.length - 1], -1));
    assert.deepEqual(outs, [...ZOOM_STEPS].reverse());
  });

  test('the ends stay put', () => {
    assert.equal(zoomStep(ZOOM_MAX, 1), ZOOM_MAX);
    assert.equal(zoomStep(1, -1), 1);
  });

  test('from between steps (after a pinch), − and + go to the steps either side', () => {
    assert.equal(zoomStep(2.5, 1), 3);
    assert.equal(zoomStep(2.5, -1), 2);
    assert.equal(zoomStep(8.6, 1), 10);
    assert.equal(zoomStep(1.2, -1), 1);
  });

  test('a zoom barely off a step counts as on it', () => {
    // Shown as 2×, so + goes on to 3× and − back to 1.5×.
    assert.equal(zoomStep(1.98, 1), 3);
    assert.equal(zoomStep(2.03, -1), 1.5);
  });

  test('a pinch that ends near a step settles on it, and one between steps stays', () => {
    assert.equal(zoomSettle(2.05), 2);
    assert.equal(zoomSettle(1.02), 1);
    assert.equal(zoomSettle(9.8), 10);
    assert.equal(zoomSettle(2.5), undefined);
  });

  test('the readout shows one decimal at most', () => {
    assert.equal(zoomLabel(1), '1×');
    assert.equal(zoomLabel(1.6), '1.6×');
    assert.equal(zoomLabel(1.63), '1.6×');
    assert.equal(zoomLabel(2), '2×');
    assert.equal(zoomLabel(9.97), '10×');
  });
});
