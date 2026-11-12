import React, { useEffect, useRef } from 'react';
import { PigButton } from './PigButton';
import { WorkStage } from './WorkStage';
import { DrawingBoard, drawingData, drawingStarted, useDrawingStore, type DrawingBoardHandle } from './DrawingBoard';
import { gameBrush } from '../state/brush';

// The drawing screen's canvas (app/drawing.tsx): the drawing board
// (DrawingBoard.tsx: ink, stickers, zoom, Clear · Undo) in the frame shared
// with the guessing screen (WorkStage), with its timer and Submit. When the
// time runs out, what's there is submitted. The drawing is kept here
// (useDrawingStore), so it survives the phone turning: WorkStage draws the
// board somewhere else then, and it starts afresh. Its brush is the game's,
// so the next turn starts with the ink and width this one ended on.
//
// It's handed in once. If the screen closes before then (the game moved on
// while the player was still drawing), whatever is drawn is handed in as it
// goes (`onSubmit` with `closing`), so a drawing is never simply lost.
export function PigCanvas({
  onSubmit,
  timeLimit,
  until,
  hold,
  header,
  footer,
}: {
  onSubmit: (data: string, closing?: boolean) => void;
  timeLimit?: number;
  until?: number; // when the clock runs out (epoch ms), if not timeLimit from now
  hold?: boolean; // don't run out yet (WorkStage)
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const board = useRef<DrawingBoardHandle>(null);
  // The brush (ink and width) lasts the game, from turn to turn (src/state/brush.ts).
  const store = useDrawingStore(gameBrush);
  const sent = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  // Always something to send, so the round can move on: the store's drawing
  // if the board isn't there to ask (it always is, once it's drawn).
  const submit = () => {
    if (sent.current) return;
    sent.current = true;
    onSubmit(board.current?.data() ?? drawingData(store));
  };
  useEffect(
    () => () => {
      if (!sent.current && drawingStarted(store)) {
        sent.current = true;
        onSubmitRef.current(drawingData(store), true);
      }
    },
    []
  );
  return (
    <WorkStage
      focus={<DrawingBoard ref={board} store={store} />}
      timeLimit={timeLimit}
      until={until}
      onExpire={submit}
      hold={hold}
      top={header}
      primary={<PigButton name="Submit" onPress={submit} />}
      footer={footer}
    />
  );
}
