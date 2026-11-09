import React, { useEffect } from 'react';
import { Keyboard, Modal } from 'react-native';
import { ScrimCard } from './RoundCard';
import { closeConfirm, goAhead, useConfirm } from '../lib/confirm';
import { ANY_WAY_UP } from '../theme/responsive';

// The question asked with askConfirm (src/lib/confirm.ts): the app's own modal,
// the round's card on the scrim (RoundCard.tsx). Mounted once, in the root
// layout. The first button is the safe one (filled), and Back does the same as
// it.
export function ConfirmOverlay() {
  const shown = useConfirm();
  useEffect(() => {
    if (shown) Keyboard.dismiss(); // the card sits mid-screen, not above a keyboard
  }, [shown]);
  return (
    <Modal
      visible={!!shown}
      transparent
      animationType="none" // the card brings its own (none with reduced motion)
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={ANY_WAY_UP}
      onRequestClose={closeConfirm}
    >
      {shown ? (
        <ScrimCard
          delay={0}
          title={shown.title}
          lines={shown.lines}
          actions={[
            { name: shown.cancel, onPress: closeConfirm },
            { name: shown.confirm, onPress: goAhead },
          ]}
        />
      ) : null}
    </Modal>
  );
}
