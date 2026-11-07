import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlankDrawing, parseDrawing } from '../src/lib/drawing';
import { strokePoints, thinStroke } from '../src/lib/strokes';
import { canvasStroke, detailedDrawing, farthest, handStroke, rng, tracePath } from './helpers/draw';

// What every app, old or new, accepts as a stroke (src/lib/drawing.ts).
const PATH = /^[MLQCSTHVZmlqcsthvz0-9eE.,\s+-]*$/;

describe('strokes are sent with only the points their shape needs', () => {
  const strokes = detailedDrawing(3, 60, 250);
  const thinned = strokes.map(thinStroke);

  test('a detailed drawing comes out a fraction of the size', () => {
    const before = JSON.stringify({ w: 400, h: 300, strokes }).length;
    const after = JSON.stringify({ w: 400, h: 300, strokes: thinned }).length;
    assert.ok(after < before * 0.6, `${before} -> ${after}`);
  });

  test('each stroke keeps the canvas format, so every app draws it', () => {
    for (const d of thinned) {
      assert.match(d, PATH);
      assert.ok(strokePoints(d), d.slice(0, 60));
    }
    const drawing = parseDrawing(JSON.stringify({ w: 400, h: 300, strokes: thinned }));
    assert.equal(drawing?.strokes.length, strokes.length);
    assert.ok(!isBlankDrawing(JSON.stringify({ w: 400, h: 300, strokes: thinned })));
  });

  test('the line moves by a fraction of its width (3 units)', () => {
    strokes.forEach((d, i) => {
      const a = tracePath(d);
      const b = tracePath(thinned[i]);
      const off = Math.max(farthest(a, b), farthest(b, a));
      assert.ok(off < 1, `stroke ${i} moved ${off.toFixed(2)} units`);
    });
  });

  test('a sharp corner stays sharp', () => {
    const pts = [
      ...Array.from({ length: 60 }, (_, i) => ({ x: 50 + i, y: 100 })),
      ...Array.from({ length: 60 }, (_, i) => ({ x: 110, y: 100 + i })),
    ];
    const d = canvasStroke(pts);
    const t = thinStroke(d);
    assert.ok(t.length < d.length / 2);
    assert.ok(Math.max(farthest(tracePath(d), tracePath(t)), farthest(tracePath(t), tracePath(d))) < 1);
  });

  test('a dot, a quick flick and anything not in the canvas format go as they are', () => {
    const dot = canvasStroke([{ x: 10, y: 10 }]);
    assert.equal(thinStroke(dot), dot);
    const flick = canvasStroke(handStroke(rng(1), 3, 8));
    assert.equal(thinStroke(flick), flick);
    for (const other of ['M 1 1 L 5 5', 'M 1 1 C 2 2 3 3 4 4', 'nonsense', '']) assert.equal(thinStroke(other), other);
  });
});
