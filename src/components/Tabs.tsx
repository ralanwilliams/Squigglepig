import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Glyph, type GlyphName } from './Glyph';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';

// Tabs that pick which group of things a screen shows. The open one sits on a
// chip; the others are plain on the background.
//
//   rail — stacked rows, each with its glyph, name and a count on the right
//          (the Rewards screen: what's owned of each kind).
//   row  — short names side by side, wrapping onto a second line when they
//          don't fit (Your pig: where things go on the pig). `marked` puts a
//          dot after the name (there, something from that tab is on the pig).
export type TabItem<K extends string> = {
  key: K;
  label: string;
  glyph?: GlyphName;
  count?: { text: string; spoken: string }; // rail: what it shows, and what a screen reader says
  marked?: { spoken: string }; // row: the dot, and what a screen reader says for it
};

export function Tabs<K extends string>({
  tabs,
  selected,
  onSelect,
  layout = 'rail',
}: {
  tabs: TabItem<K>[];
  selected: K;
  onSelect: (key: NoInfer<K>) => void;
  layout?: 'rail' | 'row';
}) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const row = layout === 'row';
  return (
    <View accessibilityRole="tablist" style={[row && styles.row, { gap: ui.sp(row ? 6 : 4) }]}>
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
            hitSlop={row ? { top: 2, bottom: 2 } : undefined}
            style={({ pressed }) => [
              styles.tab,
              on && styles.tabOn,
              {
                minHeight: ui.sp(row ? 40 : 44),
                gap: ui.sp(row ? 6 : 12),
                paddingHorizontal: ui.sp(row ? 14 : 12),
                borderRadius: ui.sp(8),
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            {!row && tab.glyph ? <Glyph name={tab.glyph} size={ui.sp(22)} color={theme.link} weight={1.8} /> : null}
            <Text
              style={[styles.label, !row && styles.labelFill, on && styles.labelOn, { fontSize: ui.f(row ? 14 : 15) }]}
              numberOfLines={1}
              maxFontSizeMultiplier={FONT_CAP}
            >
              {tab.label}
            </Text>
            {!row && tab.count ? (
              <Text style={[styles.count, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
                {tab.count.text}
              </Text>
            ) : null}
            {row && tab.marked ? <View style={[styles.mark, { width: ui.sp(6), height: ui.sp(6), borderRadius: ui.sp(3) }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// What's under the tabs: one page per tab, all as tall as the tallest, with
// the open one showing. Switching tabs never changes the height, so nothing
// around the pages moves, and a FitBox around them keeps one scale (a tab
// with more cards would otherwise shrink the tabs with it). The pages sit
// side by side in a strip as wide as all of them, slid to the open one; the
// rest are out of sight, out of reach and hidden from screen readers.
export function TabPages({ open, pages }: { open: number; pages: React.ReactNode[] }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    if (width !== w) setW(width);
  };
  return (
    <View onLayout={onLayout} style={styles.clip}>
      {w ? (
        <View style={[styles.strip, { width: w * pages.length, transform: [{ translateX: -w * open }] }]}>
          {pages.map((page, i) => (
            <View
              key={i}
              style={{ width: w }}
              pointerEvents={i === open ? 'auto' : 'none'}
              accessibilityElementsHidden={i !== open}
              importantForAccessibility={i === open ? 'auto' : 'no-hide-descendants'}
            >
              {page}
            </View>
          ))}
        </View>
      ) : (
        // Before the width is known: just the open page.
        pages[open]
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  strip: { flexDirection: 'row' },
});

const makeStyles = (t: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', borderWidth: Math.max(1, t.edge), borderColor: 'transparent' },
  tabOn: { backgroundColor: t.chip, borderColor: t.chipBorder },
  label: { color: t.text, fontFamily: font.regular },
  labelFill: { flex: 1, minWidth: 0 },
  labelOn: { fontFamily: font.medium },
  count: { color: t.textMuted, fontFamily: font.regular },
  mark: { backgroundColor: t.accent },
});
