import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { PigButton } from './PigButton';
import { WorkStage } from './WorkStage';
import { Stickers, Strokes } from './DrawingArt';
import { InkPicker } from './InkPicker';
import { StickerControls, StickerPicker, type StickerAct } from './StickerPicker';
import { SPACE, STROKE, inkFor, type Drawing, type Sticker } from '../lib/drawing';
import { rewardsOf } from '../rewards/catalog';
import { STICKER_ART, stickersIn } from '../stickers/art';
import { PROPS, type Prop } from '../theme/skins/props';
import { useInventory } from '../rewards/inventory';
import { hintLearned, markHintLearned } from '../lib/hints';
import { FONT_CAP, useUi } from '../theme/responsive';
import { useThemedStyles } from '../theme/theme';
import { canvas as paper, font, layout, type Theme } from '../theme/tokens';

// The drawing space (SPACE, src/lib/drawing.ts) is 400 × 300 units whatever
// the device, orientation or zoom; the canvas on screen is a window onto it.
// Strokes are stored in these units, so a line drawn zoomed in, zoomed out, in
// portrait or in landscape lands in the same place and replays identically
// everywhere. What's sent when it's done is the format in that file.
const ASPECT = SPACE.w / SPACE.h;

type Zoom = 1 | 2;

// Points closer than this (units) to the previous one are dropped: they're
// touch jitter, and they'd bloat the path without changing its shape.
const MIN_STEP = 1;
// A stroke shorter than this (units) that was cut off by a second finger
// landing is an accidental touch-down on the way to a two-finger slide, not a
// mark the player meant to make.
const ACCIDENT = 6;
// The two-finger hint fades on its own after this long.
const HINT_MS = 8000;
const HINT_KEY = 'pan';
// Minimap box, base dp.
const MINIMAP = { w: 88, h: 66 };
// A browser with a mouse (or trackpad) has no second finger to slide with; it
// scrolls the window instead (see the wheel handler), and the hint says so.
const SCROLLS = Platform.OS === 'web' && window.matchMedia('(pointer: fine)').matches;
// Wheel deltas in lines (Firefox with a mouse) are converted at this many px.
const WHEEL_LINE_PX = 16;

type Pt = { x: number; y: number };

// A sticker on this canvas, with a key of its own so the undo history can
// find it (the key isn't sent).
type Placed = Sticker & { key: number };
// The undo history: strokes and stickers in the order they went down.
type Step = { kind: 'stroke' } | { kind: 'sticker'; key: number };

// A new sticker's width, as a share of the view (so it's the same size on
// screen at 1× and 2×); the controls grow / shrink it by STICKER_STEP and turn
// it by STICKER_TURN degrees, within STICKER_SIZES drawing units.
const STICKER_NEW = 0.25;
const STICKER_STEP = 1.25;
const STICKER_TURN = 15;
const STICKER_SIZES = { min: 20, max: 300 };

