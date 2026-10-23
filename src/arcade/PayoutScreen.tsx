import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stage } from '../components/Stage';
import { Heading } from '../components/Heading';
import { PigButton } from '../components/PigButton';
import { BackButton } from '../components/BackButton';
import { RewardTile } from '../rewards/RewardTile';
import { KindTabs } from '../rewards/KindTabs';
import { KINDS, type Kind, type Reward } from '../rewards/catalog';
import { useInventory } from '../rewards/inventory';
import { useChoose } from '../rewards/useChoose';
import { useUi } from '../theme/responsive';
import { playSound } from '../lib/sound';
import { SOUNDS } from '../assets/assets';
import { LADDER, type Prize } from './engine';
import { offers } from './payout';

// The end of a banked run: choose a prize (payout.ts offers), then it's
// yours. A common or rare pot offers three to choose from; the top one, every
// reward not yet won, a tab per kind in the rail like the Rewards screen. A
// won reward of a kind worn one at a time (a theme) can be put to use there
// and then. With nothing left to give, it says so.
export function PayoutScreen({ prize, onAgain, onDone }: { prize: Prize; onAgain: () => void; onDone: () => void }) {
  const ui = useUi();
  const { owned, grant, chosen } = useInventory();
  const putToUse = useChoose();
  // Drawn once: the offer doesn't reshuffle as the screen re-renders.
  const [list] = useState(() => offers(prize, owned));
  const [taken, setTaken] = useState<Reward | null>(null);
  const kinds = (Object.keys(KINDS) as Kind[]).filter((k) => list.some((r) => r.kind === k));
  const [kind, setKind] = useState<Kind | undefined>(kinds[0]);
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
    const inUse = chosen(taken.kind) === taken.id;
    const use = () => putToUse(taken.kind, taken.id);
    return (
      <Screen title="It's yours!">
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
      <Screen title="You've won everything!" back>
        <View />
        <>
          <Heading>There's nothing left to win. More rewards are on the way.</Heading>
          {again}
          {done}
        </>
      </Screen>
    );
  }

  const shown = prize === 'any' ? list.filter((r) => r.kind === kind) : list;
  return (
    <Screen title={prize === 'any' ? 'Pick any reward' : 'Pick your prize'} fitFocus>
      <View style={[styles.grid, { gap: ui.sp(10) }]}>
        {shown.map((r) => (
          <RewardTile key={r.id} reward={r} owned status="Tap to take" onPress={() => take(r)} />
        ))}
      </View>
      <>
        <Heading>{prize === 'any' ? 'You won every round! Take any one.' : `You banked a ${label} prize. Choose one.`}</Heading>
        {prize === 'any' && kind ? (
          <KindTabs
            kinds={kinds}
            selected={kind}
            onSelect={setKind}
            count={(k) => {
              const n = list.filter((r) => r.kind === k).length;
              return { text: String(n), spoken: `${n} to choose from` };
            }}
          />
        ) : null}
      </>
    </Screen>
  );
}

// Stage with a title, the first child as the focus and the second as the
// rail. `back` adds the corner ‹ (only where leaving loses nothing).
function Screen({ title, children, fitFocus, back }: { title: string; children: [React.ReactNode, React.ReactNode]; fitFocus?: boolean; back?: boolean }) {
  return (
    <View style={styles.fill}>
      <Stage header={<Heading size="h3" lines={1}>{title}</Heading>} focus={children[0]} actions={children[1]} fitFocus={fitFocus} />
      {back ? <BackButton /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
