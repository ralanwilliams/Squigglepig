import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { PigButton } from '../../../components/PigButton';
import { Heading } from '../../../components/Heading';
import { DrawingImage } from '../../../components/DrawingImage';
import { PeekOver } from '../../../components/PeekPig';
import { SPACE } from '../../../lib/drawing';
import { useUi } from '../../../theme/responsive';
import { ROUNDS } from '../../engine';
import type { Game, RoundProps } from '../index';
import { DrawPad } from './DrawPad';
import { ScoreReveal } from './ScoreReveal';
import { similarity } from './score';
import PACK from './pack.json';

// Draw from memory: a drawing is shown for a moment, then hidden, and the
// player draws it on a blank pad. Done (or the clock running out) scores the
// drawing against the one shown (score.ts), and the round is won at the
// round's pass mark or better. Before the run moves on, ScoreReveal.tsx shows
// how it went: the one shown over theirs, and the score against the mark.
// The pig peeks over the pad the whole time (PeekOver), as on the drawing
// screen.
//
// The drawings are doodles from Google's Quick, Draw! (CC BY 4.0, credited on
// app/licenses.tsx), chosen and converted by scripts/quickdraw.mts. The pack
// lists them easiest first; a run takes one from each tenth of it, in order,
// no subject twice. Later rounds also flash the drawing for less time and
// need a closer match. A round played again on a life (engine.ts LIVES) is
// a new drawing from the same tenth (replay).

type Entry = { word: string; strokes: string[] };
type Spec = Entry & { flashMs: number; pass: number };

const ease = (round: number) => (round - 1) / (ROUNDS - 1); // 0 on round 1, 1 on the last
// How long the drawing shows: 3 s on round 1, down to 1.5 s.
const flashMs = (round: number) => Math.round(3000 - 1500 * ease(round));
// The score that wins the round: 40 on round 1, up to 60. Against score.ts's
// scale a fair attempt scores about 75 and a drawing of something else about 20.
const passMark = (round: number) => Math.round(40 + 20 * ease(round));
// The whole round, looking and drawing: 30 s for round 1, two fewer each
// round, never under 15 (the engine's 23 down to 6 is too short to draw in).
const seconds = (round: number) => Math.max(15, 32 - 2 * round);

// Round n's drawing: one from its tenth of the pack, of a subject not in `used`.
function pick(round: number, used: Set<string>): Spec {
  const pack = PACK as Entry[];
  const band = pack.length / ROUNDS;
  const slice = pack.slice(Math.round((round - 1) * band), Math.round(round * band));
  const fresh = slice.filter((e) => !used.has(e.word));
  const pool = fresh.length ? fresh : slice;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  return { ...entry, flashMs: flashMs(round), pass: passMark(round) };
}

function makeRun(): Spec[] {
  const used = new Set<string>();
  return Array.from({ length: ROUNDS }, (_, i) => {
    const spec = pick(i + 1, used);
    used.add(spec.word);
    return spec;
  });
}

// Round n again on a life: the drawing's been shown, so another as hard.
const replay = (round: number, run: Spec[]) => pick(round, new Set(run.map((s) => s.word)));

// What the drawing was: "a cat", "an owl", "an hourglass"; a pair or a
// bunch as it is ("grapes").
const PLURAL = new Set(['drums', 'eyeglasses', 'flip flops', 'grapes', 'headphones', 'pants']);
const answerFor = (word: string) => (PLURAL.has(word) ? word : `${/^(?:[aeiou]|hour)/.test(word) ? 'an' : 'a'} ${word}`);

function Round({ spec, onResult, Frame }: RoundProps<Spec>) {
  const ui = useUi();
  const [looking, setLooking] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLooking(false), spec.flashMs);
    return () => clearTimeout(t);
  }, [spec]);

  // The strokes drawn, kept in a ref too so Undo and Clear (and the score)
  // always see the latest, and what each Clear cleared, latest last: Undo
  // takes back the strokes since a Clear one at a time, then the Clear, as on
  // the drawing board.
  const [strokes, setStrokes] = useState<string[]>([]);
  const strokesRef = useRef(strokes);
  const cleared = useRef<string[][]>([]);
  const draw = (next: string[]) => {
    strokesRef.current = next;
    setStrokes(next);
  };
  const clear = () => {
    if (!strokesRef.current.length) return;
    cleared.current.push(strokesRef.current);
    draw([]);
  };
  const undo = () => {
    if (strokesRef.current.length) draw(strokesRef.current.slice(0, -1));
    else {
      const back = cleared.current.pop();
      if (back) draw(back);
    }
  };
  const shown = useMemo(() => JSON.stringify({ ...SPACE, strokes: spec.strokes }), [spec]);

  // Scored on what's drawn, whether Done was pressed or the clock ran out;
  // the reveal then ends the round (ScoreReveal.tsx onContinue).
  const [result, setResult] = useState<{ score: number; at: number } | null>(null);
  const scored = useRef(false);
  const done = () => {
    if (scored.current) return;
    scored.current = true;
    setResult({ score: similarity(strokesRef.current, spec.strokes), at: Date.now() });
  };

  if (result) {
    const answer = answerFor(spec.word);
    const { score, at } = result;
    return (
      <ScoreReveal
        Frame={Frame}
        shown={spec.strokes}
        drawn={strokes}
        score={score}
        pass={spec.pass}
        answer={answer}
        at={at}
        onContinue={() => onResult(score >= spec.pass, `It was ${answer}. Your drawing matched ${score}%; it needed ${spec.pass}%.`)}
      />
    );
  }

  if (looking) {
    return (
      <Frame
        onExpire={done}
        focus={
          <PeekOver>
            <DrawingImage data={shown} />
          </PeekOver>
        }
        controls={<Heading>Remember this!</Heading>}
      />
    );
  }
  return (
    <Frame
      onExpire={done}
      focus={
        <PeekOver>
          <DrawPad strokes={strokes} onStroke={(d) => draw([...strokesRef.current, d])} onClear={clear} onUndo={undo} />
        </PeekOver>
      }
      controls={
        <View style={{ gap: ui.sp(10) }}>
          <Heading>Now draw it!</Heading>
          <PigButton name="Done" onPress={done} />
        </View>
      }
    />
  );
}

export const memory: Game<Spec> = {
  id: 'memory',
  label: 'Draw from memory',
  glyph: 'brush',
  blurb: 'A drawing flashes up, then hides. Draw it as close as you can.',
  makeRun,
  replay,
  Round,
  seconds,
};
