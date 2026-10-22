import { dress } from './layout';
import { PROPS } from './props';
import type { Placement, Skin } from './types';

// A birthday: sunny yellow by day, a party-purple night; the pig in a party
// hat with balloons overhead. On the home art it holds up a cake with the
// name iced on top and sparklers fizzing; everywhere else it holds a
// present. Shown on that one day each year, for each row of the Supabase
// `birthdays` table (src/lib/birthdays.ts).
// Every text pair meets WCAG AA (4.5:1, 3:1 for large bold text);
// `node previews/_check-contrast.mjs` checks every skin.
export type Birthday = { name: string; month: number; day: number };

export function birthday({ name, month, day }: Birthday): Skin {
  const decor = dress({ head: 'partyHat', sky: ['balloonRed', 'balloonBlue', 'balloonYellow'], hold: 'giftBlue' });
  // Both hooves hold the cake on the home art, so the present (and the hoof
  // redrawn round it) go.
  decor.home = [...(decor.home ?? []).filter((p) => p.prop !== 'giftBlue' && !p.prop.startsWith('hoof')), ...heldCake(name)];
  return {
    id: 'birthday',
    label: 'Birthday',
    season: { from: [month, day], to: [month, day] },
    light: {
      background: '#FFE08A',
      accent: '#B0125B',
      text: '#2A1E00',
      textMuted: '#5A4310',
      surfaceText: '#2A1E00',
      surfaceInset: '#FFF7DD',
      overlay: 'rgba(42,20,60,0.86)',
      overlayLabel: '#FFC1E0',
      button: 'rgba(110,34,160,0.92)',
      buttonPressed: '#55188A',
      link: '#5A1C8A',
      success: '#0B4A12',
      shadow: '#5A1C8A',
      divider: 'rgba(42,30,0,0.22)',
    },
    dark: {
      background: '#1B1033',
      accent: '#FFD54F',
      accentText: '#2A1E00',
      text: '#F4EEFF',
      textMuted: '#BDB0DA',
      surface: '#2B1E4D',
      surfaceBorder: '#433570',
      surfaceText: '#F4EEFF',
      surfaceInset: '#22173F',
      overlay: '#30235A',
      overlayText: '#F4EEFF',
      overlayLabel: '#FFC1E0',
      button: '#7C28B4',
      buttonPressed: '#9440CC',
      link: '#FFD54F',
      placeholder: '#9C8FBF',
      divider: 'rgba(244,238,255,0.22)',
    },
    decor,
    trough: ['giftBlue', 'gift'], // presents: the cake is the pig's, not the trough's
  };
}

// The cake on the home art (954 × 900): its hooves land on the pig's, at the
// bottom of its arms, so the pig holds it up against its tummy.
const CAKE = { x: 0.3, y: 0.554, w: 0.4 };
const HOME_ASPECT = 954 / 900;
const TIPS: [number, number][] = [
  [32, 20],
  [50, 12],
  [68, 20],
]; // the sparkler tips, on the cake's grid

function heldCake(name: string): Placement[] {
  const cake = PROPS.cake;
  const unit = CAKE.w / cake.w; // image widths per grid unit
  const sparks = TIPS.map(([gx, gy]): Placement => ({
    prop: 'spark',
    x: CAKE.x + (gx - cake.w / 2) * unit,
    y: CAKE.y + (gy - cake.h / 2) * unit * HOME_ASPECT,
    w: 0.075,
    twinkle: true,
  }));
  return [{ prop: 'cake', ...CAKE, text: name }, ...sparks];
}
