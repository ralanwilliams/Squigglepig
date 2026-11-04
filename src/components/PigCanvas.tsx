import React, { useRef } from 'react';
import { PigButton } from './PigButton';
import { WorkStage } from './WorkStage';
import { DrawingBoard, useDrawingStore, type DrawingBoardHandle } from './DrawingBoard';
import { SPACE } from '../lib/drawing';

// The drawing screen's canvas (app/drawing.tsx): the drawing board
// (DrawingBoard.tsx: ink, stickers, zoom) in the frame shared with the
// guessing screen (WorkStage), with its timer, Submit, Clear and Undo. When
// the time runs out, what's there is submitted. The drawing is kept here
// (useDrawingStore), so it survives the phone turning: WorkStage draws the
// board somewhere else then, and it starts afresh.
export function PigCanvas({
  onSubmit,
  timeLimit,
  header,
  footer,
}: {
  onSubmit: (data: string) => void;
  timeLimit?: number;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const board = useRef<DrawingBoardHandle>(null);
  const store = useDrawingStore();
  // Always something to send, so the round can move on: an empty drawing if
  // the board isn't there to ask (it always is, once it's drawn).
  const submit = () => onSubmit(board.current?.data() ?? JSON.stringify({ w: SPACE.w, h: SPACE.h, strokes: [] }));
  return (
    <WorkStage
      focus={<DrawingBoard ref={board} store={store} />}
      timeLimit={timeLimit}
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
