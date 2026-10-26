import type { PropName } from '../theme/skins/props';

// The pictures a drawing can have stamped on it (src/lib/drawing.ts
// `stickers`), by sticker id, in the order the canvas's tray shows them. Each
// is a prop (src/theme/skins/props.ts): vector art, a few hundred bytes,
// sharp at any size, outlined like the pig; the Hats and Characters packs
// borrow some from the seasons and the outfits. `pack` is the sticker pack
// reward that unlocks it (src/rewards/catalog.ts); `label` is its name for
// screen readers.
//
// A sticker's id travels in the drawing, so once one has shipped its id never
// changes. A drawing naming a sticker this app doesn't have (from a newer
// version) shows without it.
export type StickerArt = { label: string; pack: string; prop: PropName };

export const STICKER_ART: Record<string, StickerArt> = {
  'eyes.googly': { label: 'Googly eyes', pack: 'sticker.eyes', prop: 'eyesGoogly' },
  'eyes.angry': { label: 'Angry eyes', pack: 'sticker.eyes', prop: 'eyesAngry' },
  'eyes.sleepy': { label: 'Sleepy eyes', pack: 'sticker.eyes', prop: 'eyesSleepy' },
  'eyes.hearts': { label: 'Heart eyes', pack: 'sticker.eyes', prop: 'eyesHearts' },
  'mouths.smile': { label: 'Smile', pack: 'sticker.mouths', prop: 'mouthSmile' },
  'mouths.laugh': { label: 'Laugh', pack: 'sticker.mouths', prop: 'mouthLaugh' },
  'mouths.tongue': { label: 'Tongue out', pack: 'sticker.mouths', prop: 'mouthTongue' },
  'mouths.frown': { label: 'Frown', pack: 'sticker.mouths', prop: 'mouthFrown' },
  'hats.party': { label: 'Party hat', pack: 'sticker.hats', prop: 'partyHat' },
  'hats.witch': { label: "Witch's hat", pack: 'sticker.hats', prop: 'witchHat' },
  'hats.crown': { label: 'Crown', pack: 'sticker.hats', prop: 'crown' },
  'hats.cowboy': { label: 'Cowboy hat', pack: 'sticker.hats', prop: 'cowboyHat' },
  'characters.ghost': { label: 'Ghost', pack: 'sticker.characters', prop: 'ghost' },
  'characters.cat': { label: 'Cat', pack: 'sticker.characters', prop: 'cat' },
  'characters.bat': { label: 'Bat', pack: 'sticker.characters', prop: 'bat' },
  'characters.turkey': { label: 'Turkey', pack: 'sticker.characters', prop: 'turkey' },
};

// The stickers in the packs a player owns, in tray order.
export const stickersIn = (owned: ReadonlySet<string>) => Object.keys(STICKER_ART).filter((id) => owned.has(STICKER_ART[id].pack));
