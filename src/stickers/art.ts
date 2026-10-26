import { PROPS, type Prop } from '../theme/skins/props';

// The pictures a drawing can have stamped on it (src/lib/drawing.ts
// `stickers`), by sticker id. Each is vector art in the same form as the
// seasonal props (src/theme/skins/props.ts): a few hundred bytes, sharp at
// any size, outlined like the pig. `pack` is the sticker pack reward that
// unlocks it (src/rewards/catalog.ts).
//
// A sticker's id travels in the drawing, so once one has shipped its id never
// changes. A drawing naming a sticker this app doesn't have yet (from a newer
// version) shows without it.
//
// None ship yet: the packs' art comes with the stickers themselves. A
// development build has one, borrowing Valentine's heart, to see a sticker in
// a drawing.
export type StickerArt = { pack: string; art: Prop };

export const STICKER_ART: Record<string, StickerArt> = __DEV__ ? { 'dev.heart': { pack: 'dev', art: PROPS.heartRed } } : {};
