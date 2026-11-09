import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Stage } from '../components/Stage';
import { Heading } from '../components/Heading';
import { Hint } from '../components/Hint';
import { PigButton } from '../components/PigButton';
import { useScreenBackGuard } from '../lib/backGuard';
import { confirmLeave } from '../lib/confirm';
import { RewardTile } from '../rewards/RewardTile';
import { KINDS, homeOf, type Reward } from '../rewards/catalog';
import { useInventory } from '../rewards/inventory';
import { useChoose } from '../rewards/useChoose';
import { useUi } from '../theme/responsive';
import { playSound } from '../lib/sound';
import { SOUNDS } from '../assets/assets';
import { LADDER, ROUNDS, type Prize } from './engine';
import { offers } from './payout';

// The end of a banked run: choose a prize (payout.ts offers), then it's
// yours. Every pot offers three of its tier to choose from. A won reward of a kind worn one at a time (a theme) can be put to use there
// and then. A button opens the screen the prize is kept on (catalog.ts
// homeOf), and a hint says where rewards are found later. An outfit or a
// speech bubble is put on at Your pig, where it's seen on the pig, so there
// Dress your pig stands in for Use it. With nothing left to give, it says so.
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

  // Back before choosing gives the prize up, so it asks first.
  useScreenBackGuard(!taken && list.length > 0, () => confirmLeave("You haven't chosen your prize yet, so it will be lost.", onDone));

  const take = (r: Reward) => {
    grant(r.id);
    setTaken(r);
  };

  const again = <PigButton name="Play again" onPress={onAgain} />;
  const done = <PigButton name="Done" onPress={onDone} />;

  if (taken) {
    const home = homeOf(taken.kind);
    const wearable = KINDS[taken.kind].pick === 'one' && !taken.soon && home.path !== '/pig';
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
          <PigButton name={home.go} onPress={() => router.push(home.path)} />
          {again}
          {done}
          <Hint>
            Your rewards are always in the <Hint.Strong>☰ menu</Hint.Strong> on the home screen.
          </Hint>
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
