import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from '../src/components/Stage';
import { PigInput } from '../src/components/PigInput';
import { FolderTabs } from '../src/components/FolderTabs';
import { TierPages, type TierCard, type TierKey } from '../src/rewards/TierPages';
import { WinnerPig } from '../src/avatar/WinnerPig';
import { partSource, useMyAvatar, useThemeSkins } from '../src/avatar/avatar';
import { DEFAULT_SAY } from '../src/avatar/bubbles';
import { PLACES, partsOf, placeOf, type Place, type ThemePart } from '../src/avatar/themeParts';
import { Card, RewardTile } from '../src/rewards/RewardTile';
import { propThumb } from '../src/rewards/RewardThumb';
import { BUBBLE_MAX, rewardById, rewardsOf, slotOf, type Reward } from '../src/rewards/catalog';
import { cleanBubbleText, useInventory } from '../src/rewards/inventory';
import { useSkin, useTheme } from '../src/theme/theme';
import { UNLOCKABLE, type Skin } from '../src/theme/skins';
import { useUi } from '../src/theme/responsive';

// Your pig, from the menu's Rewards: how everyone in the room sees you when
// you win (src/avatar). The pig on the left (above, held upright), dressed as
// it is now; on the right folder tabs down the rail's left, one per place on
// the pig, and the open one's card the rail's whole height (FolderTabs): that
// place's cards, grouped by tier (TierPages). Tapping one puts it on the pig,
// tapping it again takes it off.
//
// What's on offer: every outfit there is, won or not (src/rewards/catalog.ts),
// and the parts of every theme the player can use (the birthday or holiday in
// season, and the themes they've won: src/avatar/themeParts.ts; never a theme
// not won). An outfit's tier is its own, a won theme's part its theme's, and
// the holiday's parts are In season. Each goes in the tab for where it sits on
// the pig (themeParts.ts placeOf), named for what's really in it so nothing
// there is a surprise:
//
//   Head     hats, and the mohawk, sweatband and bunny ears
//   Face     sunglasses, shades, masks, brows
//   Body     the bow tie, badges, emblems, capes, the jersey
//   Holding  what's in its hooves (and the quiver on its back)
//   Feet     what's at its feet, and the ankle cast
//   Sky      what floats about it: bats, clouds, birds, fireworks…
//   Bubble   the speech bubbles, one at a time, and what the bubble says
//
// A tab with nothing in it isn't shown. Each counts how many of its cards are
// the player's (out of all of them), and a dot marks each tab with
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

// A theme's tier: a won one's own (catalog.ts), the holiday's In season.
const tierOfSkin = (skin: Skin): TierKey => {
  const id = Object.keys(UNLOCKABLE).find((k) => UNLOCKABLE[k] === skin);
  return (id && rewardById(id)?.tier) || 'seasonal';
};

export default function Pig() {
  const ui = useUi();
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

  const tile = (r: Reward): TierCard => {
    const owned = owns(r.id);
    const on = r.kind === 'outfit' ? worn.includes(r.id) : bubble === r.id;
    const toggle = () => (r.kind === 'outfit' ? wear(r.id, !on) : choose('bubble', on ? null : r.id));
    return {
      key: r.id,
      tier: r.tier,
      owned,
      render: (size) => (
        <RewardTile
          reward={r}
          owned={owned}
          chosen={on}
          compact
          inset
          status={owned && !r.soon ? (on ? 'On your pig' : 'Tap to put on') : undefined}
          onPress={owned && !r.soon ? toggle : undefined}
          {...size}
        />
      ),
    };
  };

  // On: the pig wears this theme's part now. Off: taken off, or another
  // theme's (or an outfit in that slot) is on instead.
  // A part that turns into another after dark (Lukas's) shows as it looks now.
  const themeTile = (skin: Skin, part: ThemePart): TierCard => {
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
    const tier = tierOfSkin(skin);
    return {
      key: `${skin.id}:${part.key}`,
      tier,
      owned: true,
      render: ({ width, scale }) => (
        <Card
          picture={propThumb(looks.prop, ui.sp(32) * scale)}
          name={looks.label}
          status={on ? 'On your pig' : 'Tap to put on'}
          owned
          mark={tier === 'rare' || tier === 'premium' ? tier : undefined}
          chosen={on}
          onPress={toggle}
          compact
          inset
          width={width}
          scale={scale}
        />
      ),
    };
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
  // A tab's cards: the speech bubbles, or what goes in that place. Its tab
  // counts the ones the player has (a theme's parts are all theirs).
  const cardsOf = (k: TabKey): TierCard[] => (k === 'bubble' ? rewardsOf('bubble').map(tile) : items.filter((i) => i.place === k).map((i) => i.card));

  return (
    <Stage
      menu
      focus={<WinnerPig avatar={avatar} />}
      actionsFill
      actions={
        <FolderTabs
          tabs={keys.map((k) => {
            const cards = cardsOf(k);
            const owned = cards.filter((c) => c.owned).length;
            return {
              key: k,
              label: TAB_LABELS[k],
              count: { text: `${owned} / ${cards.length}`, spoken: `${owned} of ${cards.length} unlocked` },
              marked: isOn(k) ? { spoken: 'on your pig' } : undefined,
            };
          })}
          selected={open}
          onSelect={setTab}
        >
          <TierPages
            open={open}
            pages={keys.map((k) => ({
              key: k,
              label: TAB_LABELS[k],
              cards: cardsOf(k),
              foot:
                k === 'bubble' ? (
                  <PigInput
                    placeholder={`What your pig says (${DEFAULT_SAY})`}
                    value={draft}
                    onChangeText={setDraft}
                    onEndEditing={() => setBubbleText(draft)}
                    maxLength={BUBBLE_MAX}
                    autoCapitalize="sentences"
                    accessibilityLabel="What your pig says"
                  />
                ) : undefined,
            }))}
          />
        </FolderTabs>
      }
    />
  );
}
