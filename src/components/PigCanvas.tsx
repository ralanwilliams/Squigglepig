import React, { useEffect, useRef } from 'react';
import { PigButton } from './PigButton';
import { WorkStage } from './WorkStage';
import { DrawingBoard, drawingData, drawingStarted, useDrawingStore, type DrawingBoardHandle } from './DrawingBoard';

// The drawing screen's canvas (app/drawing.tsx): the drawing board
// (DrawingBoard.tsx: ink, stickers, zoom) in the frame shared with the
// guessing screen (WorkStage), with its timer, Submit, Clear and Undo. When
// the time runs out, what's there is submitted. The drawing is kept here
// (useDrawingStore), so it survives the phone turning: WorkStage draws the
// board somewhere else then, and it starts afresh.
//
// It's handed in once. If the screen closes before then (the game moved on
// while the player was still drawing), whatever is drawn is handed in as it
// goes (`onSubmit` with `closing`), so a drawing is never simply lost.
export function PigCanvas({
  onSubmit,
  timeLimit,
  until,
  header,
  footer,
}: {
  onSubmit: (data: string, closing?: boolean) => void;
  timeLimit?: number;
  until?: number; // when the clock runs out (epoch ms), if not timeLimit from now
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const board = useRef<DrawingBoardHandle>(null);
  const store = useDrawingStore();
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
      top={header}
      primary={<PigButton name="Submit" onPress={submit} />}
      secondary={[
        <PigButton key="clear" name="Clear" onPress={() => board.current?.clear()} silent />,
        <PigButton key="undo" name="Undo" onPress={() => board.current?.undo()} silent />,
      ]}
      footer={footer}
    />
  );
}
