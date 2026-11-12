// The drawing board's zoom (src/components/DrawingBoard.tsx): from 1× (the
// whole drawing) to ZOOM_MAX, anywhere between by pinching; − and + step
// through ZOOM_STEPS from wherever a pinch left it. A pinch that ends within
// ZOOM_SNAP (a share) of a step settles on it, so the readout says 2×, not
// 2.03×.
export const ZOOM_MAX = 10;
export const ZOOM_STEPS = [1, 1.5, 2, 3, 5, 7, 10];
export const ZOOM_SNAP = 0.04;

// The next step in (+1) or out (−1) from a zoom, past any it's barely off:
// + at 1.98× (shown as 2×) goes to 3×, not 2×.
export function zoomStep(zoom: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((s) => s > zoom * (1 + ZOOM_SNAP)) ?? ZOOM_MAX;
  return [...ZOOM_STEPS].reverse().find((s) => s < zoom * (1 - ZOOM_SNAP)) ?? 1;
}

// The step a zoom is close enough to settle on, if any.
export const zoomSettle = (zoom: number): number | undefined => ZOOM_STEPS.find((s) => Math.abs(zoom / s - 1) < ZOOM_SNAP);

// A zoom as the readout shows it: one decimal at most (1.6×, 2×, 10×).
export const zoomLabel = (zoom: number) => `${Number(zoom.toFixed(1))}×`;
