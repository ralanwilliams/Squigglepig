import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Heading } from '../src/components/Heading';
import { Glyph } from '../src/components/Glyph';
import { font, type Theme } from '../src/theme/tokens';
import { useTheme, useThemedStyles } from '../src/theme/theme';
import { FONT_CAP, useUi } from '../src/theme/responsive';
import LICENSES from '../src/assets/licenses.json';

type Pkg = { name: string; version: string; license: string };

// "535 MIT · 28 ISC · …", most common first.
const SUMMARY = Object.entries(
  (LICENSES as Pkg[]).reduce<Record<string, number>>((n, p) => ((n[p.license] = (n[p.license] ?? 0) + 1), n), {})
)
  .sort((a, b) => b[1] - a[1])
  .map(([license, count]) => `${count} ${license}`)
  .join(' · ');

// Open-source licenses, from the menu drawer (src/components/MenuDrawer.tsx):
// every package that ships with the app, its version and its license type.
// The list is generated from node_modules by `npm run licenses`
// (scripts/licenses.mjs). The one screen in the game that scrolls: it is a
// reference list, hundreds of rows long.
export default function Licenses() {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View
      style={[
        styles.safe,
        { paddingTop: ui.insets.top, paddingLeft: ui.insets.left, paddingRight: ui.insets.right },
      ]}
    >
      <View style={{ minHeight: ui.headerBand, paddingTop: ui.sp(10), paddingHorizontal: ui.pad + ui.sp(36), justifyContent: 'center' }}>
        <Heading size="h3" lines={1}>Open-source licenses</Heading>
      </View>
      <View style={[styles.corner, { top: ui.insets.top + ui.sp(5), left: ui.insets.left + ui.pad - ui.sp(9) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={back}
          hitSlop={6}
          style={({ pressed }) => [styles.hit, { width: ui.sp(44), height: ui.sp(44), opacity: pressed ? 0.6 : 1 }]}
        >
          <Glyph name="back" size={ui.sp(26)} color={theme.link} />
        </Pressable>
      </View>

      <FlatList
        data={LICENSES as Pkg[]}
        keyExtractor={(p) => `${p.name}@${p.version}`}
        contentContainerStyle={{ paddingHorizontal: ui.pad, paddingTop: ui.sp(8), paddingBottom: ui.insets.bottom + ui.pad }}
        ListHeaderComponent={
          <View style={{ gap: ui.sp(6), paddingBottom: ui.sp(12) }}>
            <Text style={[styles.intro, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
              Squigglepig is built with {LICENSES.length} open-source packages. Thank you to everyone who made them.
            </Text>
            <Text style={[styles.summary, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
              {SUMMARY}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.rule} />}
        renderItem={({ item }) => (
          <View style={[styles.row, { minHeight: ui.sp(40), gap: ui.sp(10) }]}>
            <Text style={[styles.name, { fontSize: ui.f(15) }]} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
              {item.name} <Text style={[styles.version, { fontSize: ui.f(12) }]}>{item.version}</Text>
            </Text>
            <Text style={[styles.license, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP}>
              {item.license}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  corner: { position: 'absolute', zIndex: 10 },
  hit: { alignItems: 'center', justifyContent: 'center' },
  intro: { color: t.text, fontFamily: font.regular, textAlign: 'center' },
  summary: { color: t.link, fontFamily: font.medium, textAlign: 'center' },
  rule: { height: 1, backgroundColor: t.divider },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, minWidth: 0, color: t.text, fontFamily: font.regular },
  version: { color: t.text, fontFamily: font.regular, opacity: 0.6 },
  license: { color: t.link, fontFamily: font.bold, flexShrink: 0, maxWidth: '45%', textAlign: 'right' },
});
