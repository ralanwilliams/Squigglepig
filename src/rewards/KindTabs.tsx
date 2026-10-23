import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Glyph } from '../components/Glyph';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { KINDS, type Kind } from './catalog';

// One tab per kind of reward, stacked in a rail: the kind's glyph and name,
// and a count (`count`: what it shows, and what a screen reader says). The
// open one sits on a chip; the others are plain rows on the background. The
// Rewards screen counts what's owned; the top payout, what's on offer.
export function KindTabs({
  kinds,
  selected,
  onSelect,
  count,
}: {
  kinds: Kind[];
  selected: Kind;
  onSelect: (kind: Kind) => void;
  count: (kind: Kind) => { text: string; spoken: string };
}) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View accessibilityRole="tablist" style={{ gap: ui.sp(4) }}>
      {kinds.map((kind) => {
        const on = kind === selected;
        const { text, spoken } = count(kind);
        return (
          <Pressable
            key={kind}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${KINDS[kind].label}, ${spoken}`}
            onPress={() => onSelect(kind)}
            style={({ pressed }) => [
              styles.tab,
              on && styles.tabOn,
              { minHeight: ui.sp(44), gap: ui.sp(12), paddingHorizontal: ui.sp(12), borderRadius: ui.sp(8), opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Glyph name={KINDS[kind].glyph} size={ui.sp(22)} color={theme.link} weight={1.8} />
            <Text style={[styles.label, on && styles.labelOn, { fontSize: ui.f(15) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
              {KINDS[kind].label}
            </Text>
            <Text style={[styles.count, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
              {text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  tab: { flexDirection: 'row', alignItems: 'center', borderWidth: Math.max(1, t.edge), borderColor: 'transparent' },
  tabOn: { backgroundColor: t.chip, borderColor: t.chipBorder },
  label: { flex: 1, minWidth: 0, color: t.text, fontFamily: font.regular },
  labelOn: { fontFamily: font.medium },
  count: { color: t.textMuted, fontFamily: font.regular },
});
