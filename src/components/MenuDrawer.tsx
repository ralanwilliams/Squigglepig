import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { FitBox } from './FitBox';
import { Glyph, type GlyphName } from './Glyph';
import { showToast } from './Toast';
import { IMAGES } from '../assets/assets';
import { font, type Theme } from '../theme/tokens';
import { useReducedMotion, useTheme, useThemeMode, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useAppFrame, useUi, type Ui } from '../theme/responsive';
import {
  APP_STORE_URL,
  CONTACT_EMAIL,
  DEVELOPER_URL,
  HELP_URL,
  PLAY_STORE_APP_URL,
  PLAY_STORE_URL,
  PRIVACY_URL,
  TERMS_URL,
} from '../lib/links';

const VERSION = Constants.expoConfig?.version ?? '';
const OPEN_MS = 220;
const CLOSE_MS = 180;
const NATIVE = Platform.OS !== 'web';

// The menu: a ☰ in the header band's top-LEFT corner of the home screen,
// mirroring the dark-mode toggle in the top-right (Stage already keeps both
// corners clear, so nothing moves to make room). It slides a drawer in from
// the left holding the About information: the app icon, name and version,
// then Support / Legal / Developer links and the copyright line. The drawer is
// painted with the screen's own palette (background, text, link), so it
// follows light / dark mode like everything else. Nothing scrolls: in two-pane
// layouts the groups sit in two columns, and the body is a FitBox.
// `onHowToPlay` replays the first-run walkthrough (Home owns it). The
// Accessibility group holds the switches (High contrast, Reduce motion); each
// shows what is in effect — the phone's setting until it is flipped here.
// With reduced motion the drawer appears and goes without sliding.
export function MenuButton({ onHowToPlay }: { onHowToPlay: () => void }) {
  const ui = useUi();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.corner, { top: ui.insets.top + ui.sp(5), left: ui.insets.left + ui.pad - ui.sp(9) }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menu"
          onPress={() => setOpen(true)}
          hitSlop={6}
          style={({ pressed }) => [styles.hit, { width: ui.sp(44), height: ui.sp(44), opacity: pressed ? 0.6 : 1 }]}
        >
          <Glyph name="menu" size={ui.sp(26)} color={theme.link} />
        </Pressable>
      </View>
      <MenuDrawer open={open} onClose={() => setOpen(false)} onHowToPlay={onHowToPlay} />
    </>
  );
}

type Row = { icon: GlyphName; label: string; onPress?: () => void; trailing?: GlyphName; on?: boolean };

function open(url: string) {
  return Linking.openURL(url);
}

function rate() {
  if (Platform.OS === 'android') return open(PLAY_STORE_APP_URL).catch(() => open(PLAY_STORE_URL));
  return open(APP_STORE_URL ?? PLAY_STORE_URL);
}

