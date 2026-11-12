// How a screen's reward cards fit the card they're shown on (FolderTabs and
// TierPages, the Rewards screens and Your pig). The card is the column's whole
// height whichever tab is open, so its cards must fit that height without
// the column being scaled as a whole: each tier's cards share the card's
// width, as many to a row as fit, and when a tab has more than the card holds,
// the cards themselves shrink (`scale`), more to a row each time, to MIN_SCALE
// at the least. Every tab of a screen gets the same size, its tallest tab's,
// so the cards don't change size from tab to tab.
//
// Plain arithmetic on the layout's own measures (dp), so it can be tested; the
// component hands them in from the UI scale (TierPages.tsx).

export const MIN_SCALE = 0.75; // smaller, a card's name is too small to read
const STEP = 0.05;

export type FitMeasures = {
  w: number; // the card's inside, dp
  h: number;
  cell: number; // a card's least width at full size
  gap: number; // between cards, at full size
  tileH: number; // a card's height at full size (the part that scales)
  tileFixed?: number; // and the part that doesn't (its outline)
  headH: number; // a tier's heading
  headGap: number; // from a heading to its cards
  between: number; // from a tier's cards to the next tier's heading
  footGap: number; // from the last cards to the foot, when there is one
};

// Each tab: how many cards in each of its tiers, and its foot's height (0 for none).
export type FitPage = { tiers: number[]; foot: number };

export type Fit = { scale: number; cols: number; fits: boolean };

// The cards to a row at a scale.
export const colsAt = (m: FitMeasures, scale: number) =>
  Math.max(1, Math.floor((m.w + m.gap * scale) / (m.cell * scale + m.gap * scale)));

// A tab's height at a scale.
export function pageHeight(m: FitMeasures, page: FitPage, scale: number): number {
  const cols = colsAt(m, scale);
  const tiers = page.tiers.filter((n) => n > 0);
  const tileH = m.tileH * scale + (m.tileFixed ?? 0);
  const body = tiers.reduce((sum, n) => {
    const rows = Math.ceil(n / cols);
    return sum + m.headH + m.headGap + rows * tileH + (rows - 1) * m.gap * scale;
  }, 0);
  return body + Math.max(0, tiers.length - 1) * m.between + (page.foot ? m.footGap + page.foot : 0);
}

// The largest scale (full size, then down a step at a time) at which every
// tab fits; MIN_SCALE, not fitting, if none does.
export function fitTiers(m: FitMeasures, pages: FitPage[]): Fit {
  for (let scale = 1; scale >= MIN_SCALE - 1e-9; scale = Math.round((scale - STEP) * 100) / 100) {
    if (pages.every((p) => pageHeight(m, p, scale) <= m.h)) return { scale, cols: colsAt(m, scale), fits: true };
  }
  return { scale: MIN_SCALE, cols: colsAt(m, MIN_SCALE), fits: false };
}
