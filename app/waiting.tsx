import React from 'react';
import { Stage } from '../src/components/Stage';
import { Logo, type ImageWindow } from '../src/components/Logo';
import { Heading } from '../src/components/Heading';
import { LeaveButton } from '../src/components/LeaveButton';
import { IMAGES } from '../src/assets/assets';
import { useUi } from '../src/theme/responsive';

// squigglepig.gif (480 × 442) draws its pig inside a wide teal margin, unlike the
// PNG pigs which fill their frame edge to edge, and its thought cloud grows and
// bursts up-left of the ears.
//
// Two-pane: window the pig alone — body's left edge to the right edge, ear tips
// to the feet — which has the same aspect as the PNGs (≈ 954 : 900), so the pig
// lands at the same size and spot as on screen 8.
const PIG: ImageWindow = { x: 120 / 480, y: 100 / 442, w: 360 / 480, h: 342 / 442 };
// One column: the pane is only 377dp wide, so the burst would run off the left
// edge; window the pig AND the cloud instead. The pig comes out a little smaller.
const PIG_AND_CLOUD: ImageWindow = { x: 20 / 480, y: 45 / 442, w: 460 / 480, h: 397 / 442 };

// Where a player lands after submitting (or when spectating a round they aren't
// part of). No countdown — the host enforces the stage deadline either way. Uses
// the shared two-pane Stage so the pig stays in the same spot as every other
// screen; the message and leave link sit on the right.
export default function Waiting() {
  const ui = useUi();
  return (
    <Stage
      focus={<Logo source={IMAGES.waiting} window={ui.twoPane ? PIG : PIG_AND_CLOUD} />}
      actions={
        <>
          <Heading>Please wait while the geniuses are at work.</Heading>
          <LeaveButton />
        </>
      }
    />
  );
}
