import React, { forwardRef, useEffect, useImperativeHandle, useReducer, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ClearUndo, PILL_H, PILL_INSET, ZoomControl } from './CanvasControls';
import { Stickers, Strokes } from './DrawingArt';
import { BrushPicker } from './BrushPicker';
import { StickerControls, StickerPicker, type StickerAct } from './StickerPicker';
import { SPACE, STROKE, inkFor, type Drawing, type Sticker } from '../lib/drawing';
import type { Brush } from '../state/brush';
import { thinStroke } from '../lib/strokes';
import { ZOOM_MAX, zoomSettle, zoomStep } from '../lib/zoom';
import { BRUSH_SIZE, rewardsOf } from '../rewards/catalog';
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

// Development builds show how big the drawing is as it's sent, on the canvas
// (src/dev/DrawingSize.tsx). Behind __DEV__, which is constant-folded away in
// release bundles, so the readout never reaches them.
const DrawingSize = __DEV__ ? (require('../dev/DrawingSize') as typeof import('../dev/DrawingSize')).DrawingSize : null;

// Points closer than this (units, at 1×; it shrinks as the zoom grows, so it's
// always about a pixel on screen) to the previous one are dropped: they're
// touch jitter, and they'd bloat the path without changing its shape.
const MIN_STEP = 1;
// A stroke shorter than this (units, at 1×, likewise) that was cut off by a
// second finger landing is an accidental touch-down on the way to a
// two-finger slide or pinch, not a mark the player meant to make.
const ACCIDENT = 6;
// The two-finger hint fades on its own after this long. Its key is new with
// pinching, so a player who learned to slide at 2× hears about pinching once.
const HINT_MS = 8000;
const HINT_KEY = 'pinch';
// Minimap box, base dp.
const MINIMAP = { w: 88, h: 66 };
// The controls' inset from the canvas edge (CanvasControls.tsx), and the gap
// between the pills and what stacks beside them (the minimap, the hint), base dp.
const EDGE = PILL_INSET;
const STACK = 6;
// A browser with a mouse (or trackpad) has no second finger to slide with; it
// scrolls the window instead (see the wheel handler), and the hint says so.
const SCROLLS = Platform.OS === 'web' && window.matchMedia('(pointer: fine)').matches;
// Wheel deltas in lines (Firefox with a mouse) are converted at this many px.
const WHEEL_LINE_PX = 16;
// Ctrl+wheel (a trackpad pinch, as browsers report it) zooms by e^(−delta ×
// WHEEL_ZOOM), the delta capped at WHEEL_ZOOM_CAP px so a mouse wheel's notch
// is one comfortable step rather than a leap.
const WHEEL_ZOOM = 0.01;
const WHEEL_ZOOM_CAP = 25;

type Pt = { x: number; y: number };

// A sticker on this canvas, with a key of its own so the undo history can
// find it (the key isn't sent).
type Placed = Sticker & { key: number };
// The undo history: strokes and stickers in the order they went down, and
// Clear, which keeps everything it cleared (the history too) so Undo can put
// it back.
type Cleared = { committed: string[]; inks: (string | null)[]; widths: (number | null)[]; placed: Placed[]; history: Step[] };
type Step = { kind: 'stroke' } | { kind: 'sticker'; key: number } | { kind: 'clear'; was: Cleared };

// A new sticker's width, as a share of the view (so it's the same size on
// screen at any zoom, within STICKER_SIZES drawing units); the controls grow /
// shrink it by STICKER_STEP and turn it by STICKER_TURN degrees.
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

