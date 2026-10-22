import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stage } from '../src/components/Stage';
import { Heading } from '../src/components/Heading';
import { Glyph } from '../src/components/Glyph';
import { BackButton } from '../src/components/BackButton';
import { Switch } from '../src/components/Switch';
import { RewardTile } from '../src/rewards/RewardTile';
import { KINDS, REWARDS, isNone, noneOf, rewardsOf, type Kind } from '../src/rewards/catalog';
import { useInventory } from '../src/rewards/inventory';
import { UNLOCKABLE } from '../src/theme/skins';
import { font, type Theme } from '../src/theme/tokens';
import { useSkin, useTheme, useThemeMode, useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi, type Ui } from '../src/theme/responsive';

// Rewards, from the menu drawer (src/components/MenuDrawer.tsx): everything
// there is to win (src/rewards/catalog.ts) and which of it this player owns
// (src/rewards/inventory.tsx). One tab per kind of reward in the rail, that
// kind's rewards as a grid of cards in the art pane. A kind with nothing in it
// yet gets no tab. Nothing scrolls: a kind with more cards than fit is scaled
// down to fit (Stage's fitFocus).
//
// Of a kind the player picks one of (a theme, an outfit), tapping an owned
// card puts it to use; the kind's default (Classic, No outfit) leads the grid
// once there's anything to choose instead of it. Birthdays and holidays show
// over a chosen theme while Seasonal themes is on: the Themes tab has its
// switch under the tabs, the same setting as the menu's (src/theme/theme.tsx).
//
// Development builds add Unlock all / Reset under the tabs, to see every card
// both ways.
const KIND_LIST = (Object.keys(KINDS) as Kind[]).filter((k) => rewardsOf(k).length > 0);

export default function Rewards() {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { owns, grant, reset, chosen, choose } = useInventory();
  const [kind, setKind] = useState<Kind>(KIND_LIST[0]);
  const list = rewardsOf(kind);
  const none = noneOf(kind);
  const inUse = chosen(kind);
  const cards = none && list.some((r) => !r.soon) ? [none, ...list] : list;
  const { seasonal, setSeasonal, sweep } = useThemeMode();
  // A birthday or holiday showing over whichever theme is chosen.
  const showing = useSkin();
  const covered = !!showing && showing !== (UNLOCKABLE[chosen('theme') ?? ''] ?? null);

  // Put a card to use. A new theme restyles every screen, so it arrives
  // behind the same sweep as the light / dark switch — unless a birthday or
  // holiday is covering it, when nothing on screen changes but the ring.
  const use = (id: string | null) => {
    if (id === inUse) return;
    if (kind === 'theme' && !covered) sweep(() => choose(kind, id));
    else choose(kind, id);
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
            chosen={usable && (isNone(r) ? !inUse : inUse === r.id)}
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
        <Text style={[styles.tabLabel, { fontSize: ui.f(15) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
          Seasonal themes
        </Text>
        <Switch on={seasonal} ui={ui} theme={theme} />
      </Pressable>
    ) : null;

  const tabs = (
    <View accessibilityRole="tablist" style={{ gap: ui.sp(4) }}>
      {KIND_LIST.map((k) => (
        <KindTab
          key={k}
          kind={k}
          owned={rewardsOf(k).filter((r) => owns(r.id)).length}
          selected={k === kind}
          onPress={() => setKind(k)}
          ui={ui}
          theme={theme}
          styles={styles}
        />
      ))}
    </View>
  );

  const dev = __DEV__ ? (
    <View style={[styles.devRow, { gap: ui.sp(24) }]}>
      <DevLink label="Unlock all" onPress={() => REWARDS.forEach((r) => grant(r.id))} ui={ui} styles={styles} />
      <DevLink label="Reset" onPress={reset} ui={ui} styles={styles} />
    </View>
  ) : null;

  return (
    <View style={styles.fill}>
      <Stage
        header={<Heading size="h3" lines={1}>Rewards</Heading>}
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
      <BackButton />
    </View>
  );
}

// A tab: the kind's glyph and name, and how many of its rewards are owned.
// The open one sits on a chip; the others are plain rows on the background.
function KindTab({
  kind,
  owned,
  selected,
  onPress,
  ui,
  theme,
  styles,
}: {
  kind: Kind;
  owned: number;
  selected: boolean;
  onPress: () => void;
  ui: Ui;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const total = rewardsOf(kind).length;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${KINDS[kind].label}, ${owned} of ${total} unlocked`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        selected && styles.tabOn,
        {
          minHeight: ui.sp(44),
          gap: ui.sp(12),
          paddingHorizontal: ui.sp(12),
          borderRadius: ui.sp(8),
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Glyph name={KINDS[kind].glyph} size={ui.sp(22)} color={theme.link} weight={1.8} />
      <Text style={[styles.tabLabel, selected && styles.tabLabelOn, { fontSize: ui.f(15) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
        {KINDS[kind].label}
      </Text>
      <Text style={[styles.count, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
        {owned} / {total}
      </Text>
    </Pressable>
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
  fill: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', borderWidth: Math.max(1, t.edge), borderColor: 'transparent' },
  tabOn: { backgroundColor: t.chip, borderColor: t.chipBorder },
  tabLabel: { flex: 1, minWidth: 0, color: t.text, fontFamily: font.regular },
  tabLabelOn: { fontFamily: font.medium },
  count: { color: t.textMuted, fontFamily: font.regular },
  setting: { flexDirection: 'row', alignItems: 'center' },
  devRow: { flexDirection: 'row', justifyContent: 'center' },
  devLink: { color: t.accent, fontFamily: font.bold, textDecorationLine: 'underline' },
});
