import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { PigInput } from '../src/components/PigInput';
import { WinnerPig } from '../src/avatar/WinnerPig';
import { partSource, useMyAvatar, useThemeSkins } from '../src/avatar/avatar';
import { DEFAULT_SAY } from '../src/avatar/bubbles';
import { partsOf, placeRank, type ThemePart } from '../src/avatar/themeParts';
import { Card, RewardTile } from '../src/rewards/RewardTile';
import { propThumb } from '../src/rewards/RewardThumb';
import { BUBBLE_MAX, rewardsOf, slotOf, type Reward } from '../src/rewards/catalog';
import { cleanBubbleText, useInventory } from '../src/rewards/inventory';
import { font, type Theme } from '../src/theme/tokens';
import { useSkin, useThemedStyles } from '../src/theme/theme';
import type { Skin } from '../src/theme/skins';
import { FONT_CAP, useUi } from '../src/theme/responsive';

// Your pig, from the menu's Rewards: how everyone in the room sees you when
// you win (src/avatar). The pig on the left (above, held upright), dressed as
// it is now; on the right two groups of cards, and tapping one puts it on the
// pig, tapping it again takes it off.
//
// Accessories: every outfit there is, won or not (src/rewards/catalog.ts),
// and the parts of every theme the player can use (the birthday or holiday
// in season, and the themes they've won: src/avatar/themeParts.ts), in one
// list ordered by where they go on the pig (themeParts.ts placeRank): hats,
// eyewear, neckwear, what it holds, what's at its feet, what floats about
// it. The pig wears one thing in each place — a crown or the witch hat, the
// sunglasses or a visor — so putting one on takes off what was there
// (inventory.tsx wear, setPart). The theme showing dresses the pig in all of
// its own parts until they're taken off; another theme's part goes on in
// place of the same part (a longbow for the pumpkin).
//
// Speech bubbles: the bubbles, one at a time, and what the bubble says. The
// words are kept as typed while the field is in use, and saved (cleaned: one
// line, at most BUBBLE_MAX characters) when it's left or the screen is, so a
// space typed at the end isn't trimmed away mid-word.
export default function Pig() {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
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
  const themeTile = (skin: Skin, part: ThemePart) => {
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
        picture={propThumb(part.prop, ui.sp(32))}
        name={part.label}
        status={on ? 'On your pig' : 'Tap to put on'}
        owned
        chosen={on}
        onPress={toggle}
        compact
      />
    );
  };

  const group = (label: string, cards: React.ReactNode[], after?: React.ReactNode) => (
    <View style={{ gap: ui.sp(6) }}>
      <Text style={[styles.groupTitle, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP} accessibilityRole="header">
        {label}
      </Text>
      <View style={[styles.grid, { gap: ui.sp(6) }]}>{cards}</View>
      {after}
    </View>
  );

  // Outfits ahead of theme parts in the same place; sort is stable.
  const accessories = [
    ...rewardsOf('outfit').map((r) => ({ rank: placeRank(r.slot), card: tile(r) })),
    ...themes.flatMap((s) => partsOf(s).map((part) => ({ rank: placeRank(part.key), card: themeTile(s, part) }))),
  ]
    .sort((a, b) => a.rank - b.rank)
    .map((a) => a.card);

  return (
    <Stage
      focus={<WinnerPig avatar={avatar} />}
      actions={
        <>
          {group('Accessories', accessories)}
          {group(
            'Speech bubbles',
            rewardsOf('bubble').map(tile),
            <PigInput
              placeholder={`What your pig says (${DEFAULT_SAY})`}
              value={draft}
              onChangeText={setDraft}
              onEndEditing={() => setBubbleText(draft)}
              maxLength={BUBBLE_MAX}
              autoCapitalize="sentences"
              accessibilityLabel="What your pig says"
            />
          )}
        </>
      }
    />
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  groupTitle: { color: t.link, fontFamily: font.bold, letterSpacing: 1.2, textTransform: 'uppercase', paddingLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
