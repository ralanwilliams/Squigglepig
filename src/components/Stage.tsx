import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { FitBox } from './FitBox';
import { useUi } from '../theme/responsive';
import { type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';

// The one screen layout. Nothing scrolls, in either orientation: the screen is
// treated as a single picture that scales to the device.
//
//  - Two-pane (a phone on its side, or any tablet): a title band on top, the
//    `focus` (art / drawing) filling the left, the `actions` (controls) in a
//    fixed-width rail on the right.
//  - One column (a phone held upright): title band, then focus and actions
//    split the height between them.
//
// The focus pane is plain flex — art fills it. The actions pane is a FitBox: if
// its content is shorter than the pane it is centred and the slack becomes
// breathing room; if it is taller it is scaled down as a unit until it fits.
// A screen whose focus can also vary in height passes `fitFocus`.
//
// When a keyboard opens the window shrinks (Android `resize` mode / iOS
// KeyboardAvoidingView), the panes shrink with it and FitBox re-fits — so
// inputs stay where they are, above the keyboard, without any scrolling.
export function Stage({
  header,
  focus,
  actions,
  fitFocus,
}: {
  header?: React.ReactNode;
  focus: React.ReactNode;
  actions?: React.ReactNode;
  fitFocus?: boolean;
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const twoPane = ui.twoPane && !!actions;

  const frame = {
    paddingTop: ui.insets.top,
    paddingBottom: ui.insets.bottom,
    paddingLeft: ui.insets.left,
    paddingRight: ui.insets.right,
  };

  // The band is always reserved (even when empty) so the row below — and with it
  // the pig — sits in the same place on every screen. Its sides keep clear of
  // the dark-mode toggle floating in the top-right corner (ThemeToggleOverlay);
  // both sides, so a centred title stays centred.
  const band = (
    <View
      style={[
        styles.header,
        { minHeight: ui.headerBand, paddingHorizontal: ui.pad + ui.sp(36), paddingTop: ui.sp(10) },
      ]}
    >
      {header}
    </View>
  );

  const focusPane = fitFocus ? (
    <FitBox style={styles.pane}>{focus}</FitBox>
  ) : (
    <View style={[styles.pane, { gap: ui.gap }]}>{focus}</View>
  );

  // Keyed on the mode so the pane gets a NEW layout node when it flips. In
  // two-pane mode the pane is sized by its width; in one column by `flex: 1`.
  // Yoga computes a child's flex basis once and caches it whenever the basis
  // is defined (as it is with `flex: 1`), so a pane that had a 320dp width in
  // landscape keeps 320dp as its basis when the row turns into a column —
  // the actions pane stayed 320dp too tall and the pig's pane shrank to match
  // (ReactCommon/yoga/yoga/algorithm/CalculateLayout.cpp, computeFlexBasisForChild).
  // Remounting discards the cached basis.
  const actionsPane = actions ? (
    <FitBox key={twoPane ? 'rail' : 'pane'} style={twoPane ? { width: ui.railW } : styles.pane}>
      <View style={{ gap: ui.gap }}>{actions}</View>
    </FitBox>
  ) : null;

  return (
    <View style={[styles.safe, frame]}>
      {band}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'height' : undefined}
      >
        <View style={[styles.flex, twoPane && styles.row, { padding: ui.pad, gap: ui.gap }]}>
          {focusPane}
          {actionsPane}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  flex: { flex: 1, minHeight: 0 },
  row: { flexDirection: 'row' },
  header: { justifyContent: 'center' },
  pane: { flex: 1, minHeight: 0, minWidth: 0, justifyContent: 'center' },
});
