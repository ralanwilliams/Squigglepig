import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stage } from '../components/Stage';
import { Heading } from '../components/Heading';
import { PigButton } from '../components/PigButton';
import { RewardTile } from '../rewards/RewardTile';
import { KINDS, type Reward } from '../rewards/catalog';
import { useInventory } from '../rewards/inventory';
import { useChoose } from '../rewards/useChoose';
import { useUi } from '../theme/responsive';
import { playSound } from '../lib/sound';
import { SOUNDS } from '../assets/assets';
import { LADDER, ROUNDS, type Prize } from './engine';
import { offers } from './payout';

// The end of a banked run: choose a prize (payout.ts offers), then it's
// yours. Every pot offers three of its tier to choose from. A won reward of a kind worn one at a time (a theme) can be put to use there
// and then. With nothing left to give, it says so.
export function PayoutScreen({ prize, onAgain, onDone }: { prize: Prize; onAgain: () => void; onDone: () => void }) {
  const ui = useUi();
  const { owned, grant, uses } = useInventory();
  const putToUse = useChoose();
  // Drawn once: the offer doesn't reshuffle as the screen re-renders.
  const [list] = useState(() => offers(prize, owned));
  const [taken, setTaken] = useState<Reward | null>(null);
  const label = LADDER.find((s) => s.prize === prize)?.label.toLowerCase();

  useEffect(() => {
    playSound(SOUNDS.winner);
  }, []);

  const take = (r: Reward) => {
    grant(r.id);
    setTaken(r);
  };

  const again = <PigButton name="Play again" onPress={onAgain} />;
  const done = <PigButton name="Done" onPress={onDone} />;

  if (taken) {
    const wearable = KINDS[taken.kind].pick === 'one' && !taken.soon;
    const inUse = uses(taken.id);
    const use = () => putToUse(taken.kind, taken.id);
    return (
      <Screen>
        <View style={[styles.center, { transform: [{ scale: 1.5 }] }]}>
          {/* Not tappable here (Use it is the button), so it says so itself. */}
          <RewardTile reward={taken} owned chosen={inUse} status={inUse ? 'In use' : 'New!'} />
        </View>
        <>
          <Heading>{taken.label} is in your rewards.</Heading>
          {wearable && !inUse ? <PigButton name="Use it" onPress={use} /> : null}
          {again}
          {done}
        </>
      </Screen>
    );
  }

  if (!list.length) {
    return (
      <Screen>
        <View />
        <>
          <Heading>There's nothing left to win. More rewards are on the way.</Heading>
          {again}
          {done}
        </>
      </Screen>
    );
  }

  return (
    <Screen fitFocus>
      <View style={[styles.grid, { gap: ui.sp(10) }]}>
        {list.map((r) => (
          <RewardTile key={r.id} reward={r} owned status="Tap to take" onPress={() => take(r)} />
        ))}
      </View>
      <>
        <Heading>
          {prize === 'premium' ? `You won all ${ROUNDS} rounds! Choose a premium prize.` : `You banked a ${label} prize. Choose one.`}
        </Heading>
      </>
    </Screen>
  );
}

// Stage, untitled and with no back arrow, like every screen, with the first
// child as the focus and the second as the rail.
function Screen({ children, fitFocus }: { children: [React.ReactNode, React.ReactNode]; fitFocus?: boolean }) {
  return <Stage focus={children[0]} actions={children[1]} fitFocus={fitFocus} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
