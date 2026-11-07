import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PAYLOAD_LIMIT, cellSize, utf8Bytes } from '../src/dev/wireSize';
import { split } from '../src/lib/chunks';
import { thinStroke } from '../src/lib/strokes';
import { detailedDrawing } from './helpers/draw';

// The development readout on the canvas (src/dev/DrawingSize.tsx) has to
// tell the truth: the size it shows is the 'cell' message's, byte for byte,
// and the pieces it counts are the ones the app would send.

const message = (data: string, author: string) => ({ round: 0, chain: 0, stage: 1, cell: { kind: 'drawing', data, author } });

describe('the canvas size readout', () => {
  test('counts bytes as UTF-8, the way the message travels', () => {
    for (const s of ['plain', 'café', '🐷 Piggo', 'M 1 2 Q 3 4 5 6 L 7 8', '"quoted"', '']) {
      assert.equal(utf8Bytes(s), Buffer.byteLength(s, 'utf8'), s);
    }
  });

  test("a drawing's size is its whole 'cell' message", () => {
    const data = JSON.stringify({ w: 400, h: 300, strokes: detailedDrawing(5, 20, 80).map(thinStroke) });
    for (const author of ['Player', '🐷 Piggo']) {
      const size = cellSize(data, author);
      assert.equal(size.bytes, Buffer.byteLength(JSON.stringify(message(data, author)), 'utf8'));
      assert.equal(size.pieces, 1);
    }
  });

  test('a heavy drawing: past the limit, and the pieces the app would send it in', () => {
    const data = JSON.stringify({ w: 400, h: 300, strokes: detailedDrawing(7, 120, 300) });
    const size = cellSize(data);
    assert.ok(size.bytes > PAYLOAD_LIMIT, `${size.bytes} bytes`);
    assert.equal(size.pieces, split('cell', message(data, 'Player'), 'x')!.length);
    assert.ok(size.pieces > 1);
  });
});
