import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Countdown, deadlineIn } from './Countdown';
import { FitBox } from './FitBox';
import { IMAGES } from '../assets/assets';
import { assetSize } from '../lib/assetSize';
import { useUi } from '../theme/responsive';
import { type Theme } from '../theme/tokens';
import { useThemedStyles } from '../theme/theme';

// The layout shared by the two "work" screens — drawing and guessing — so that
// moving from one to the other doesn't feel like a jump. The rail is pinned to
// the top, every slot has a fixed height, and both screens scale by the same
// factor (see `fixedH`), so the pig, the timer, the top element and the primary
// button sit on exactly the same pixels on both; only what comes after them
// (Clear/Undo, Leave) differs.
//
// Rail, top to bottom:
//   [ pig ........ ][ timer ]   the pig peeks up from BEHIND the element below,
//   [ top element — fixed  ]   hoof tips showing just above its top edge
//   [ primary button       ]   Submit
//   [ secondary (optional) ]   Clear · Undo
//   [ footer               ]   Leave game
//
// In one column the same header sits above the focus, and the secondary buttons
// share a row with the primary so the button row stays at the same height too.

// Height of the top-element slot, in base dp (scaled by the UI scale).
export const TOP_H = 60;
// The pig's share of the rail width (after the left inset).
const PIG_SHARE = 0.55;
// How far (base dp) the pig's hooves overlap the element below.
const PIG_OVERLAP = 10;
// Narrowest the two-pane rail may go (base dp) so Submit and the timer stay
// usable; below this the focus pane gives up height instead.
const RAIL_MIN = 280;

const pigSize = assetSize(IMAGES.canvasPig);
const PIG_ASPECT = pigSize.width / pigSize.height;

export function WorkStage({
  focus,
  timeLimit,
  onExpire,
  top,
  primary,
  secondary,
  footer,
}: {
  focus: React.ReactNode;
  timeLimit?: number;
  onExpire?: () => void;
  top: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode[];
  footer?: React.ReactNode;
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);

  // The deadline is fixed here, once per screen: the rail below is rebuilt
  // (and the Countdown remounted) whenever the layout flips between one and
  // two panes, and the clock must not start over when the phone turns. The
  // guard keeps a remount right at zero from firing `onExpire` twice.
  const [until] = useState(() => (timeLimit ? deadlineIn(timeLimit) : 0));
  const expired = useRef(false);
  const expire = () => {
    if (expired.current) return;
    expired.current = true;
    onExpire?.();
  };

  const frame = {
    paddingTop: ui.insets.top,
    paddingBottom: ui.insets.bottom,
    paddingLeft: ui.insets.left,
    paddingRight: ui.insets.right,
  };

  // Two-pane: the focus pane (canvas / picture) is a 4:3 that wants the full
  // pane height, so the rail takes whatever width that leaves — no narrower
  // than RAIL_MIN, no wider than the standard rail (a tablet's slack goes to
  // the picture, not the buttons). If the floor wins, the focus pane simply
  // fits the width that remains. Drawing and guessing share this rule.
  const focusW = Math.round((ui.h - ui.pad * 2) * (4 / 3));
  const leftover = ui.w - ui.pad * 2 - ui.gap - focusW;
  const railW = Math.round(Math.max(RAIL_MIN * ui.s, Math.min(ui.railW, leftover)));

  // Explicit dp so the pig's height — and therefore where the element below
  // starts — is known up front and identical on both screens.
  const railInner = ui.twoPane ? railW : ui.w - ui.pad * 2;
  const inset = ui.sp(24);
  const pigW = Math.round((railInner - inset) * PIG_SHARE);
  const pigH = Math.round(pigW / PIG_ASPECT);
  const overlap = ui.sp(PIG_OVERLAP);
  const rowH = pigH - overlap; // the element starts here; the pig hangs over it
  const slotH = ui.sp(TOP_H);
  const gap = ui.sp(12);

  // Two-pane: the rail starts a little below the row's top so the pig's ears
  // sit level with the top edge of the canvas / drawing beside it.
  const railTop = ui.sp(16);

  // Height of the TALLER variant (with secondary buttons). Handing it to both
  // rails makes FitBox pick the same scale on both screens, so nothing shifts.
  const fixedH = railTop + rowH + slotH + gap + ui.sp(44) + gap + ui.sp(44) + gap + ui.sp(36);

  const head = (
    <View>
      <View style={[styles.pigRow, { paddingLeft: inset, height: rowH }]}>
        <View style={{ width: pigW, height: rowH, overflow: 'visible' }}>
          <Image source={IMAGES.canvasPig} style={{ width: pigW, height: pigH }} contentFit="contain" />
        </View>
        <View style={[styles.timer, { height: rowH }]}>
          {timeLimit ? <Countdown seconds={timeLimit} until={until} onExpire={expire} size={32} /> : null}
        </View>
      </View>
      <View style={{ height: slotH, zIndex: 1 }}>{top}</View>
    </View>
  );

  const secondaryRow = (secondary ?? []).map((node, i) => (
    <View key={i} style={styles.flex}>
      {node}
    </View>
  ));

  if (ui.twoPane) {
    return (
      <View style={[styles.safe, frame]}>
        <View style={[styles.row, { padding: ui.pad, gap: ui.gap }]}>
          <View style={styles.focus}>{focus}</View>
          <FitBox align="top" minContentH={fixedH} style={{ width: railW }}>
            <View style={{ gap, paddingTop: railTop }}>
              {head}
              {primary}
              {secondaryRow.length ? (
                <View style={[styles.buttons, { gap: ui.sp(10) }]}>{secondaryRow}</View>
              ) : null}
              {footer}
            </View>
          </FitBox>
        </View>
      </View>
    );
  }

  // One column: the pad gets a fixed 4:3 box (full width) rather than all the
  // leftover height, the rows sit close together, and the whole group is
  // centred as one block — a FitBox, so it shrinks as a unit when a keyboard
  // opens instead of pushing anything off screen.
  const gapP = ui.sp(24);
  const focusH = Math.round((railInner * 3) / 4);
  const fixedHP = rowH + slotH + gapP + focusH + gapP + ui.sp(44) + gapP + ui.sp(36);

  return (
    <View style={[styles.safe, frame]}>
      <FitBox minContentH={fixedHP} style={[styles.flex, { margin: ui.pad }]}>
        <View style={{ gap: gapP }}>
          {head}
          <View style={[styles.focusFixed, { height: focusH }]}>{focus}</View>
          <View style={[styles.buttons, { gap: ui.sp(10) }]}>
            <View style={styles.flex}>{primary}</View>
            {secondaryRow}
          </View>
          {footer}
        </View>
      </FitBox>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  flex: { flex: 1, minHeight: 0 },
  row: { flex: 1, flexDirection: 'row', minHeight: 0 },
  focus: { flex: 1, minWidth: 0, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  // Portrait: explicit height, no flex (flex's basis would override the height).
  focusFixed: { minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  // The pig sits BEHIND the element (its PNG has a solid background, so it can't
  // paint over the card): the row lets it hang past its bottom edge, and the
  // element's zIndex 1 covers that strip, leaving the hoof tips peeking above.
  pigRow: { flexDirection: 'row', alignItems: 'flex-start', overflow: 'visible', zIndex: 0 },
  timer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row' },
});
