import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Linking, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import { router, useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router';
import { FitBox } from './FitBox';
import { Glyph, type GlyphName } from './Glyph';
import { Switch } from './Switch';
import { showToast } from './Toast';
import { AppMark } from './AppMark';
import { TextLink } from './TextLink';
import { GROUPS, groupOf, type RewardsPath } from '../rewards/catalog';
import { pushSupported, setNotificationsOn, useNotificationsOn } from '../lib/push';
import { showWalkthrough } from '../lib/tutorial';
import { font, type Theme } from '../theme/tokens';
import { useReducedMotion, useTheme, useThemeMode, useThemedStyles } from '../theme/theme';
import { ANY_WAY_UP, FONT_CAP, useAppFrame, useUi, type Ui } from '../theme/responsive';
import { Backdrop } from './Backdrop';
import {
  APP_STORE_REVIEW_URL,
  APP_STORE_URL,
  CONTACT_EMAIL,
  DEVELOPER_URL,
  HELP_URL,
  MENU_PAGES,
  PLAY_STORE_APP_URL,
  PLAY_STORE_URL,
  PRIVACY_URL,
  TERMS_URL,
} from '../lib/links';

const VERSION = Constants.expoConfig?.version ?? '';
const OPEN_MS = 220;
const CLOSE_MS = 180;
const NATIVE = Platform.OS !== 'web';

// The menu: a ☰ in the header band's top-LEFT corner, mirroring the sound and
// dark-mode switches in the top-right (Stage already keeps both corners clear,
// so nothing moves to make room). A screen asks for it with Stage's `menu`:
// Home, Create Game, Join Game, the Lobby, Play Solo's game list, Your pig
// and the Rewards screens (Art supplies, Themes). It slides a drawer in from
// the left holding the About information: the app icon, name and version,
// then the Support / Settings / Rewards groups, and pinned to the bottom the
// legal links (Privacy, Terms, Licenses) right over the copyright line, which
// links to the developer's site. The drawer is painted with the screen's own palette
// (background, text, link), so it follows light / dark mode like everything
// else. Nothing scrolls: in two-pane layouts the groups sit in two columns,
// and the body is a FitBox.
// How to play replays the first-run walkthrough (src/lib/tutorial.ts). Settings
// holds the switches: High contrast and Reduce motion show what is in effect
// — the phone's setting until it is flipped here — and Room notifications
// (not on the web) is the one switch for every room notification
// (src/lib/push.ts): on until turned off; if the phone itself was told no,
// turning it on opens the phone's Settings. (Seasonal themes is on the
// Rewards screen's Themes tab, beside the theme cards.)
// Rewards opens what the player has won, a group at a time (app/rewards.tsx:
// Art supplies, Themes), and Your pig (app/pig.tsx), its outfits and bubbles.
// A row for the page already showing just closes the drawer. One of the
// app's pages opened from another (MENU_PAGES: Your pig, Rewards, Licenses)
// takes its place once the drawer has slid away, so Back goes to where the
// menu was first opened; opened from anywhere else it goes on top at once,
// and Back returns there (the Lobby included: the player is still in the
// room). With reduced motion the drawer appears and goes without sliding.
// Opening it puts a keyboard away (Join, Create, Your pig's bubble), and it
// closes if its screen is covered while it's open (a room joined from Join
// Game opening the Lobby over it).
export function MenuButton() {
  const ui = useUi();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  const show = () => {
    Keyboard.dismiss();
    setOpen(true);
  };
  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.corner, { top: ui.insets.top + ui.sp(5), left: ui.insets.left + ui.pad - ui.sp(9) }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Menu"
          onPress={show}
          hitSlop={6}
          style={({ pressed }) => [styles.hit, { width: ui.sp(44), height: ui.sp(44), opacity: pressed ? 0.6 : 1 }]}
        >
          <Glyph name="menu" size={ui.sp(26)} color={theme.link} />
        </Pressable>
      </View>
      <MenuDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

type Row = { icon: GlyphName; label: string; onPress?: () => void; trailing?: GlyphName; on?: boolean };
type MenuPath = '/licenses' | RewardsPath;

function open(url: string) {
  return Linking.openURL(url);
}

// Each platform's own store, opened in the store app where there is one. On the
// web, an iPhone or iPad goes to the App Store and everything else to Play.
function rate() {
  if (Platform.OS === 'android') return open(PLAY_STORE_APP_URL).catch(() => open(PLAY_STORE_URL));
  if (Platform.OS === 'ios') return open(APP_STORE_REVIEW_URL).catch(() => open(APP_STORE_URL));
  const apple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  return open(apple ? APP_STORE_URL : PLAY_STORE_URL);
}

function MenuDrawer({ open: visible, onClose }: { open: boolean; onClose: () => void }) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const frame = useAppFrame();
  const win = useWindowDimensions();
  const { highContrast, setContrast, reducedMotion, setMotion } = useThemeMode();
  const reduced = useReducedMotion();
  const notifyOn = useNotificationsOn() ?? true;
  // The page showing, as a menu row names it (Rewards by its group).
  const pathname = usePathname();
  const group = groupOf(useLocalSearchParams<{ group?: string }>().group);
  const here = pathname === '/rewards' ? `/rewards?group=${group}` : pathname;

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
  // Something to do once the drawer has gone, called off if this screen goes
  // first (the game starting meanwhile).
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    []
  );
  const afterClose = (fn: () => void, ms: number) => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(fn, ms);
  };

  // Replacing the page under the drawer would take the drawer with it, so
  // that waits for the slide out.
  const go = (path: MenuPath) => () => {
    onClose();
    if (path === here) return;
    if (MENU_PAGES.has(pathname)) afterClose(() => router.replace(path), reduced ? 0 : CLOSE_MS);
    else router.push(path);
  };

  // The walkthrough is a modal too, and iOS won't present one while another is
  // still going away, so it opens once the drawer has slid out.
  const howToPlay = () => {
    onClose();
    afterClose(showWalkthrough, CLOSE_MS + 60);
  };

  const support: Row[] = [
    { icon: 'play', label: 'How to play', onPress: howToPlay, trailing: 'chevron' },
    { icon: 'feedback', label: 'Send feedback', onPress: feedback, trailing: 'external' },
    { icon: 'star', label: 'Rate this app', onPress: rate, trailing: 'external' },
    { icon: 'help', label: 'Help & FAQ', onPress: () => open(HELP_URL), trailing: 'external' },
  ];
  const toggleNotifications = () =>
    setNotificationsOn(!notifyOn).then((r) => {
      if (r === 'settings') showToast('Allow notifications for Squigglepig in your phone’s Settings', 4000);
    });
  // Room notifications only where they're sent (not on the web).
  const settings: Row[] = [
    { icon: 'contrast', label: 'High contrast', on: highContrast, onPress: () => setContrast(highContrast ? 'normal' : 'high') },
    { icon: 'motion', label: 'Reduce motion', on: reducedMotion, onPress: () => setMotion(reducedMotion ? 'full' : 'reduced') },
    ...(pushSupported ? [{ icon: 'bell', label: 'Room notifications', on: notifyOn, onPress: toggleNotifications } as Row] : []),
  ];
  const rewards: Row[] = [
    { icon: 'hat', label: 'Your pig', onPress: go('/pig'), trailing: 'chevron' },
    { icon: 'brush', label: GROUPS.art.label, onPress: go('/rewards?group=art'), trailing: 'chevron' },
    { icon: 'palette', label: GROUPS.theme.label, onPress: go('/rewards?group=theme'), trailing: 'chevron' },
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

  // The legal links, side by side and quiet: the Privacy Policy and Terms of
  // Service (the stores want the privacy policy reachable in the app), and
  // the bundled packages' licenses with the Quick, Draw! credit, which must
  // ship with it. Short on screen so the three fit on one line anywhere; a
  // screen reader hears each one's full name. Pinned to the bottom, just
  // over the copyright, packed tight (TextLink dense).
  const dot = (
    <Text style={[styles.dot, { fontSize: ui.f(13) }]} maxFontSizeMultiplier={FONT_CAP} importantForAccessibility="no" accessibilityElementsHidden>
      ·
    </Text>
  );
  const legal = (
    <View style={[styles.legal, { gap: ui.sp(10) }]}>
      <TextLink label="Privacy" spoken="Privacy Policy" onPress={() => open(PRIVACY_URL)} size={13} role="link" dense />
      {dot}
      <TextLink label="Terms" spoken="Terms of Service" onPress={() => open(TERMS_URL)} size={13} role="link" dense />
      {dot}
      <TextLink label="Licenses" spoken="Licenses and credits" onPress={go('/licenses')} size={13} dense />
    </View>
  );

  // The copyright carries the link to the developer's site: after it on the
  // one line two panes have room for, on a line of its own under it in one
  // column (where a single line would wrap mid-sentence).
  const copyright = (
    <Text style={[styles.copyright, { fontSize: ui.f(12) }]} maxFontSizeMultiplier={FONT_CAP}>
      © 2026 R. Alan Williams. All rights reserved.{ui.twoPane ? ' · ' : '\n'}
      <Text style={styles.site} accessibilityRole="link" onPress={() => open(DEVELOPER_URL)}>
        ralanwilliams.com
      </Text>
    </Text>
  );

  const icon = ui.twoPane ? ui.sp(44) : ui.sp(60);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={ANY_WAY_UP}
      onRequestClose={onClose}
    >
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
          <Backdrop style={{ borderTopRightRadius: ui.sp(16), borderBottomRightRadius: ui.sp(16) }} />
          <View style={styles.head}>
            <View style={[styles.identity, { gap: ui.sp(14) }]}>
              <AppMark size={icon} rounded />
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

          {/* The groups, then the foot across the bottom, under a rule, in the
              flow (so the FitBox makes room for it rather than the groups
              running into it): the legal links right over the copyright. */}
          <FitBox style={styles.flex} align="top">
            {ui.twoPane ? (
              <View style={[styles.columns, { gap: ui.gap }]}>
                <View style={[styles.column, { gap: ui.sp(12) }]}>
                  {section('Support', support)}
                </View>
                <View style={[styles.column, { gap: ui.sp(12) }]}>
                  {section('Settings', settings)}
                  {section('Rewards', rewards)}
                </View>
              </View>
            ) : (
              <View style={{ gap: ui.sp(12) }}>
                {section('Support', support)}
                {section('Settings', settings)}
                {section('Rewards', rewards)}
              </View>
            )}
          </FitBox>
          <View style={styles.rule} />
          <View>
            {legal}
            {copyright}
          </View>
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
      {isSwitch ? <Switch on={!!row.on} ui={ui} theme={theme} /> : null}
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
  sectionTitle: { color: t.link, fontFamily: font.bold, letterSpacing: 1.2, textTransform: 'uppercase', paddingLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1, minWidth: 0, color: t.text, fontFamily: font.regular },
  staticLabel: { color: t.textMuted },
  legal: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dot: { color: t.textMuted, fontFamily: font.regular },
  copyright: { color: t.textMuted, fontFamily: font.regular, textAlign: 'center' },
  site: { color: t.link, textDecorationLine: 'underline' },
});