// The drawing surface: the game's (PigCanvas, in WorkStage's frame with its
// timer and Submit) and the one on Rewards › Art supplies, to try out what
// the player has won (app/rewards.tsx). It fills the box it's given with the
// largest 4:3 that fits, showing the drawing space through a window: all of
// it at 1×, a tenth of its width at 10×. One finger always draws; two fingers
// pinch to zoom and slide the window; − zoom + in the top-right corner steps
// the zoom, and while zoomed in the minimap under it shows where the window
// is and can be tapped or dragged to jump. Clear · Undo is in the
// bottom-right corner: Undo takes back the last stroke or sticker, whichever
// went down last, or a Clear. A player who has won brush colors picks the ink
// in the top-left corner (BrushPicker), and one who has won Brush size
// (catalog.ts BRUSH_SIZE) the width there too, on a slider; while it moves,
// the brush shows at its true size in the middle of the view. Each stroke
// keeps the ink and width it was drawn with. One who has
// won stickers stamps them from the button under it (StickerPicker): a new
// sticker lands mid-view, selected, and while it's selected one finger moves
// it instead of drawing and its controls (StickerControls) take the foot of
// the canvas to resize, turn or remove it until Done, the zoom and Clear ·
// Undo stepping aside (their − and + would be easy to mix up; a pinch still
// zooms). The screen holding it takes the drawing (`data`) through the ref.
//
// The drawing itself (strokes, stickers, the undo history, the ink and
// width, the zoom and where the window is) lives in a store
// (`useDrawingStore`) the screen holds and hands in: the board is drawn in a
// different place when the phone turns (WorkStage's two layouts), so it starts
// afresh then, and picks the drawing up again from the store. Without one it
// keeps its own. The store can take its ink and width from a brush that
// outlasts it (the game's, src/state/brush.ts), so the game's drawing screen
// starts each turn with the brush the last one ended on.
type Ref<T> = { current: T };
export type DrawingStore = {
  committed: Ref<string[]>;
  // In step with `committed`: each stroke's brush (null for black) and width
  // (null for STROKE).
  inks: Ref<(string | null)[]>;
  widths: Ref<(number | null)[]>;
  placed: Ref<Placed[]>;
  history: Ref<Step[]>;
  nextKey: Ref<number>;
  // The brush in use.
  ink: Ref<string | null>;
  width: Ref<number>;
  zoom: Ref<number>;
  // The window's top-left corner, in units, always inside the drawing at the zoom.
  win: Ref<Pt>;
};
const newStore = (brush?: Brush): DrawingStore => ({
  committed: { current: [] },
  inks: { current: [] },
  widths: { current: [] },
  placed: { current: [] },
  history: { current: [] },
  nextKey: { current: 1 },
  ink: brush?.ink ?? { current: null },
  width: brush?.width ?? { current: STROKE },
  zoom: { current: 1 },
  win: { current: { x: 0, y: 0 } },
});
export function useDrawingStore(brush?: Brush): DrawingStore {
  return useRef(newStore(brush)).current;
}

// The drawing in a store, as it's sent (src/lib/drawing.ts): each stroke
// with only the points its shape needs (src/lib/strokes.ts), so a detailed
// drawing stays small (`thin` false: every point, for the development size
// readout to compare). A drawing all in black at the usual width without
// stickers goes without `inks`, `widths` or `stickers`, exactly as before them.
export function drawingData(store: DrawingStore, thin = true): string {
  const strokes = thin ? store.committed.current.map(thinStroke) : store.committed.current;
  const out: Drawing = { w: SPACE.w, h: SPACE.h, strokes };
  if (store.inks.current.some((i) => i !== null)) out.inks = store.inks.current;
  if (store.widths.current.some((w) => w !== null)) out.widths = store.widths.current;
  if (store.placed.current.length) out.stickers = store.placed.current.map(({ id, x, y, s, r }) => ({ id, x, y, s, r }));
  return JSON.stringify(out);
}

// Whether a store has anything drawn in it.
export const drawingStarted = (store: DrawingStore) => store.committed.current.length > 0 || store.placed.current.length > 0;

export type DrawingBoardHandle = {
  // The drawing as it's sent (src/lib/drawing.ts), the stroke under the
  // finger finished first.
  data: () => string;
};

