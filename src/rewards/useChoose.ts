import { useInventory } from './inventory';
import { UNLOCKABLE } from '../theme/skins';
import { useSkin, useThemeMode } from '../theme/theme';
import type { Kind } from './catalog';

// Put an owned reward to use (inventory.tsx choose), from wherever it's
// offered: the Rewards screen, the payout's Use it. A theme goes on at once,
// over any birthday or holiday showing (theme.tsx pinChoice), and restyles
// every screen, so it arrives behind the light / dark switch's sweep —
// unless it's what is showing already.
export function useChoose() {
  const { choose } = useInventory();
  const { sweep, pinChoice } = useThemeMode();
  const showing = useSkin();
  return (kind: Kind, id: string | null) => {
    if (kind !== 'theme') return choose(kind, id);
    const apply = () => {
      choose(kind, id);
      pinChoice();
    };
    if (showing !== (UNLOCKABLE[id ?? ''] ?? null)) sweep(apply);
    else apply();
  };
}
