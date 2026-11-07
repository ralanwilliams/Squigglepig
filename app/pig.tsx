import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { PigInput } from '../src/components/PigInput';
import { TabPages, Tabs } from '../src/components/Tabs';
import { WinnerPig } from '../src/avatar/WinnerPig';
import { partSource, useMyAvatar, useThemeSkins } from '../src/avatar/avatar';
import { DEFAULT_SAY } from '../src/avatar/bubbles';
import { PLACES, partsOf, placeOf, type Place, type ThemePart } from '../src/avatar/themeParts';
import { Card, RewardTile } from '../src/rewards/RewardTile';
import { propThumb } from '../src/rewards/RewardThumb';
import { BUBBLE_MAX, rewardsOf, slotOf, type Reward } from '../src/rewards/catalog';
import { cleanBubbleText, useInventory } from '../src/rewards/inventory';
import { useSkin, useTheme, useThemedStyles } from '../src/theme/theme';
import type { Skin } from '../src/theme/skins';
import { useUi } from '../src/theme/responsive';

// Your pig, from the menu's Rewards: how everyone in the room sees you when
// you win (src/avatar). The pig on the left (above, held upright), dressed as
// it is now; on the right a row of tabs, one per place on the pig, and under
// it that place's cards: tapping one puts it on the pig, tapping it again
// takes it off.
//
// What's on offer: every outfit there is, won or not (src/rewards/catalog.ts),
// and the parts of every theme the player can use (the birthday or holiday in
// season, and the themes they've won: src/avatar/themeParts.ts). Each goes in
// the tab for where it sits on the pig (themeParts.ts placeOf), named for
// what's really in it so nothing there is a surprise:
//
//   Head     hats, and the mohawk, sweatband and bunny ears
//   Face     sunglasses, shades, masks, brows
//   Body     the bow tie, badges, emblems, capes, the jersey
//   Holding  what's in its hooves (and the quiver on its back)
//   Feet     what's at its feet, and the ankle cast
//   Sky      what floats about it: bats, clouds, birds, fireworks…
//   Bubble   the speech bubbles, one at a time, and what the bubble says
//
// A tab with nothing in it isn't shown, and a dot marks each tab with
// something from it on the pig, so it's easy to find what to take off. The
// pig wears one thing in each place, so putting one on takes off what was
// there (inventory.tsx wear, setPart). The theme showing dresses the pig in
// all of its own parts until they're taken off; another theme's part goes on
// in place of the same part (a longbow for the pumpkin).
//
// The bubble's words are kept as typed while the field is in use, and saved
// (cleaned: one line, at most BUBBLE_MAX characters) when it's left or the
// screen is, so a space typed at the end isn't trimmed away mid-word.
type TabKey = Place | 'bubble';
const TAB_LABELS: Record<TabKey, string> = {
  head: 'Head',
  eyes: 'Face',
  neck: 'Body',
  hold: 'Holding',
  feet: 'Feet',
  sky: 'Sky',
  bubble: 'Bubble',
};

export default function Pig() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const dark = useTheme().name === 'dark';
  const { owns, worn, wear, chosen, choose, setPart, showPart, bubbleText, setBubbleText } = useInventory();
  const showing = useSkin();
  const themes = useThemeSkins();
  const mine = useMyAvatar();
  const [draft, setDraft] = useState(bubbleText);
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => () => setBubbleText(latest.current), [setBubbleText]);

  const avatar = useMemo(() => ({ ...mine, say: cleanBubbleText(draft) }), [mine, draft]);
  const bubble = chosen('bubble');

  const tile = (r: Reward) => {
    const owned = owns(r.id);
    const on = r.kind === 'outfit' ? worn.includes(r.id) : bubble === r.id;
    const toggle = () => (r.kind === 'outfit' ? wear(r.id, !on) : choose('bubble', on ? null : r.id));
    return (
      <RewardTile
        key={r.id}
        reward={r}
        owned={owned}
        chosen={on}
        compact
        status={owned && !r.soon ? (on ? 'On your pig' : 'Tap to put on') : undefined}
        onPress={owned && !r.soon ? toggle : undefined}
      />
    );
  };

  // On: the pig wears this theme's part now. Off: taken off, or another
  // theme's (or an outfit in that slot) is on instead.
  // A part that turns into another after dark (Lukas's) shows as it looks now.
  const themeTile = (skin: Skin, part: ThemePart) => {
    const looks = (dark && part.night) || part;
    const on = partSource(mine, showing, part.key) === skin.id;
    const toggle = () => {
      setPart(part.key, on || skin === showing ? null : skin.id);
      if (skin === showing) {
        showPart(skin.id, part.key, !on);
        const outfit = worn.find((id) => slotOf(id) === part.key);
        if (!on && outfit) wear(outfit, false);
      }
    };
    return (
      <Card
        key={`${skin.id}:${part.key}`}
        picture={propThumb(looks.prop, ui.sp(32))}
        name={looks.label}
        status={on ? 'On your pig' : 'Tap to put on'}
        owned
        chosen={on}
        onPress={toggle}
        compact
      />
    );
  };

  // Every card, with where it goes and whether it's on the pig now. Outfits
  // ahead of theme parts in the same place. A part that's there only by day
  // (Lukas's badge) has no card at night, and one there only by night (Ash's
  // cast) none by day.
  const items = [
    ...rewardsOf('outfit').map((r) => ({ place: placeOf(r.slot), on: worn.includes(r.id), card: tile(r) })),
    ...themes.flatMap((s) =>
      partsOf(s)
        .filter((part) => !(dark ? part.dayOnly : part.nightOnly))
        .map((part) => ({ place: placeOf(part.key), on: partSource(mine, showing, part.key) === s.id, card: themeTile(s, part) }))
    ),
  ];
  const keys: TabKey[] = [...PLACES.filter((p) => items.some((i) => i.place === p)), 'bubble'];
  const [tab, setTab] = useState<TabKey>('head');
  const open = keys.includes(tab) ? tab : keys[0];
  const isOn = (k: TabKey) => (k === 'bubble' ? !!bubble : items.some((i) => i.place === k && i.on));

  return (
    <Stage
      menu
      focus={<WinnerPig avatar={avatar} />}
      // The tabs stay put while the cards under them change.
      actionsAlign="top"
      actions={
        <>
          <Tabs
            layout="row"
            tabs={keys.map((k) => ({ key: k, label: TAB_LABELS[k], marked: isOn(k) ? { spoken: 'on your pig' } : undefined }))}
            selected={open}
            onSelect={setTab}
          />
          {/* Every tab's cards are drawn, all one height (TabPages): the
              tabs keep their size and place whichever is open. */}
          <TabPages
            open={keys.indexOf(open)}
            pages={keys.map((k) => (
              <View key={k} style={{ gap: ui.gap }}>
                <View accessibilityLabel={TAB_LABELS[k]} style={[styles.grid, { gap: ui.sp(6) }]}>
                  {k === 'bubble' ? rewardsOf('bubble').map(tile) : items.filter((i) => i.place === k).map((i) => i.card)}
                </View>
                {k === 'bubble' ? (
                  <PigInput
                    placeholder={`What your pig says (${DEFAULT_SAY})`}
                    value={draft}
                    onChangeText={setDraft}
                    onEndEditing={() => setBubbleText(draft)}
                    maxLength={BUBBLE_MAX}
                    autoCapitalize="sentences"
                    accessibilityLabel="What your pig says"
                  />
                ) : null}
              </View>
            ))}
          />
        </>
      }
    />
  );
}

const makeStyles = () => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
