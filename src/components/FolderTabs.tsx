import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// Tabs down the left of a card, like a folder's: the open one is the card's
// own color and runs into its edge, with a curve above and below where they
// meet, and the card beside the tabs holds the open tab's page (`children`).
// It fills the box it's given, the card its whole height whichever tab is
// open, so nothing moves from tab to tab, and the tabs share its height (as
// tall as they'd like with room, shorter when there are many). The Rewards
// screens (one tab per kind of reward) and Your pig (one per place on the pig,
// a dot on one with something from it on), each with how many are won.
export type FolderTab<K extends string> = {
  key: K;
  label: string;
  count?: { text: string; spoken: string }; // under the name, and what a screen reader says
  marked?: { spoken: string }; // a dot after the name, and what a screen reader says
};

const TAB_W = 72; // base dp
const CURVE = 12; // the curves where the open tab meets the card
// A tab's height, base dp: FULL when the box has room, down to LEAST when
// there are many (Your pig's seven), so every tab fits the box's height.
const FULL = { counted: 40, plain: 30 };
const LEAST = { counted: 30, plain: 26 };
const TOP = 14; // from the card's top to the first tab
const GAP = 4;

export function FolderTabs<K extends string>({
  tabs,
  selected,
  onSelect,
  children,
}: {
  tabs: FolderTab<K>[];
  selected: K;
  onSelect: (key: NoInfer<K>) => void;
  children: React.ReactNode;
}) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const counted = tabs.some((t) => t.count);
  const curve = ui.sp(CURVE);
  const [boxH, setBoxH] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (Math.abs(h - boxH) > 0.5) setBoxH(h);
  };
  const full = ui.sp(counted ? FULL.counted : FULL.plain);
  const least = ui.sp(counted ? LEAST.counted : LEAST.plain);
  const share = (boxH - ui.sp(TOP) - ui.sp(GAP) * (tabs.length - 1)) / tabs.length;
  const tabH = boxH ? Math.max(least, Math.min(full, share)) : full;

  return (
    <View style={styles.row} onLayout={onLayout}>
      <View accessibilityRole="tablist" style={[styles.tabs, { width: ui.sp(TAB_W), paddingTop: ui.sp(TOP), gap: ui.sp(GAP) }]}>
        {tabs.map((tab) => {
          const on = tab.key === selected;
          const spoken = [tab.label, tab.count?.spoken, tab.marked?.spoken].filter(Boolean).join(', ');
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={spoken}
              onPress={() => onSelect(tab.key)}
              style={({ pressed }) => [
                styles.tab,
                on && styles.tabOn,
                {
                  height: tabH,
                  paddingHorizontal: ui.sp(4),
                  borderTopLeftRadius: ui.sp(12),
                  borderBottomLeftRadius: ui.sp(12),
                  opacity: pressed && !on ? 0.6 : 1,
                },
              ]}
            >
              <View style={[styles.nameRow, { gap: ui.sp(4) }]}>
                <Text
                  style={[styles.label, on && styles.labelOn, { fontSize: ui.f(12), lineHeight: ui.f(15) }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={FONT_CAP}
                >
                  {tab.label}
                </Text>
                {tab.marked ? <View style={[styles.mark, { width: ui.sp(6), height: ui.sp(6), borderRadius: ui.sp(3) }]} /> : null}
              </View>
              {tab.count ? (
                <Text style={[styles.count, { fontSize: ui.f(10), lineHeight: ui.f(12) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
                  {tab.count.text}
                </Text>
              ) : null}
              {/* The curves into the card's edge, above and below. */}
              {on ? (
                <>
                  <Svg width={curve} height={curve} viewBox="0 0 12 12" style={[styles.curve, { top: -curve }]} pointerEvents="none">
                    <Path d="M12 0V12H0A12 12 0 0 0 12 0Z" fill={theme.surface} />
                  </Svg>
                  <Svg width={curve} height={curve} viewBox="0 0 12 12" style={[styles.curve, { bottom: -curve }]} pointerEvents="none">
                    <Path d="M0 0H12V12A12 12 0 0 0 0 0Z" fill={theme.surface} />
                  </Svg>
                </>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.card, { borderRadius: ui.sp(16), borderTopLeftRadius: ui.sp(4), padding: ui.sp(8) }]}>{children}</View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  row: { flex: 1, minHeight: 0, flexDirection: 'row' },
  // Over the card, so the open tab covers its edge.
  tabs: { alignSelf: 'flex-start', zIndex: 2, elevation: 3 },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.chip,
    borderWidth: Math.max(1, t.edge),
    borderRightWidth: 0,
    borderColor: t.chipBorder,
  },
  tabOn: {
    backgroundColor: t.surface,
    borderColor: t.edge ? t.surfaceBorder : t.surface,
    marginRight: -Math.max(1, t.edge),
    shadowColor: t.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: -3, height: 4 },
  },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  label: { color: t.text, fontFamily: font.regular, textAlign: 'center' },
  labelOn: { color: t.surfaceText, fontFamily: font.bold },
  count: { color: t.textMuted, fontFamily: font.regular },
  mark: { backgroundColor: t.accent },
  curve: { position: 'absolute', right: 0 },
  card: {
    flex: 1,
    minWidth: 0,
    zIndex: 1,
    backgroundColor: t.surface,
    borderWidth: t.edge,
    borderColor: t.surfaceBorder,
    shadowColor: t.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
