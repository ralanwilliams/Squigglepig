import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { FitBox } from '../components/FitBox';
import { Glyph } from '../components/Glyph';
import { font, type Theme } from '../theme/tokens';
import { useTheme, useThemedStyles } from '../theme/theme';
import { FONT_CAP, useUi } from '../theme/responsive';
import { COMPACT_W, compactCardHeight } from './RewardTile';
import { fitTiers, type FitMeasures } from './tierFit';
import type { Tier } from './catalog';

// A screen's rewards, one page per tab, inside FolderTabs' card: the open
// tab's cards grouped by tier, lowest first, each tier under a heading with
// its stars and how many of it are won (`count`), and the page's `foot`
// (Seasonal themes, what the pig says) at the bottom of the card. The
// Rewards screens, Your pig and the solo game's payout. Free (Classic) and In
// season (the holiday's parts on Your pig) aren't tiers of the catalog's, but
// are shown as tiers of their own.
//
// The cards fill the card's width (as many to a row as fit) and fit its
// height, every tab at the size of the tallest (tierFit.ts). In case the
// sums are out (the system's text much larger than usual), the page is in a
// FitBox, which shrinks it if it still runs over.
export type TierKey = 'free' | 'seasonal' | Tier;
const ORDER: TierKey[] = ['free', 'seasonal', 'common', 'rare', 'premium'];
const LABELS: Record<TierKey, string> = { free: 'Free', seasonal: 'In season', common: 'Common', rare: 'Rare', premium: 'Premium' };
const STARS: Record<TierKey, number> = { free: 0, seasonal: 0, common: 0, rare: 1, premium: 2 };

// A card, drawn at the size the grid gives it (RewardTile / Card `width`, `scale`).
export type TierCard = { key: string; tier: TierKey; owned: boolean; render: (size: { width: number; scale: number }) => React.ReactNode };
export type TierPage<K extends string> = { key: K; label: string; cards: TierCard[]; foot?: React.ReactNode };

const GAP = 5; // between cards, base dp
const FOOT_GUESS = 52; // a foot not yet measured (only the open page's is drawn), base dp

// What a tier's heading counts: how many of it are won, unless the screen
// says otherwise (the payout: how many there are to choose from).
export type TierCount = (won: number, total: number) => { text: string; spoken: string };
const wonOf: TierCount = (won, total) => ({ text: `${won} / ${total}`, spoken: `${won} of ${total} won` });

export function TierPages<K extends string>({ pages, open, count = wonOf }: { pages: TierPage<K>[]; open: K; count?: TierCount }) {
  const ui = useUi();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [feet, setFeet] = useState<Partial<Record<K, number>>>({});
  const page = pages.find((p) => p.key === open) ?? pages[0];

  const onBox = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - box.w) > 0.5 || Math.abs(height - box.h) > 0.5) setBox({ w: width, h: height });
  };
  const onFoot = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (Math.abs(h - (feet[page.key] ?? 0)) > 0.5) setFeet((f) => ({ ...f, [page.key]: h }));
  };

  const tiersOf = (p: TierPage<K>) => ORDER.map((t) => p.cards.filter((c) => c.tier === t)).filter((list) => list.length);
  const headH = Math.max(ui.f(16), ui.sp(14));
  const card = compactCardHeight(ui, theme.edge);
  const measures: FitMeasures = {
    w: box.w,
    h: box.h,
    cell: ui.sp(COMPACT_W),
    gap: ui.sp(GAP),
    tileH: card.scaled,
    tileFixed: card.fixed,
    headH,
    headGap: ui.sp(3),
    between: ui.sp(6) + 1 + ui.sp(5),
    footGap: ui.sp(6),
  };
  const fit = fitTiers(
    measures,
    pages.map((p) => ({ tiers: tiersOf(p).map((list) => list.length), foot: p.foot ? feet[p.key] ?? ui.sp(FOOT_GUESS) : 0 }))
  );
  const gap = ui.sp(GAP) * fit.scale;
  // A hair under the share, so rounding never pushes the last card of a row onto the next.
  const width = box.w ? (box.w - gap * (fit.cols - 1)) / fit.cols - 0.5 : 0;

  if (!page) return null;
  const tiers = tiersOf(page).map((list, i) => {
    const tier = list[0].tier;
    const counted = count(list.filter((c) => c.owned).length, list.length);
    return (
      <View key={tier} style={[i > 0 && styles.next, i > 0 && { marginTop: ui.sp(6), paddingTop: ui.sp(5) }, { gap: ui.sp(3) }]}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${LABELS[tier]}, ${counted.spoken}`}
          style={[styles.head, { height: headH, gap: ui.sp(6) }]}
        >
          <Text style={[styles.tierName, { fontSize: ui.f(12), lineHeight: ui.f(16) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
            {LABELS[tier].toUpperCase()}
          </Text>
          {STARS[tier] ? (
            <View style={styles.stars}>
              {Array.from({ length: STARS[tier] }, (_, s) => (
                <Glyph key={s} name="star" size={ui.sp(12)} color={theme.accent} weight={2.4} />
              ))}
            </View>
          ) : null}
          <Text style={[styles.won, { fontSize: ui.f(11) }]} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
            {counted.text}
          </Text>
        </View>
        <View style={[styles.grid, { gap }]}>{list.map((c) => <React.Fragment key={c.key}>{c.render({ width, scale: fit.scale })}</React.Fragment>)}</View>
      </View>
    );
  });

  const body = (
    <View style={styles.flex}>
      <View style={page.foot ? { paddingBottom: ui.sp(6) } : undefined}>{tiers}</View>
      {page.foot ? (
        <View onLayout={onFoot} style={[styles.foot, { paddingTop: ui.sp(6) }]}>
          {page.foot}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.flex} onLayout={onBox} accessibilityLabel={page.label}>
      {box.w ? (fit.fits ? body : <FitBox align="top" style={styles.flex}>{body}</FitBox>) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  next: { borderTopWidth: 1, borderTopColor: t.divider },
  head: { flexDirection: 'row', alignItems: 'center' },
  tierName: { color: t.surfaceText, fontFamily: font.bold, letterSpacing: 0.8 },
  stars: { flexDirection: 'row' },
  won: { marginLeft: 'auto', color: t.textMuted, fontFamily: font.regular },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // At the card's bottom, under a rule.
  foot: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: t.divider },
});
