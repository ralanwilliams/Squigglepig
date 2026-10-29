import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Glyph } from '../src/components/Glyph';
import { Switch } from '../src/components/Switch';
import { RewardTile } from '../src/rewards/RewardTile';
import { KindTabs } from '../src/rewards/KindTabs';
import { GROUPS, KINDS, REWARDS, isNone, noneOf, rewardsOf, type Group, type Kind } from '../src/rewards/catalog';
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
// says which. One tab per kind of reward in the rail, that kind's rewards as
// a grid of cards in the art pane. A kind with nothing in it yet gets no tab.
// Nothing scrolls: a kind with more cards than fit is scaled down to fit
// (Stage's fitFocus).
//
// Of a kind the player picks one of (a theme), tapping an owned card puts it
// to use; the kind's default (Classic) leads the grid once there's anything
// to choose instead of it. Birthdays and holidays show over a chosen theme
// while Seasonal themes is on, but one chosen during a birthday or holiday
// shows over it until it ends (src/theme/theme.tsx). The Themes tab has the
// switch under the tabs, the same setting as the menu's.
//
// Development builds add Unlock all / Reset under the tabs, to see every card
// both ways.
const kindsOf = (group: Group) => (GROUPS[group].kinds as readonly Kind[]).filter((k) => rewardsOf(k).length > 0);

export default function Rewards() {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { owns, grant, reset, chosen } = useInventory();
  const putToUse = useChoose();
  const asked = useLocalSearchParams<{ group?: string }>().group;
  const group: Group = asked && asked in GROUPS ? (asked as Group) : 'art';
  const kinds = kindsOf(group);
  const [kind, setKind] = useState<Kind>(kinds[0]);
  const list = rewardsOf(kind);
  const none = noneOf(kind);
  const inUse = chosen(kind);
  const cards = none && list.some((r) => !r.soon) ? [none, ...list] : list;
  const { seasonal, setSeasonal } = useThemeMode();
  // A theme is in use while it's showing: the chosen one, unless a birthday
  // or holiday is on over it, when no card is, and tapping it brings it back.
  const showing = useSkin();
  const covered = kind === 'theme' && showing !== (UNLOCKABLE[inUse ?? ''] ?? null);
  const used = (id: string | null) => !covered && id === (inUse ?? null);

  // Put a card to use (a theme with the sweep: useChoose).
  const use = (id: string | null) => {
    if (!used(id)) putToUse(kind, id);
  };

  const grid = (
    <View
      accessibilityLabel={KINDS[kind].label}
      style={[styles.grid, { gap: ui.sp(10) }]}
    >
      {cards.map((r) => {
        const usable = !!none && !r.soon && (isNone(r) || owns(r.id));
        return (
          <RewardTile
            key={r.id}
            reward={r}
            owned={isNone(r) || owns(r.id)}
            chosen={usable && used(isNone(r) ? null : r.id)}
            onPress={usable ? () => use(isNone(r) ? null : r.id) : undefined}
          />
        );
      })}
    </View>
  );

  const seasonalRow =
    kind === 'theme' ? (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: seasonal }}
        accessibilityHint="Birthdays and holidays show over your theme"
        onPress={() => setSeasonal(!seasonal)}
        style={({ pressed }) => [
          styles.setting,
          { minHeight: ui.sp(44), gap: ui.sp(12), paddingHorizontal: ui.sp(12), opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Glyph name="season" size={ui.sp(22)} color={theme.link} weight={1.8} />
        <Text style={[styles.settingLabel, { fontSize: ui.f(15) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
          Seasonal themes
        </Text>
        <Switch on={seasonal} ui={ui} theme={theme} />
      </Pressable>
    ) : null;

  const tabs = (
    <KindTabs
      kinds={kinds}
      selected={kind}
      onSelect={setKind}
      count={(k) => {
        const total = rewardsOf(k).length;
        const owned = rewardsOf(k).filter((r) => owns(r.id)).length;
        return { text: `${owned} / ${total}`, spoken: `${owned} of ${total} unlocked` };
      }}
    />
  );

  const dev = __DEV__ ? (
    <View style={[styles.devRow, { gap: ui.sp(24) }]}>
      <DevLink label="Unlock all" onPress={() => REWARDS.forEach((r) => grant(r.id))} ui={ui} styles={styles} />
      <DevLink label="Reset" onPress={reset} ui={ui} styles={styles} />
    </View>
  ) : null;

  return (
    <Stage
      focus={grid}
      fitFocus
      actions={
        <>
          {tabs}
          {seasonalRow}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  setting: { flexDirection: 'row', alignItems: 'center' },
  settingLabel: { flex: 1, minWidth: 0, color: t.text, fontFamily: font.regular },
  devRow: { flexDirection: 'row', justifyContent: 'center' },
  devLink: { color: t.accent, fontFamily: font.bold, textDecorationLine: 'underline' },
});