function MenuDrawer({
  open: visible,
  onClose,
  onHowToPlay,
}: {
  open: boolean;
  onClose: () => void;
  onHowToPlay: () => void;
}) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const frame = useAppFrame();
  const win = useWindowDimensions();
  const { highContrast, setContrast, reducedMotion, setMotion } = useThemeMode();
  const reduced = useReducedMotion();

  // Stay mounted through the closing slide; unmount once it has finished.
  const [mounted, setMounted] = useState(visible);
  const p = useRef(new Animated.Value(0)).current; // 0 = off screen, 1 = open
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(p, { toValue: 1, duration: reduced ? 0 : OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }).start();
    } else {
      Animated.timing(p, { toValue: 0, duration: reduced ? 0 : CLOSE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(
        ({ finished }) => finished && setMounted(false)
      );
    }
  }, [visible, p, reduced]);

  // On web the game sits in a frame centred in the window (useAppFrame); the
  // drawer slides out of that frame's left edge, not the window's.
  const frameLeft = Platform.OS === 'web' ? Math.max(0, Math.round((win.width - frame.width) / 2)) : 0;
  const width = ui.twoPane
    ? Math.min(ui.insets.left + ui.sp(520), Math.round(frame.width * 0.9))
    : Math.round(frame.width * 0.86);
  const translateX = p.interpolate({ inputRange: [0, 1], outputRange: [-(frameLeft + width + 32), 0] });

  const feedback = () =>
    open(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Squigglepig feedback (v${VERSION})`)}`).catch(() => {
      onClose();
      showToast(`No email app found. Write to ${CONTACT_EMAIL}`, 4000);
    });
  const licenses = () => {
    onClose();
    router.push('/licenses');
  };

  // The walkthrough is a modal too, and iOS won't present one while another is
  // still going away, so it opens once the drawer has slid out.
  const howToPlay = () => {
    onClose();
    setTimeout(onHowToPlay, CLOSE_MS + 60);
  };

  const support: Row[] = [
    { icon: 'play', label: 'How to play', onPress: howToPlay, trailing: 'chevron' },
    { icon: 'feedback', label: 'Send feedback', onPress: feedback, trailing: 'external' },
    // No App Store listing yet, so iOS has nowhere to send a rating.
    ...(Platform.OS === 'ios' && !APP_STORE_URL
      ? []
      : [{ icon: 'star', label: 'Rate this app', onPress: rate, trailing: 'external' } as Row]),
    { icon: 'help', label: 'Help & FAQ', onPress: () => open(HELP_URL), trailing: 'external' },
  ];
  const accessibility: Row[] = [
    { icon: 'contrast', label: 'High contrast', on: highContrast, onPress: () => setContrast(highContrast ? 'normal' : 'high') },
    { icon: 'motion', label: 'Reduce motion', on: reducedMotion, onPress: () => setMotion(reducedMotion ? 'full' : 'reduced') },
  ];
  const legal: Row[] = [
    { icon: 'shield', label: 'Privacy Policy', onPress: () => open(PRIVACY_URL), trailing: 'external' },
    { icon: 'doc', label: 'Terms of Service', onPress: () => open(TERMS_URL), trailing: 'external' },
    { icon: 'code', label: 'Open-source licenses', onPress: licenses, trailing: 'chevron' },
  ];
  const developer: Row[] = [
    { icon: 'person', label: 'Made by R. Alan Williams' },
    { icon: 'globe', label: 'ralanwilliams.com', onPress: () => open(DEVELOPER_URL), trailing: 'external' },
  ];

  const section = (title: string, rows: Row[]) => (
    <View style={{ gap: ui.sp(6) }}>
      <Text style={[styles.sectionTitle, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP} accessibilityRole="header">
        {title}
      </Text>
      <View>
        {rows.map((r) => (
          <MenuRow key={r.label} row={r} ui={ui} theme={theme} styles={styles} />
        ))}
      </View>
    </View>
  );

  const copyright = (
    <Text style={[styles.copyright, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
      © 2026 R. Alan Williams. All rights reserved.
    </Text>
  );

  const icon = ui.twoPane ? ui.sp(44) : ui.sp(60);
  // Two-pane: the width of one link column (drawer less its padding and the gap).
  const columnW = Math.round((width - (ui.insets.left + ui.pad) - ui.pad - ui.gap) / 2);

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: p }]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.drawer,
            {
              left: frameLeft,
              width,
              transform: [{ translateX }],
              gap: ui.sp(12),
              paddingTop: ui.insets.top + ui.sp(12),
              paddingBottom: ui.insets.bottom + ui.sp(12),
              paddingLeft: ui.insets.left + ui.pad,
              paddingRight: ui.pad,
              borderTopRightRadius: ui.sp(16),
              borderBottomRightRadius: ui.sp(16),
            },
          ]}
        >
          <View style={styles.head}>
            <View style={[styles.identity, { gap: ui.sp(14) }]}>
              <Image source={IMAGES.icon} style={{ width: icon, height: icon, borderRadius: Math.round(icon * 0.22) }} />
              <View style={{ gap: ui.sp(2) }}>
                <Text style={[styles.name, { fontSize: ui.f(ui.twoPane ? 22 : 26) }]} maxFontSizeMultiplier={FONT_CAP}>
                  Squigglepig
                </Text>
                <Text style={[styles.version, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP}>
                  Version {VERSION}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={onClose}
              hitSlop={6}
              style={({ pressed }) => [
                styles.hit,
                { width: ui.sp(44), height: ui.sp(44), marginRight: -ui.sp(10), opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Glyph name="close" size={ui.sp(26)} color={theme.link} />
            </Pressable>
          </View>

          <View style={styles.rule} />

          {ui.twoPane ? (
            <>
              <FitBox style={styles.flex} align="top">
                <View style={[styles.columns, { gap: ui.gap }]}>
                  <View style={[styles.column, { gap: ui.sp(12) }]}>
                    {section('Support', support)}
                    {section('Accessibility', accessibility)}
                  </View>
                  <View style={[styles.column, { gap: ui.sp(12) }]}>
                    {section('Legal', legal)}
                    {section('Developer', developer)}
                  </View>
                </View>
              </FitBox>
              {/* Pinned to the foot of the drawer under the (shorter) Legal /
                  Developer column, out of the flow so it costs the links no height. */}
              <View
                style={[
                  styles.footnote,
                  { left: ui.insets.left + ui.pad + columnW + ui.gap, bottom: ui.insets.bottom + ui.sp(12), width: columnW },
                ]}
              >
                {copyright}
              </View>
            </>
          ) : (
            <>
              <FitBox style={styles.flex} align="top">
                <View style={{ gap: ui.sp(12) }}>
                  {section('Support', support)}
                  {section('Accessibility', accessibility)}
                  {section('Legal', legal)}
                  {section('Developer', developer)}
                </View>
              </FitBox>
              <View style={styles.rule} />
              {copyright}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// One line of the drawer: icon, label, and a trailing glyph saying where it
// goes (↗ leaves the app, › opens a screen) or, for a setting, a switch. A row
// without an action is plain text in the muted color.
function MenuRow({ row, ui, theme, styles }: { row: Row; ui: Ui; theme: Theme; styles: ReturnType<typeof makeStyles> }) {
  const isSwitch = row.on !== undefined;
  const ink = row.onPress ? theme.link : theme.textMuted;
  const body = (
    <>
      <Glyph name={row.icon} size={ui.sp(22)} color={ink} weight={1.8} />
      <Text
        style={[styles.label, !row.onPress && styles.staticLabel, { fontSize: ui.f(15) }]}
        numberOfLines={1}
        maxFontSizeMultiplier={FONT_CAP}
      >
        {row.label}
      </Text>
      {isSwitch ? <Toggle on={!!row.on} ui={ui} theme={theme} /> : null}
      {row.trailing ? <Glyph name={row.trailing} size={ui.sp(16)} color={theme.link} weight={2.2} /> : null}
    </>
  );
  const box = [styles.row, { minHeight: ui.sp(38), gap: ui.sp(12), paddingHorizontal: ui.sp(4) }];
  if (!row.onPress) return <View style={box}>{body}</View>;
  return (
    <Pressable
      accessibilityRole={isSwitch ? 'switch' : row.trailing === 'external' ? 'link' : 'button'}
      accessibilityState={isSwitch ? { checked: row.on } : undefined}
      onPress={row.onPress}
      style={({ pressed }) => [box, { opacity: pressed ? 0.6 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

// The switch on a setting row: a pill in the link color. On, it is filled with
// the knob at the right; off, it is an outline with the knob at the left — so
// it reads by shape and position, not by color.
function Toggle({ on, ui, theme }: { on: boolean; ui: Ui; theme: Theme }) {
  const w = ui.sp(38);
  const h = ui.sp(22);
  const knob = h - ui.sp(8);
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        borderWidth: ui.sp(2),
        borderColor: theme.link,
        backgroundColor: on ? theme.link : 'transparent',
        justifyContent: 'center',
        alignItems: on ? 'flex-end' : 'flex-start',
        paddingHorizontal: ui.sp(2),
      }}
    >
      <View style={{ width: knob, height: knob, borderRadius: knob / 2, backgroundColor: on ? theme.background : theme.link }} />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', zIndex: 10 },
  hit: { alignItems: 'center', justifyContent: 'center' },
});

const makeStyles = (t: Theme) => StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1, minHeight: 0 },
  hit: styles.hit,
  scrim: { backgroundColor: t.scrim },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: t.background,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 6, height: 0 },
    elevation: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  name: { color: t.text, fontFamily: font.bold, letterSpacing: 0.2 },
  version: { color: t.textMuted, fontFamily: font.regular },
  rule: { height: 1, backgroundColor: t.divider },
  columns: { flexDirection: 'row' },
  column: { flex: 1, minWidth: 0 },
  footnote: { position: 'absolute' },
  sectionTitle: { color: t.link, fontFamily: font.bold, letterSpacing: 1.2, textTransform: 'uppercase', paddingLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, minWidth: 0, color: t.text, fontFamily: font.regular },
  staticLabel: { color: t.textMuted },
  copyright: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
});