export const DrawingBoard = forwardRef<DrawingBoardHandle, { store?: DrawingStore }>(function DrawingBoard({ store }, ref) {
  const ui = useUi();
  const styles = useThemedStyles(makeStyles);
  const own = useDrawingStore();
  const kept = store ?? own;

  // Replaced (never mutated) on each commit, so `Strokes` (memoized) sees a new
  // identity exactly when there is something new to draw. `inks` and `widths`
  // run in step with it: the brush each stroke was drawn with, null for
  // black, and its width, null for STROKE.
  const { committed, inks, widths } = kept;

  // The brushes this player has won (src/rewards), the one in use, and
  // whether the picker is open. With none won (and no Brush size), there's
  // no picker.
  const { owned } = useInventory();
  const brushes = rewardsOf('brush').filter((b) => !b.soon && owned.has(b.id));
  const [ink, setInkNow] = useState<string | null>(kept.ink.current);
  const setInk = (id: string | null) => {
    kept.ink.current = id;
    setInkNow(id);
  };
  const inkRef = useRef(ink);
  inkRef.current = ink;
  const [picking, setPicking] = useState(false);

  // The width, for a player who has won Brush size (else every line is
  // STROKE wide), and whether the slider is held: then the brush shows at its
  // true size in the middle of the view.
  const sizes = owned.has(BRUSH_SIZE);
  const [widthNow, setWidthNow] = useState(kept.width.current);
  const width = sizes ? widthNow : STROKE;
  const setWidth = (w: number) => {
    kept.width.current = w;
    setWidthNow(w);
  };
  const widthRef = useRef(width);
  widthRef.current = width;
  const [sliding, setSliding] = useState(false);

  // The stickers this player can use (their packs), the ones on the drawing,
  // the undo history, the one selected (by key), and whether the tray is open.
  const available = stickersIn(owned);
  const { placed, history, nextKey } = kept;
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
  const sizeRef = useRef(size);
  sizeRef.current = size;

  // Zoom and window are drawing state, not layout state: the phone can turn,
  // the canvas box can change size, and the same patch of the drawing stays on
  // screen. Both live in the store and change many times a frame mid-pinch,
  // so they're read from it (`geom`) rather than from what was last drawn.
  const { win } = kept;
  // Screen px per drawing unit; everything that touches the canvas goes
  // through this and the window.
  const geom = () => {
    const zoom = kept.zoom.current;
    const w = sizeRef.current.w;
    return { zoom, origin: win.current, scale: w ? (w * zoom) / SPACE.w : 1 };
  };
  const toUnits = (x: number, y: number): Pt => {
    const g = geom();
    return { x: g.origin.x + x / g.scale, y: g.origin.y + y / g.scale };
  };
  // Anything not a number (a gesture's coordinates gone missing) leaves that
  // axis where it was rather than losing the window for good.
  const moveWindow = (x: number, y: number) => {
    const z = kept.zoom.current;
    const was = win.current;
    win.current = {
      x: clamp(Number.isFinite(x) ? x : was.x, 0, SPACE.w - SPACE.w / z),
      y: clamp(Number.isFinite(y) ? y : was.y, 0, SPACE.h - SPACE.h / z),
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
  // Shown the first time + zooms in from 1×, at the bottom-left of the canvas
  // over Clear · Undo's row. Fades when a pinch or a two-finger slide (or a
  // scroll, in a browser) moves the window (learned for good), after HINT_MS
  // (comes back on the next zoom in from 1×), or when the zoom goes back to 1×.
  const [hint, setHint] = useState(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const learned = useRef(false);
  const hintOn = useRef(false);
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
    if (!hintOn.current) return;
    hintOn.current = false;
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = null;
    Animated.timing(hintOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(
      ({ finished }) => finished && setHint(false),
    );
  };
  const showHint = () => {
    if (learned.current) return;
    hintOn.current = true;
    setHint(true);
    Animated.timing(hintOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(hideHint, HINT_MS);
  };
  const zoomLearned = () => {
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

  // ---- Zoom ----------------------------------------------------------------
  // To a zoom (kept in range), holding still the point of the drawing under
  // (fx, fy) on the canvas: the fingers' midpoint, the pointer, or the middle.
  const zoomAbout = (to: number, fx: number, fy: number) => {
    const g = geom();
    const z = clamp(to, 1, ZOOM_MAX);
    if (z === g.zoom) return;
    const p = { x: g.origin.x + fx / g.scale, y: g.origin.y + fy / g.scale };
    const scale = (g.scale * z) / g.zoom;
    kept.zoom.current = z;
    moveWindow(p.x - fx / scale, p.y - fy / scale);
    if (z === 1) hideHint();
    schedule();
  };
  // − and +, about the middle of the view.
  const stepZoom = (dir: 1 | -1) => {
    const from = geom().zoom;
    const to = zoomStep(from, dir);
    zoomAbout(to, sizeRef.current.w / 2, sizeRef.current.h / 2);
    if (from === 1 && to > 1) showHint();
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
    if (cut && s.len < ACCIDENT / geom().zoom) {
      force();
      return;
    }
    const { x, y } = s.last;
    const d = s.moved ? `${s.d} L ${px(x)} ${px(y)}` : `${s.d} L ${px(x + 0.1)} ${px(y)}`;
    committed.current = [...committed.current, d];
    inks.current = [...inks.current, inkRef.current];
    widths.current = [...widths.current, widthRef.current === STROKE ? null : widthRef.current];
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
      const step = MIN_STEP / geom().zoom;
      if (Math.abs(dx) < step && Math.abs(dy) < step) return;
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

  // Two fingers slide the window when zoomed in. Runs alongside `draw`: when
  // the second finger lands, `draw` hits its pointer limit and finalizes, and
  // this starts (with `pinch`, which zooms while this moves).
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
      const g = geom();
      if (g.zoom === 1) return;
      moveWindow(g.origin.x - e.changeX / g.scale, g.origin.y - e.changeY / g.scale);
      slideMoved.current = true;
      schedule();
    })
    .onFinalize(() => {
      secondFinger.current = false;
      if (slideMoved.current) zoomLearned();
    });

  // Two fingers pinch to zoom, about their midpoint; `slide` carries the
  // window along as they move. Ending near a step settles on it. The midpoint
  // is the pinch's focal point where it has one; in a browser (gesture-handler
  // 3.3 on web) that comes through as NaN, so it's worked out from the touches.
  const pinchAt = useRef<Pt>({ x: 0, y: 0 });
  const pinched = useRef(false);
  const midpoint = (touches: { x: number; y: number }[]) => {
    if (touches.length < 2) return;
    pinchAt.current = {
      x: touches.reduce((sum, t) => sum + t.x, 0) / touches.length,
      y: touches.reduce((sum, t) => sum + t.y, 0) / touches.length,
    };
  };
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      pinched.current = false;
    })
    .onTouchesDown((e) => midpoint(e.allTouches))
    .onTouchesMove((e) => midpoint(e.allTouches))
    .onChange((e) => {
      if (Number.isFinite(e.focalX) && Number.isFinite(e.focalY)) pinchAt.current = { x: e.focalX, y: e.focalY };
      zoomAbout(geom().zoom * e.scaleChange, pinchAt.current.x, pinchAt.current.y);
      pinched.current = true;
    })
    .onFinalize(() => {
      if (!pinched.current) return;
      const step = zoomSettle(geom().zoom);
      if (step !== undefined) zoomAbout(step, pinchAt.current.x, pinchAt.current.y);
      zoomLearned();
    });

  const canvasGesture = Gesture.Simultaneous(draw, slide, pinch);

  // Minimap: a tap recentres the window on that spot, a drag pulls it along.
  const mm = { w: ui.sp(MINIMAP.w), h: ui.sp(MINIMAP.h) };
  const jump = (x: number, y: number) => {
    const z = geom().zoom;
    const cx = (x / mm.w) * SPACE.w;
    const cy = (y / mm.h) * SPACE.h;
    moveWindow(cx - SPACE.w / z / 2, cy - SPACE.h / z / 2);
    schedule();
  };
  const minimapGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => jump(e.x, e.y))
    .onUpdate((e) => jump(e.x, e.y));

  // On web a scroll over the canvas when zoomed in moves the window: a mouse
  // wheel goes up and down (shift+wheel sideways), a trackpad's two-finger
  // scroll goes anywhere, the same as two fingers on a phone. A trackpad pinch
  // (which browsers report as ctrl+wheel), or ctrl and the wheel, zooms the
  // canvas about the pointer instead of the page. Registered by hand because
  // React's onWheel is passive and can't stop the page from scrolling.
  const frameRef = useRef<ViewInstance>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = frameRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : 1;
      if (e.ctrlKey) {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const d = clamp(e.deltaY * unit, -WHEEL_ZOOM_CAP, WHEEL_ZOOM_CAP);
        zoomAbout(geom().zoom * Math.exp(-d * WHEEL_ZOOM), e.clientX - r.left - el.clientLeft, e.clientY - r.top - el.clientTop);
        return;
      }
      const g = geom();
      if (g.zoom === 1) return;
      e.preventDefault();
      moveWindow(g.origin.x + (e.deltaX * unit) / g.scale, g.origin.y + (e.deltaY * unit) / g.scale);
      schedule();
      zoomLearned();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---- Actions -------------------------------------------------------------
  // The stroke under the finger goes in first.
  const data = () => {
    commit(false);
    return drawingData(kept);
  };
  const undo = () => {
    const last = history.current[history.current.length - 1];
    if (!last) return;
    history.current = history.current.slice(0, -1);
    if (last.kind === 'clear') {
      // Everything back as it was before the Clear, history and all.
      committed.current = last.was.committed;
      inks.current = last.was.inks;
      widths.current = last.was.widths;
      placed.current = last.was.placed;
      history.current = last.was.history;
      force();
    } else if (last.kind === 'stroke') {
      committed.current = committed.current.slice(0, -1);
      inks.current = inks.current.slice(0, -1);
      widths.current = widths.current.slice(0, -1);
      force();
    } else {
      if (selectedRef.current === last.key) setSelected(null);
      restick(placed.current.filter((s) => s.key !== last.key));
    }
  };
  // Kept in the history, so Undo brings it all back. Clearing a blank canvas
  // doesn't count as a step.
  const clear = () => {
    live.current = null;
    setSelected(null);
    if (drawingStarted(kept)) {
      const was: Cleared = {
        committed: committed.current,
        inks: inks.current,
        widths: widths.current,
        placed: placed.current,
        history: history.current,
      };
      committed.current = [];
      inks.current = [];
      widths.current = [];
      placed.current = [];
      history.current = [{ kind: 'clear', was }];
    }
    force();
  };

  // A sticker from the tray, in the middle of the view, selected.
  const stamp = (id: string) => {
    const key = nextKey.current++;
    const g = geom();
    const w = SPACE.w / g.zoom;
    const at = { x: g.origin.x + w / 2, y: g.origin.y + SPACE.h / g.zoom / 2 };
    const s = Math.round(clamp(w * STICKER_NEW, STICKER_SIZES.min, STICKER_SIZES.max));
    placed.current = [...placed.current, { id, ...at, s, r: 0, key }];
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
  useImperativeHandle(ref, () => ({ data }));

  // The selected sticker's outline: a dashed box round it, turned with it.
  const sel = placed.current.find((s) => s.key === selected);
  const selArt: Prop | undefined = sel && STICKER_ART[sel.id] ? PROPS[STICKER_ART[sel.id].prop] : undefined;

  const stroke = live.current;
  const zoom = kept.zoom.current;
  const origin = win.current;
  const view = { w: SPACE.w / zoom, h: SPACE.h / zoom };
  const viewBox = `${origin.x} ${origin.y} ${view.w} ${view.h}`;
  // Under the zoom pill (the minimap, and the development size readout in
  // the middle), over Clear · Undo (the hint).
  const stacked = ui.sp(EDGE + PILL_H + STACK);

  return (
    <View style={styles.host} onLayout={onHostLayout}>
      <View ref={frameRef} style={[styles.frame, { width: size.w, height: size.h, borderRadius: ui.sp(layout.imageRadius) }]}>
        <GestureDetector gesture={canvasGesture}>
          <Svg width={size.w} height={size.h} viewBox={viewBox}>
            <Strokes strokes={committed.current} inks={inks.current} widths={widths.current} />
            {stroke ? (
              <Path
                d={stroke.d}
                stroke={inkFor(ink)}
                strokeWidth={width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            <Stickers stickers={placed.current} />
            {sliding && picking ? (
              // The brush at its true size, mid-view, in a dashed ring so a
              // thin one still shows. Only while the picker is open: drawing
              // can shut it mid-slide, and then the slider never lets go.
              <G>
                <Circle cx={origin.x + view.w / 2} cy={origin.y + view.h / 2} r={width / 2} fill={inkFor(ink)} />
                <Circle
                  cx={origin.x + view.w / 2}
                  cy={origin.y + view.h / 2}
                  r={width / 2 + 4 / zoom}
                  fill="none"
                  stroke="rgba(0, 0, 0, 0.35)"
                  strokeWidth={1 / zoom}
                  strokeDasharray={`${3 / zoom} ${3 / zoom}`}
                />
              </G>
            ) : null}
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

        {/* Top-left: the brush, then the stickers (only what's been won). */}
        {brushes.length || sizes || available.length ? (
          <View pointerEvents="box-none" style={[styles.corner, { top: ui.sp(EDGE), left: ui.sp(EDGE), gap: ui.sp(6) }]}>
            {brushes.length || sizes ? (
              <BrushPicker
                brushes={brushes}
                ink={ink}
                size={sizes ? { width, onWidth: setWidth, onSliding: setSliding } : undefined}
                open={picking}
                onOpen={() => {
                  setTray(false);
                  setPicking(true);
                }}
                // With the slider there it stays open while the brush is set
                // up; drawing shuts it.
                onPick={(id) => {
                  setInk(id);
                  if (!sizes) setPicking(false);
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

        {DrawingSize ? (
          <DrawingSize
            changes={[committed.current, inks.current, widths.current, placed.current]}
            sent={() => drawingData(kept)}
            raw={() => drawingData(kept, false)}
            hidden={picking || tray}
            top={stacked}
            ui={ui}
          />
        ) : null}

        {/* While a sticker is selected its controls have the canvas's foot,
            and the zoom, the minimap and Clear · Undo step aside. */}
        {sel ? (
          <StickerControls onAct={actOnSticker} ui={ui} />
        ) : (
          <>
            <ZoomControl
              zoom={zoom}
              min={1}
              max={ZOOM_MAX}
              onStep={stepZoom}
              ui={ui}
              style={[styles.pinned, { top: ui.sp(EDGE), right: ui.sp(EDGE) }]}
            />
            <ClearUndo onClear={clear} onUndo={undo} ui={ui} style={[styles.pinned, { bottom: ui.sp(EDGE), right: ui.sp(EDGE) }]} />
          </>
        )}

        {zoom > 1 && !sel ? (
          <GestureDetector gesture={minimapGesture}>
            <View
              style={[
                styles.minimap,
                { width: mm.w, height: mm.h, right: ui.sp(EDGE), top: stacked, borderRadius: ui.sp(4) },
              ]}
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
                left: ui.sp(EDGE),
                bottom: stacked,
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
              {SCROLLS ? 'Scroll to move around' : 'Pinch to zoom · two fingers to move'}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );

});

const makeStyles = (t: Theme) => StyleSheet.create({
  host: { flex: 1, minHeight: 0, minWidth: 0, width: '100%', alignItems: 'center', justifyContent: 'center' },
  frame: {
    borderWidth: 1,
    borderColor: paper.border,
    overflow: 'hidden',
    backgroundColor: paper.fill,
  },
  corner: { position: 'absolute', alignItems: 'flex-start', maxWidth: '70%' },
  pinned: { position: 'absolute' },
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