// Largest 4:3 rectangle that fits in a box.
const fitAspect = (box: { w: number; h: number }) => {
  if (!box.w || !box.h) return { w: 0, h: 0 };
  let w = box.w;
  let h = w / ASPECT;
  if (h > box.h) {
    h = box.h;
    w = h * ASPECT;
  }
  return { w: Math.round(w), h: Math.round(h) };
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const px = (n: number) => n.toFixed(1);

// The drawing surface, laid out by WorkStage (the same frame the guessing
// screen uses). The canvas is the largest 4:3 that fits the focus pane and
// shows the drawing space at 1× or, through a 200 × 150 window, at 2×. One
// finger always draws; two fingers slide the window; the minimap in the corner
// shows where the window is and can be tapped or dragged to jump. A player
// who has won brushes picks the ink in the top-left corner (InkPicker); each
// drawing starts in black. One who has won stickers stamps them from the
// button under it (StickerPicker): a new sticker lands mid-view, selected,
// and while it's selected one finger moves it instead of drawing and its
// controls (StickerControls) resize, turn or remove it until Done. Undo takes
// back the last stroke or sticker, whichever went down last.
export function PigCanvas({
  onSubmit,
  timeLimit,
  header,
  footer,
}: {
  onSubmit: (data: string) => void;
  timeLimit?: number;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);

  // Replaced (never mutated) on each commit, so `Strokes` (memoized) sees a new
  // identity exactly when there is something new to draw. `inks` runs in step
  // with it: the brush each stroke was drawn with, null for black.
  const committed = useRef<string[]>([]);
  const inks = useRef<(string | null)[]>([]);

  // The brushes this player has won (src/rewards), the one in use, and
  // whether the picker is open. With none won, there's no picker.
  const { owned } = useInventory();
  const brushes = rewardsOf('brush').filter((b) => !b.soon && owned.has(b.id));
  const [ink, setInk] = useState<string | null>(null);
  const inkRef = useRef(ink);
  inkRef.current = ink;
  const [picking, setPicking] = useState(false);

  // The stickers this player can use (their packs), the ones on the drawing,
  // the undo history, the one selected (by key), and whether the tray is open.
  const available = stickersIn(owned);
  const placed = useRef<Placed[]>([]);
  const history = useRef<Step[]>([]);
  const nextKey = useRef(1);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [tray, setTray] = useState(false);
  // A one-finger drag on the selected sticker: where it started, and where
  // the sticker was then.
  const moving = useRef<{ from: Pt; x: number; y: number } | null>(null);

  // The stroke under the finger. Built as `M p0 Q p0 m1 Q p1 m2 …`: each new
  // point becomes the control of a quadratic that ends at the midpoint between
  // it and the previous point, which turns the raw polyline into a smooth curve
  // and hides dropped frames. `last` is the most recent raw point, `len` the
  // rough length so far, `moved` whether any point has been added.
  const live = useRef<{ d: string; last: Pt; len: number; moved: boolean } | null>(null);

  const [, force] = useReducer((n) => n + 1, 0);
  const [host, setHost] = useState({ w: 0, h: 0 });
  const size = fitAspect(host);

  // Zoom and window are drawing state, not layout state: the phone can turn,
  // the canvas box can change size, and the same patch of the drawing stays on
  // screen. The window origin is kept even at 1×, so flipping back to 2×
  // returns to where the player was looking.
  const [zoom, setZoom] = useState<Zoom>(1);
  const win = useRef<Pt>({ x: SPACE.w / 4, y: SPACE.h / 4 });
  const view = { w: SPACE.w / zoom, h: SPACE.h / zoom };
  const origin: Pt = zoom === 1 ? { x: 0, y: 0 } : win.current;
  // Screen px per drawing unit; everything that touches the canvas goes
  // through this and the origin.
  const scale = size.w ? size.w / view.w : 1;
  const geo = useRef({ zoom, origin, scale });
  geo.current = { zoom, origin, scale };
  const toUnits = (x: number, y: number): Pt => {
    const g = geo.current;
    return { x: g.origin.x + x / g.scale, y: g.origin.y + y / g.scale };
  };
  const moveWindow = (x: number, y: number) => {
    win.current = {
      x: clamp(x, 0, SPACE.w / 2),
      y: clamp(y, 0, SPACE.h / 2),
    };
  };

  // Touch events can arrive several times per frame; coalesce them into one
  // render per frame.
  const frame = useRef<number | null>(null);
  const schedule = () => {
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      force();
    });
  };

  // ---- Two-finger hint (coach mark) ---------------------------------------
  // Shown the first time the switch goes to 2×, at the bottom-left of the
  // canvas. Fades when a two-finger slide (or a scroll, in a browser) moves the
  // window (learned for good) or after HINT_MS (comes back on the next switch
  // to 2×).
  const [hint, setHint] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const learned = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let alive = true;
    hintLearned(HINT_KEY).then((v) => {
      if (alive) learned.current = v;
    });
    return () => {
      alive = false;
    };
  }, []);
  const hideHint = () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = null;
    Animated.timing(hintOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(
      ({ finished }) => finished && setHint(false),
    );
  };
  const showHint = () => {
    if (learned.current) return;
    setHint(true);
    Animated.timing(hintOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(hideHint, HINT_MS);
  };
  const panLearned = () => {
    if (learned.current) return;
    learned.current = true;
    markHintLearned(HINT_KEY);
    hideHint();
  };
  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const setZoomTo = (z: Zoom) => {
    if (z === geo.current.zoom) return;
    setZoom(z);
    if (z === 2) showHint();
    else hideHint();
  };

  const onHostLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== host.w || height !== host.h) setHost({ w: width, h: height });
  };

  // ---- Gestures ------------------------------------------------------------
  // Set while a second finger is down, so the draw gesture knows why it ended.
  const secondFinger = useRef(false);

  // Close the live stroke and move it to `committed`. A tap that never moved
  // becomes a dot (a near-zero segment rendered with round caps). A stroke cut
  // short by a second finger is dropped if it was only an accidental touch.
  const commit = (cut: boolean) => {
    const s = live.current;
    if (!s) return;
    live.current = null;
    if (cut && s.len < ACCIDENT) {
      force();
      return;
    }
    const { x, y } = s.last;
    const d = s.moved ? `${s.d} L ${px(x)} ${px(y)}` : `${s.d} L ${px(x + 0.1)} ${px(y)}`;
    committed.current = [...committed.current, d];
    inks.current = [...inks.current, inkRef.current];
    history.current = [...history.current, { kind: 'stroke' }];
    force();
  };

  // Change the stickers (a new array, so `Stickers` sees it).
  const restick = (next: Placed[]) => {
    placed.current = next;
    force();
  };

  const draw = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    // One finger draws. A second finger ends the stroke (see `slide`) instead
    // of yanking it toward the new centroid.
    .maxPointers(1)
    .onBegin((e) => {
      const p = toUnits(e.x, e.y);
      setPicking(false); // drawing shuts the ink picker
      setTray(false); // and the sticker tray
      // With a sticker selected, the finger moves it rather than drawing.
      const sel = placed.current.find((s) => s.key === selectedRef.current);
      if (sel) {
        moving.current = { from: p, x: sel.x, y: sel.y };
        return;
      }
      live.current = { d: `M ${px(p.x)} ${px(p.y)}`, last: p, len: 0, moved: false };
      schedule();
    })
    .onUpdate((e) => {
      const m = moving.current;
      if (m) {
        const p = toUnits(e.x, e.y);
        const x = clamp(m.x + p.x - m.from.x, 0, SPACE.w);
        const y = clamp(m.y + p.y - m.from.y, 0, SPACE.h);
        placed.current = placed.current.map((s) => (s.key === selectedRef.current ? { ...s, x, y } : s));
        schedule();
        return;
      }
      const s = live.current;
      if (!s) return;
      // Belt and braces for platforms whose native pan keeps tracking past
      // the pointer limit: a move with two fingers down is a slide, not ink.
      if (e.numberOfPointers > 1) {
        commit(true);
        return;
      }
      const p = toUnits(e.x, e.y);
      const dx = p.x - s.last.x;
      const dy = p.y - s.last.y;
      if (Math.abs(dx) < MIN_STEP && Math.abs(dy) < MIN_STEP) return;
      const mx = (s.last.x + p.x) / 2;
      const my = (s.last.y + p.y) / 2;
      s.d += ` Q ${px(s.last.x)} ${px(s.last.y)} ${px(mx)} ${px(my)}`;
      s.len += Math.hypot(dx, dy);
      s.last = p;
      s.moved = true;
      schedule();
    })
    // Fires after end AND cancel, so no stroke is ever left dangling.
    .onFinalize((e) => {
      if (moving.current) {
        moving.current = null;
        return;
      }
      commit(secondFinger.current || e.numberOfPointers > 1);
    });

  // Two fingers slide the window at 2×. Runs alongside `draw`: when the second
  // finger lands, `draw` hits its pointer limit and finalizes, and this starts.
  const slideMoved = useRef(false);
  const slide = Gesture.Pan()
    .runOnJS(true)
    .minPointers(2)
    .maxPointers(2)
    .onBegin(() => {
      secondFinger.current = true;
      slideMoved.current = false;
    })
    .onChange((e) => {
      const g = geo.current;
      if (g.zoom === 1) return;
      moveWindow(win.current.x - e.changeX / g.scale, win.current.y - e.changeY / g.scale);
      slideMoved.current = true;
      schedule();
    })
    .onFinalize(() => {
      secondFinger.current = false;
      if (slideMoved.current) panLearned();
    });

  const canvasGesture = Gesture.Simultaneous(draw, slide);

  // Minimap: a tap recentres the window on that spot, a drag pulls it along.
  const mm = { w: ui.sp(MINIMAP.w), h: ui.sp(MINIMAP.h) };
  const jump = (x: number, y: number) => {
    const cx = (x / mm.w) * SPACE.w;
    const cy = (y / mm.h) * SPACE.h;
    moveWindow(cx - SPACE.w / 4, cy - SPACE.h / 4);
    schedule();
  };
  const minimapGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => jump(e.x, e.y))
    .onUpdate((e) => jump(e.x, e.y));

  // On web a scroll over the canvas at 2× moves the window: a mouse wheel goes
  // up and down (shift+wheel sideways), a trackpad's two-finger scroll goes
  // anywhere, the same as two fingers on a phone. Ctrl+wheel (and a trackpad
  // pinch, which browsers report as one) is left alone to zoom the page.
  // Registered by hand because React's onWheel is passive and can't stop the
  // page from scrolling.
  const frameRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = frameRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const g = geo.current;
      if (g.zoom === 1 || e.ctrlKey) return;
      e.preventDefault();
      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : 1;
      moveWindow(win.current.x + (e.deltaX * unit) / g.scale, win.current.y + (e.deltaY * unit) / g.scale);
      schedule();
      panLearned();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---- Actions -------------------------------------------------------------
  // A drawing all in black without stickers goes without `inks` or
  // `stickers`, exactly as before either.
  const submit = () => {
    commit(false);
    const data: Drawing = { w: SPACE.w, h: SPACE.h, strokes: committed.current };
    if (inks.current.some((i) => i !== null)) data.inks = inks.current;
    if (placed.current.length) data.stickers = placed.current.map(({ id, x, y, s, r }) => ({ id, x, y, s, r }));
    onSubmit(JSON.stringify(data));
  };
  const undo = () => {
    const last = history.current[history.current.length - 1];
    if (!last) return;
    history.current = history.current.slice(0, -1);
    if (last.kind === 'stroke') {
      committed.current = committed.current.slice(0, -1);
      inks.current = inks.current.slice(0, -1);
      force();
    } else {
      if (selectedRef.current === last.key) setSelected(null);
      restick(placed.current.filter((s) => s.key !== last.key));
    }
  };
  const clear = () => {
    committed.current = [];
    inks.current = [];
    placed.current = [];
    history.current = [];
    live.current = null;
    setSelected(null);
    force();
  };

  // A sticker from the tray, in the middle of the view, selected.
  const stamp = (id: string) => {
    const key = nextKey.current++;
    const g = geo.current;
    const w = SPACE.w / g.zoom;
    const at = { x: g.origin.x + w / 2, y: g.origin.y + SPACE.h / g.zoom / 2 };
    placed.current = [...placed.current, { id, ...at, s: Math.round(w * STICKER_NEW), r: 0, key }];
    history.current = [...history.current, { kind: 'sticker', key }];
    setTray(false);
    setSelected(key);
  };
  const actOnSticker = (act: StickerAct) => {
    const key = selectedRef.current;
    if (act === 'done' || key === null) {
      setSelected(null);
      return;
    }
    if (act === 'remove') {
      history.current = history.current.filter((h) => !(h.kind === 'sticker' && h.key === key));
      setSelected(null);
      restick(placed.current.filter((s) => s.key !== key));
      return;
    }
    restick(
      placed.current.map((s) => {
        if (s.key !== key) return s;
        if (act === 'smaller' || act === 'bigger') {
          const size = act === 'bigger' ? s.s * STICKER_STEP : s.s / STICKER_STEP;
          return { ...s, s: Math.round(clamp(size, STICKER_SIZES.min, STICKER_SIZES.max)) };
        }
        return { ...s, r: (s.r + (act === 'right' ? STICKER_TURN : -STICKER_TURN) + 360) % 360 };
      })
    );
  };
  // The selected sticker's outline: a dashed box round it, turned with it.
  const sel = placed.current.find((s) => s.key === selected);
  const selArt: Prop | undefined = sel && STICKER_ART[sel.id] ? PROPS[STICKER_ART[sel.id].prop] : undefined;

  const stroke = live.current;
  const viewBox = `${origin.x} ${origin.y} ${view.w} ${view.h}`;

  const canvas = (
    <View style={styles.host} onLayout={onHostLayout}>
      <View ref={frameRef} style={[styles.frame, { width: size.w, height: size.h, borderRadius: ui.sp(layout.imageRadius) }]}>
        <GestureDetector gesture={canvasGesture}>
          <Svg width={size.w} height={size.h} viewBox={viewBox}>
            <Strokes strokes={committed.current} inks={inks.current} width={STROKE} />
            {stroke ? (
              <Path
                d={stroke.d}
                stroke={inkFor(ink)}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            <Stickers stickers={placed.current} />
            {sel && selArt ? (
              <G transform={`translate(${sel.x} ${sel.y}) rotate(${sel.r})`}>
                <Rect
                  x={-sel.s / 2 - 4}
                  y={-(sel.s * selArt.h) / selArt.w / 2 - 4}
                  width={sel.s + 8}
                  height={(sel.s * selArt.h) / selArt.w + 8}
                  rx={6}
                  fill="none"
                  stroke="palevioletred"
                  strokeWidth={2 / zoom}
                  strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                />
              </G>
            ) : null}
          </Svg>
        </GestureDetector>

        {/* Top-left: the ink, then the stickers (only what's been won). */}
        {brushes.length || available.length ? (
          <View pointerEvents="box-none" style={[styles.corner, { top: ui.sp(8), left: ui.sp(8), gap: ui.sp(6) }]}>
            {brushes.length ? (
              <InkPicker
                brushes={brushes}
                ink={ink}
                open={picking}
                onOpen={() => {
                  setTray(false);
                  setPicking(true);
                }}
                onPick={(id) => {
                  setInk(id);
                  setPicking(false);
                }}
                ui={ui}
              />
            ) : null}
            {available.length ? (
              <StickerPicker
                stickers={available}
                open={tray}
                onOpen={() => {
                  setPicking(false);
                  setTray(true);
                }}
                onPick={stamp}
                ui={ui}
              />
            ) : null}
          </View>
        ) : null}

        {sel ? <StickerControls onAct={actOnSticker} ui={ui} /> : null}

        {/* 1× / 2× switch. Both positions always visible; the lit one is current. */}
        <View
          style={[styles.seg, { top: ui.sp(8), right: ui.sp(8), padding: ui.sp(3), borderRadius: ui.sp(8), gap: ui.sp(2) }]}
          accessibilityRole="radiogroup"
        >
          {([1, 2] as Zoom[]).map((z) => (
            <Pressable
              key={z}
              accessibilityRole="radio"
              accessibilityState={{ checked: zoom === z }}
              onPress={() => setZoomTo(z)}
              hitSlop={ui.sp(6)}
              style={[
                styles.segItem,
                { width: ui.sp(38), height: ui.sp(28), borderRadius: ui.sp(6) },
                zoom === z && styles.segOn,
              ]}
            >
              <Text
                style={[styles.segText, { fontSize: ui.f(13) }, zoom === z && styles.segTextOn]}
                maxFontSizeMultiplier={FONT_CAP}
              >
                {z}×
              </Text>
            </Pressable>
          ))}
        </View>

        {/* While a sticker is selected its controls have the canvas's foot. */}
        {zoom === 2 && !sel ? (
          <GestureDetector gesture={minimapGesture}>
            <View
              style={[styles.minimap, { width: mm.w, height: mm.h, right: ui.sp(8), bottom: ui.sp(8), borderRadius: ui.sp(4) }]}
            >
              <Svg width={mm.w} height={mm.h} viewBox={`0 0 ${SPACE.w} ${SPACE.h}`}>
                <Strokes strokes={committed.current} inks={inks.current} width={4} />
                <Stickers stickers={placed.current} />
                <Rect
                  x={origin.x}
                  y={origin.y}
                  width={view.w}
                  height={view.h}
                  rx={6}
                  fill="rgba(219, 112, 147, 0.22)"
                  stroke="palevioletred"
                  strokeWidth={6}
                />
              </Svg>
            </View>
          </GestureDetector>
        ) : null}

        {hint && !sel ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.hint,
              {
                left: ui.sp(8),
                bottom: ui.sp(8),
                paddingVertical: ui.sp(6),
                paddingHorizontal: ui.sp(14),
                gap: ui.sp(8),
                opacity: hintOpacity,
              },
            ]}
          >
            <Svg width={ui.sp(30)} height={ui.sp(18)} viewBox="0 0 40 24">
              <Path
                d="M9 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12M23 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12M31 12h7M35 9l3 3-3 3"
                stroke={styles.hintText.color as string}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={[styles.hintText, { fontSize: ui.f(14) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
              {SCROLLS ? 'Scroll to move around' : 'Slide with two fingers to move around'}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );

  return (
    <WorkStage
      focus={canvas}
      timeLimit={timeLimit}
      onExpire={submit}
      top={header}
      primary={<PigButton name="Submit" onPress={submit} />}
      secondary={[
        <PigButton key="clear" name="Clear" onPress={clear} silent />,
        <PigButton key="undo" name="Undo" onPress={undo} silent />,
      ]}
      footer={footer}
    />
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  host: { flex: 1, minHeight: 0, minWidth: 0, width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: {
    borderWidth: 1,
    borderColor: paper.border,
    overflow: 'hidden',
    backgroundColor: paper.fill,
  },
  seg: { position: 'absolute', flexDirection: 'row', backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  corner: { position: 'absolute', alignItems: 'flex-start', maxWidth: '70%' },
  segItem: { alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#ffffff' },
  segText: { color: '#ffffff', fontFamily: font.bold, letterSpacing: 0.3 },
  segTextOn: { color: '#000000' },
  minimap: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.7)',
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: t.overlay,
    borderWidth: t.edge,
    borderColor: t.overlayBorder,
  },
  hintText: { color: t.overlayText, fontFamily: font.regular },
});
