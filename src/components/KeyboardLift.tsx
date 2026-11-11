import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type KeyboardEvent,
  type KeyboardMetrics,
  type ViewInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useUi } from '../theme/responsive';

// With a keyboard open, the screen slides up — as one piece, in step with the
// keyboard — until its text boxes sit just above it, and slides back down when
// the keyboard goes. It's a transform: nothing is laid out again, so FitBox
// doesn't re-fit and nothing shrinks or jumps on the way. Stage and WorkStage
// wrap their screens in one (upright only), so any screen with a text box does
// this without asking.
//
// What has to stay in view says so (useKeyboardTarget, KeyboardTarget):
//  - 'field': every PigInput. A screen's fields come up together, so on Join
//    the Room Code box stays in sight while the name is typed.
//  - 'group': a block worth bringing up with them (Stage's controls, so Join's
//    Lobby button sits under the boxes, ready to tap). It comes along only if it fits above
//    the keyboard; if not, just the fields; if not even those, just the one
//    being typed in.
// A screen whose fields are already clear of the keyboard doesn't move.
//
// Under the lowest thing kept, the keyboard gets the same gap the screen puts
// between its controls (`gap`, as drawn: if FitBox has shrunk the controls, the
// gap shrinks with them), so on Join the keyboard sits as far below Lobby as
// Lobby sits below the name.
//
// What slides up is clipped to the safe area, so it passes out of sight rather
// than under the status bar, and what's kept in sight stops below the top band
// (ui.headerBand), clear of the corner buttons that float over it. Where the keyboard is comes from React Native's
// keyboard events. Android is edge-to-edge, so its window no longer resizes for
// the keyboard; this is what keeps the boxes in sight there. Off on the web
// (the browser moves the page itself) and while `enabled` is false.
//
// It's meant to fill the safe area, as it does in Stage and WorkStage: on
// Android the keyboard's top is worked out from its bottom edge.

type Kind = 'field' | 'group';

type MeasureCallback = (x: number, y: number, width: number, height: number) => void;

// Anything that can be measured: a View's or a TextInput's ref.
type Measurable = {
  measureInWindow: (callback: MeasureCallback) => void;
  measureLayout: (relativeTo: ViewInstance, onSuccess: MeasureCallback, onFail?: () => void) => void;
};

type Span = { top: number; bottom: number };

type Register = (node: Measurable, kind: Kind) => () => void;

const LiftContext = createContext<Register | null>(null);

// iOS says the keyboard is coming before it moves, and how long it'll take;
// Android only says it's there, with no duration, so the slide borrows
// Android's own keyboard timing.
const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
const ANDROID_MS = 285;
// The keyboards' own curves (iOS's keyboard curve, Android's IME animation),
// so the screen and the keyboard move together.
const EASING = Platform.OS === 'ios' ? Easing.bezier(0.38, 0.7, 0.125, 1) : Easing.bezier(0.2, 0, 0, 1);

// Where something is drawn, FitBox's scaling included. Fabric answers straight away.
function spanOf(node: Measurable): Promise<Span | null> {
  return new Promise((resolve) =>
    node.measureInWindow((_x, y, _w, h) => resolve(h > 0 ? { top: y, bottom: y + h } : null))
  );
}

// How big something is drawn against how big it's laid out (measureLayout
// leaves transforms out): below 1 when FitBox has shrunk it.
function scaleOf(node: Measurable, drawn: Span, relativeTo: ViewInstance): Promise<number> {
  return new Promise((resolve) =>
    node.measureLayout(
      relativeTo,
      (_x, _y, _w, h) => resolve(h > 0 ? (drawn.bottom - drawn.top) / h : 1),
      () => resolve(1)
    )
  );
}

function union(spans: (Span | null)[]): Span | null {
  let out: Span | null = null;
  for (const s of spans) {
    if (s) out = out ? { top: Math.min(out.top, s.top), bottom: Math.max(out.bottom, s.bottom) } : s;
  }
  return out;
}

