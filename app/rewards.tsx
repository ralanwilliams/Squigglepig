import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Glyph } from '../src/components/Glyph';
import { Switch } from '../src/components/Switch';
import { Logo } from '../src/components/Logo';
import { DrawingBoard, useDrawingStore } from '../src/components/DrawingBoard';
import { IMAGES } from '../src/assets/assets';
import { RewardTile } from '../src/rewards/RewardTile';
import { FolderTabs } from '../src/components/FolderTabs';
import { TierPages, type TierCard } from '../src/rewards/TierPages';
import { GROUPS, KINDS, REWARDS, groupOf, isNone, noneOf, rewardsOf, type Group, type Kind } from '../src/rewards/catalog';
import { useInventory } from '../src/rewards/inventory';
import { useChoose } from '../src/rewards/useChoose';
import { font, type Theme } from '../src/theme/tokens';
import { useSkin, useTheme, useThemeMode, useThemedStyles } from '../src/theme/theme';
import { UNLOCKABLE } from '../src/theme/skins';
import { FONT_CAP, useUi, type Ui } from '../src/theme/responsive';

// Rewards, from the menu drawer (src/components/MenuDrawer.tsx): what there
// is to win (src/rewards/catalog.ts) and which of it this player owns
// (src/rewards/inventory.tsx), one group of kinds at a time (catalog GROUPS:
// Art supplies, Themes; ?group= from the menu row), untitled: the menu row
// says which, and the ☰ goes to another. The art pane shows the group's
// rewards at work (catalog GROUPS `show`); the rail has folder tabs down its
// left, one per kind of reward with how many of it are won, the first open,
// and the open one's card the rail's whole height (FolderTabs): that kind's
// rewards, won or not, grouped by tier under headings (TierPages), as the
// compact cards Your pig has (the ring and lock still say where the player
// stands, and a screen reader still hears it). A kind with nothing in it yet
// gets no tab. Nothing scrolls: the cards fill the card's width and shrink to
// fit its height when they must, every tab at the size of the tallest.
//
// Art supplies has the drawing canvas from the game (DrawingBoard), to try
// out the brushes and sticker packs won, with the game's zoom and Clear · Undo
// on it. The drawing goes nowhere: it's gone when the screen closes.
//
// Themes has the home screen's pig, whole and dressed as it is there (the
// theme showing and the player's own look). Using a theme puts it on the pig
// at once.
//
// Of a kind the player picks one of (a theme), tapping an owned card puts it
// to use; the kind's default (Classic) leads the grid once there's anything
// to choose instead of it. Birthdays and holidays show over a chosen theme
// while Seasonal themes is on, but one chosen during a birthday or holiday
// shows over it until it ends (src/theme/theme.tsx). Classic is Free, a tier
// of its own. The Themes card has the Seasonal themes switch at its bottom,
// the same setting as the menu's.
//
// Development builds add Unlock all / Reset under the card, to see every card
// both ways.
const kindsOf = (group: Group) => (GROUPS[group].kinds as readonly Kind[]).filter((k) => rewardsOf(k).length > 0);

export default function Rewards() {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { owns, grant, reset, chosen } = useInventory();
  const putToUse = useChoose();
  const group = groupOf(useLocalSearchParams<{ group?: string }>().group);
  const kinds = kindsOf(group);
  // The open tab: the first, until one is picked (and if the group changes
  // under it, the new group's first).
  const [picked, setPicked] = useState<Kind>(kinds[0]);
  const kind = kinds.includes(picked) ? picked : kinds[0];
  const { seasonal, setSeasonal } = useThemeMode();
  const showing = useSkin();

  const show = GROUPS[group].show;
  // The drawing's kept here, so it lasts through the phone turning.
  const drawing = useDrawingStore();

  // One kind's cards, each with its tier (Classic is Free), for TierPages to
  // lay out at the size it gives them.
  const cardsFor = (k: Kind): TierCard[] => {
    const list = rewardsOf(k);
    const none = noneOf(k);
    const inUse = chosen(k);
    const cards = none && list.some((r) => !r.soon) ? [none, ...list] : list;
    // A theme is in use while it's showing: the chosen one, unless a birthday
    // or holiday is on over it, when no card is, and tapping it brings it back.
    const covered = k === 'theme' && showing !== (UNLOCKABLE[inUse ?? ''] ?? null);
    const used = (id: string | null) => !covered && id === (inUse ?? null);
    // Put a card to use (a theme with the sweep: useChoose).
    const use = (id: string | null) => {
      if (!used(id)) putToUse(k, id);
    };
    return cards.map((r) => {
      const owned = isNone(r) || owns(r.id);
      const usable = !!none && !r.soon && owned;
      return {
        key: r.id,
        tier: isNone(r) ? 'free' : r.tier,
        owned,
        render: (size) => (
          <RewardTile
            reward={r}
            owned={owned}
            chosen={usable && used(isNone(r) ? null : r.id)}
            onPress={usable ? () => use(isNone(r) ? null : r.id) : undefined}
            compact
            inset
            {...size}
          />
        ),
      };
    });
  };

  const seasonalRow = (k: Kind) =>
    k === 'theme' ? (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: seasonal }}
        accessibilityHint="Birthdays and holidays show over your theme. Choosing a theme switches this off until the next one"
        onPress={() => setSeasonal(!seasonal)}
        style={({ pressed }) => [
          styles.setting,
          { minHeight: ui.sp(40), gap: ui.sp(12), paddingHorizontal: ui.sp(4), opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Glyph name="season" size={ui.sp(22)} color={theme.link} weight={1.8} />
        <Text style={[styles.settingLabel, { fontSize: ui.f(14) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
          Seasonal themes
        </Text>
        <Switch on={seasonal} ui={ui} theme={theme} />
      </Pressable>
    ) : null;

  const tabs = kinds.map((k) => {
    const total = rewardsOf(k).length;
    const owned = rewardsOf(k).filter((r) => owns(r.id)).length;
    return { key: k, label: KINDS[k].label, count: { text: `${owned} / ${total}`, spoken: `${owned} of ${total} unlocked` } };
  });

  const dev = __DEV__ ? (
    <View style={[styles.devRow, { gap: ui.sp(24) }]}>
      <DevLink label="Unlock all" onPress={() => REWARDS.forEach((r) => grant(r.id))} ui={ui} styles={styles} />
      <DevLink label="Reset" onPress={reset} ui={ui} styles={styles} />
    </View>
  ) : null;

  return (
    <Stage
      menu
      focus={show === 'canvas' ? <DrawingBoard store={drawing} /> : <Logo source={IMAGES.home} />}
      actionsFill
      actions={
        <>
          <FolderTabs tabs={tabs} selected={kind} onSelect={setPicked}>
            <TierPages open={kind} pages={kinds.map((k) => ({ key: k, label: KINDS[k].label, cards: cardsFor(k), foot: seasonalRow(k) }))} />
          </FolderTabs>
          {dev}
        </>
      }
    />
  );
}

function DevLink({ label, onPress, ui, styles }: { label: string; onPress: () => void; ui: Ui; styles: ReturnType<typeof makeStyles> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ minHeight: ui.sp(36), justifyContent: 'center' }}>
      <Text style={[styles.devLink, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  setting: { flexDirection: 'row', alignItems: 'center' },
  settingLabel: { flex: 1, minWidth: 0, color: t.surfaceText, fontFamily: font.regular },
  devRow: { flexDirection: 'row', justifyContent: 'center' },
  devLink: { color: t.accent, fontFamily: font.bold, textDecorationLine: 'underline' },
});
