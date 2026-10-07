import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

// ---------------------------------------------------------------------------
// One "image" that scales.
//
// The whole game is designed to be visible on one screen with nothing to
// scroll. Every screen is built from a handful of numbers that come out of
// useUi(): a scale factor `s` derived from the safe-area viewport, and the
// font / spacing helpers that apply it. Bigger phone → everything grows a
// little; smaller phone → everything shrinks a little; the shape stays put.
//
// FitBox (src/components/FitBox.tsx) is the second half: any pane whose
// content can vary (rosters, score lists, long prompts) is wrapped in one, and
// if the content still doesn't fit it is scaled down as a whole rather than
// clipped or scrolled.
// ---------------------------------------------------------------------------

// Safe-area viewports the visual design is tuned against (dp). A device that
// matches one of these renders at scale 1.0.
const REF_PORTRAIT = { w: 393, h: 760 };
const REF_LANDSCAPE = { w: 800, h: 360 };

// Keep a tiny or huge device legible rather than literal.
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.5;

// Cap on the OS accessibility font multiplier. Text still grows with the user's
// setting, but not so far that FitBox has to shrink whole screens to fit it.
export const FONT_CAP = 1.2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// A browser window can be any shape, and on an ultrawide monitor the two panes
// end up at opposite edges of the screen. On web the game is laid out in a
// frame no wider than MAX_WEB_ASPECT × its height, centred in the window
// (app/_layout.tsx), and useUi measures that frame rather than the window.
// Phones and tablets never reach the cap.
const MAX_WEB_ASPECT = 16 / 9;

export function useAppFrame(): { width: number; height: number } {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web') return { width, height };
  return { width: Math.min(width, Math.round(height * MAX_WEB_ASPECT)), height };
}

export type Ui = {
  w: number; // safe-area width (dp)
  h: number; // safe-area height (dp)
  insets: EdgeInsets;
  landscape: boolean;
  twoPane: boolean; // art on the left, controls on the right
  s: number; // global scale factor
  f: (size: number) => number; // scaled font size
  sp: (size: number) => number; // scaled spacing / radius / icon size
  pad: number; // screen edge padding
  gap: number; // gap between stacked elements
  headerBand: number; // height reserved for the title band on every Stage
  railW: number; // width of the controls rail in two-pane mode
  paneH: number; // approximate height available to one pane
};

export function useUi(): Ui {
  const { width, height } = useAppFrame();
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const w = Math.max(1, width - insets.left - insets.right);
    const h = Math.max(1, height - insets.top - insets.bottom);
    const landscape = w > h;
    // Two panes need width, not just orientation: a phone on its side qualifies,
    // and so does a tablet held upright. With a keyboard open the window gets
    // short but stays wide, so a landscape phone keeps its row layout.
    const twoPane = landscape ? w >= 560 : w >= 700;
    const ref = landscape ? REF_LANDSCAPE : REF_PORTRAIT;
    const s = clamp(Math.min(w / ref.w, h / ref.h), MIN_SCALE, MAX_SCALE);
    const f = (n: number) => Math.round(n * s);
    const sp = (n: number) => Math.round(n * s);
    const pad = sp(16);
    const gap = sp(16);
    const headerBand = sp(44);
    // The rail gets up to 46% of the width but never more than 400dp (scaled),
    // so the art pane is always at least as wide as the controls.
    const railW = Math.round(Math.min(400 * s, w * 0.46));
    const paneH = twoPane
      ? Math.max(1, h - headerBand - pad * 2)
      : Math.max(1, Math.round((h - headerBand - pad * 2 - gap) / 2));
    return { w, h, insets, landscape, twoPane, s, f, sp, pad, gap, headerBand, railW, paneH };
  }, [width, height, insets.top, insets.bottom, insets.left, insets.right]);
}
