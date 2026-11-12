import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Stage } from '../components/Stage';
import { Heading } from '../components/Heading';
import { Hint } from '../components/Hint';
import { PigButton } from '../components/PigButton';
import { FolderTabs } from '../components/FolderTabs';
import { useScreenBackGuard } from '../lib/backGuard';
import { confirmLeave } from '../lib/confirm';
import { RewardTile } from '../rewards/RewardTile';
import { TierPages, type TierCount } from '../rewards/TierPages';
import { KINDS, homeOf, type Kind, type Reward, type Tier } from '../rewards/catalog';
import { useInventory } from '../rewards/inventory';
import { useChoose } from '../rewards/useChoose';
import { FONT_CAP, useUi } from '../theme/responsive';
import { font, type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';
import { playSound } from '../lib/sound';
import { SOUNDS } from '../assets/assets';
import { LADDER, ROUNDS, type Prize } from './engine';
import { prizes } from './payout';

// The end of a banked run: choose a prize, then it's yours. On offer is
// every reward of the pot's tier not yet won (payout.ts prizes; the nearest
// tier with something left, if that one has nothing, and the message says
// so), laid out as on the Rewards screens: folder tabs, one per kind on
// offer with how many there are, the open one's card those prizes under the
// tier's heading (FolderTabs, TierPages). Tapping one picks it: it's ringed
// and shown half as big again beside the folder, and Take gives it. Nothing
// is picked to start.
//
// A won reward of a kind worn one at a time (a theme) can be put to use there
// and then. A button opens the screen the prize is kept on (catalog.ts
// homeOf), and a hint says where rewards are found later. An outfit or a
// speech bubble is put on at Your pig, where it's seen on the pig, so there
// Dress your pig stands in for Use it. With nothing left to give, it says so.

// The tabs' names: the kinds', short enough for a tab (speech bubbles as Your pig has them).
const TAB_LABELS: Partial<Record<Kind, string>> = { bubble: 'Bubbles' };
const toChoose: TierCount = (_, total) => ({ text: `${total} to choose from`, spoken: `${total} to choose from` });

export function PayoutScreen({ prize, onAgain, onDone }: { prize: Prize; onAgain: () => void; onDone: () => void }) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const { owned, grant, uses } = useInventory();
  const putToUse = useChoose();
  // Drawn once: what's on offer doesn't change as the screen re-renders, or
  // when the prize taken joins what's owned.
  const [{ tier, list }] = useState(() => prizes(prize, owned));
  const [picked, setPicked] = useState<Reward | null>(null);
  const [taken, setTaken] = useState<Reward | null>(null);
  const kinds = (Object.keys(KINDS) as Kind[]).filter((k) => list.some((r) => r.kind === k));
  const [tab, setTab] = useState<Kind | undefined>(kinds[0]);
  const named = (t: Tier) => LADDER.find((s) => s.prize === t)?.label.toLowerCase();

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

  const message =
    (prize === 'premium' ? `You won all ${ROUNDS} rounds! Choose a premium prize.` : `You banked a ${named(prize)} prize. Choose one.`) +
    (tier !== prize ? ` There are no ${named(prize)} ones left, so choose a ${named(tier)} one.` : '');
  const open = tab && kinds.includes(tab) ? tab : kinds[0];

  return (
    <Stage
      fitFocus
      // Beside the folder: the message, the prize picked (half as big again), and Take.
      focus={
        <View style={[styles.pick, { gap: ui.sp(14), maxWidth: ui.sp(360) }]}>
          <Heading>{message}</Heading>
          {picked ? (
            <View style={[styles.center, { minHeight: ui.sp(172) }]}>
              <View style={{ transform: [{ scale: 1.5 }] }}>
                <RewardTile reward={picked} owned status="Your pick" />
              </View>
            </View>
          ) : (
            <View style={[styles.center, { minHeight: ui.sp(172) }]}>
              <View style={[styles.empty, { width: ui.sp(126), height: ui.sp(150), borderRadius: ui.sp(18), padding: ui.sp(12) }]}>
                <Text style={[styles.emptyText, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
                  Tap a prize to select it
                </Text>
              </View>
            </View>
          )}
          <PigButton name={picked ? `Take ${picked.label}` : 'Take it'} onPress={() => picked && take(picked)} disabled={!picked} />
        </View>
      }
      actionsFill
      actions={
        <FolderTabs
          tabs={kinds.map((k) => {
            const n = list.filter((r) => r.kind === k).length;
            return { key: k, label: TAB_LABELS[k] ?? KINDS[k].label, count: { text: `${n}`, spoken: `${n} to choose from` } };
          })}
          selected={open}
          onSelect={setTab}
        >
          <TierPages
            open={open}
            count={toChoose}
            pages={kinds.map((k) => ({
              key: k,
              label: KINDS[k].label,
              cards: list
                .filter((r) => r.kind === k)
                .map((r) => {
                  const on = picked?.id === r.id;
                  return {
                    key: r.id,
                    tier: r.tier,
                    owned: true,
                    render: (size) => (
                      <RewardTile reward={r} owned chosen={on} status={on ? 'Your pick' : 'Tap to pick'} onPress={() => setPicked(r)} compact inset {...size} />
                    ),
                  };
                }),
            }))}
          />
        </FolderTabs>
      }
    />
  );
}

// Stage, untitled and with no back arrow, like every screen, with the first
// child as the focus and the second as the rail (the prize taken, and
// nothing left to win).
function Screen({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  return <Stage focus={children[0]} actions={children[1]} />;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pick: { width: '100%', alignSelf: 'center', alignItems: 'stretch' },
  // Where the prize goes once one is picked.
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.chip,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: t.chipBorder,
  },
  emptyText: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
});