export function KeyboardLift({
  children,
  enabled = true,
  gap,
  style,
}: {
  children: React.ReactNode;
  // Stage and WorkStage turn it off in landscape: a phone on its side has no
  // room above the keyboard to slide into.
  enabled?: boolean;
  // The gap the screen puts under its text box (to the button beneath, in
  // Stage), left again between the lowest thing kept and the keyboard. ui.gap
  // if not given.
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ui = useUi();
  const frame = useRef<ViewInstance>(null); // stays put: the screen at rest
  const body = useRef<ViewInstance>(null); // slides
  const [shift] = useState(() => new Animated.Value(0));
  const [targets] = useState(() => new Map<Measurable, Kind>());
  const goal = useRef(0); // how far up the screen is, or is heading
  const live = enabled && Platform.OS !== 'web';
  const clearance = gap ?? ui.gap;
  const ceiling = ui.headerBand;

  const register = useCallback<Register>(
    (node, kind) => {
      targets.set(node, kind);
      return () => {
        targets.delete(node);
      };
    },
    [targets]
  );

  useEffect(() => {
    const slide = (to: number, duration: number) => {
      if (Math.abs(to - goal.current) < 1) return; // there already, or on the way
      goal.current = to;
      Animated.timing(shift, { toValue: -to, duration, easing: EASING, useNativeDriver: true }).start();
    };

    if (!live) {
      // Switched off with the screen up (the phone turned on its side): straight back.
      goal.current = 0;
      shift.stopAnimation();
      shift.setValue(0);
      return;
    }

    // How far up the screen must go for this keyboard: 0 when the fields are
    // already clear of it.
    const liftFor = async (keyboard: KeyboardMetrics): Promise<number> => {
      // No text box here (Home, Lobby, Reveal…, which stay mounted under the
      // screen in use): nothing to keep in sight, and nothing to measure.
      if (![...targets.values()].includes('field')) return 0;
      const outer = frame.current;
      if (!outer || !body.current || keyboard.height <= 0 || keyboard.screenY <= 0) return 0;
      const [rest, now] = await Promise.all([spanOf(outer), spanOf(body.current)]);
      if (!rest || !now) return 0;
      // iOS: screenY is the keyboard's top. Android reports its height above
      // the navigation bar, and this frame's bottom is the top of that bar
      // (Stage and WorkStage pad the bar off), which puts the keyboard's top in
      // the same terms as everything measured here. Its screenY comes from the
      // window's visible area, which can disagree with them and land the
      // screen short; it's kept as a second opinion, and the higher top wins.
      const keyboardTop =
        Platform.OS === 'android' ? Math.min(keyboard.screenY, rest.bottom - keyboard.height) : keyboard.screenY;
      // Where something sits with the screen at rest. The body may be up
      // already (the keyboard changed height while open), but how far a target
      // is from the top of the body never changes.
      const atRest = (s: Span | null): Span | null =>
        s && { top: rest.top + s.top - now.top, bottom: rest.top + s.bottom - now.top };
      const measured = await Promise.all(
        [...targets].map(async ([node, kind]) => ({ node, kind, span: atRest(await spanOf(node)) }))
      );
      const field = measured.find((t) => t.kind === 'field' && t.span);
      const fields = union(measured.filter((t) => t.kind === 'field').map((t) => t.span));
      if (!field?.span || !fields) return 0;
      const all = union(measured.map((t) => t.span)) ?? fields;
      // The gap as it's drawn between the controls: scaled with them.
      const margin = clearance * (await scaleOf(field.node, field.span, outer));
      // What's kept stops below the top band: the corner buttons (☰, sound,
      // dark mode) float there over everything and don't slide.
      const room = keyboardTop - margin - (rest.top + ceiling);
      const fits = (s: Span) => s.bottom - s.top <= room;
      let keep = fits(all) ? all : fits(fields) ? fields : null;
      if (!keep) {
        const typing = TextInput.State.currentlyFocusedInput();
        keep = (typing && targets.has(typing) && atRest(await spanOf(typing))) || fields;
      }
      return Math.max(0, Math.round(keep.bottom + margin - keyboardTop));
    };

    let latest = 0; // only the newest keyboard event gets to move the screen
    const follow = async (keyboard: KeyboardMetrics, duration: number) => {
      const mine = ++latest;
      const to = await liftFor(keyboard);
      if (mine === latest) slide(to, duration);
    };
    const ms = (e: KeyboardEvent) => (Platform.OS === 'ios' ? e.duration : ANDROID_MS);

    const subs = [
      Keyboard.addListener(SHOW, (e) => follow(e.endCoordinates, ms(e))),
      Keyboard.addListener(HIDE, (e) => {
        ++latest;
        slide(0, ms(e));
      }),
    ];
    // Already open (the phone turned upright with the keyboard up).
    const open = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
    if (open) follow(open, ANDROID_MS);

    return () => {
      ++latest;
      subs.forEach((s) => s.remove());
    };
  }, [live, clearance, ceiling]);

  return (
    <LiftContext.Provider value={register}>
      <View ref={frame} style={[styles.frame, style]}>
        <Animated.View ref={body} style={[styles.body, { transform: [{ translateY: shift }] }]}>
          {children}
        </Animated.View>
      </View>
    </LiftContext.Provider>
  );
}

// How much of the window the keyboard covers, from the bottom edge up: 0 while
// it's down, and always 0 on the web (the browser moves the page itself). For
// things pinned to the bottom of the screen, which no KeyboardLift moves
// (Toast), to sit above it.
export function useKeyboardInset(): number {
  const ui = useUi();
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subs = [
      Keyboard.addListener(SHOW, (e) => setHeight(Math.max(0, e.endCoordinates.height))),
      Keyboard.addListener(HIDE, () => setHeight(0)),
    ];
    setHeight(Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0);
    return () => subs.forEach((s) => s.remove());
  }, []);
  // Android's height is above the navigation bar (see liftFor); iOS's runs to
  // the bottom of the screen.
  return height > 0 && Platform.OS === 'android' ? height + ui.insets.bottom : height;
}

// A ref that tells the KeyboardLift around it to keep this in sight. Does
// nothing outside one.
export function useKeyboardTarget(kind: Kind = 'field') {
  const register = useContext(LiftContext);
  return useCallback(
    (node: Measurable | null) => (node && register ? register(node, kind) : undefined),
    [register, kind]
  );
}

// A View marked to come up with the fields: a 'group' by default (brought
// along if there's room), or a 'field' for a text box that isn't a PigInput.
export function KeyboardTarget({
  kind = 'group',
  style,
  children,
}: {
  kind?: Kind;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const target = useKeyboardTarget(kind);
  return (
    <View ref={target} style={style}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, overflow: 'hidden' },
  body: { flex: 1, minHeight: 0 },
});
