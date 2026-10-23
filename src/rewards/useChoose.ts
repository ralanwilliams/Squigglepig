import { useInventory } from './inventory';
import { UNLOCKABLE } from '../theme/skins';
import { useSkin, useThemeMode } from '../theme/theme';
import type { Kind } from './catalog';

// Put an owned reward to use (inventory.tsx choose), from wherever it's
// offered: the Rewards screen, the payout's Use it. A new theme restyles every
// screen, so it arrives behind the light / dark switch's sweep — unless a
// birthday or holiday is showing over whichever theme is chosen, when nothing
// on screen would change.
export function useChoose() {
  const { chosen, choose } = useInventory();
  const { sweep } = useThemeMode();
  const showing = useSkin();
  const covered = !!showing && showing !== (UNLOCKABLE[chosen('theme') ?? ''] ?? null);
  return (kind: Kind, id: string | null) => {
    if (kind === 'theme' && !covered) sweep(() => choose(kind, id));
    else choose(kind, id);
  };
}
