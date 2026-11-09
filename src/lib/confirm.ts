import { createStore } from './store';

// "Are you sure?" before something that can't be undone. There's one for the
// whole app (ConfirmOverlay in src/components/ConfirmDialog.tsx, mounted once in
// the root layout), so it stays up while the game changes screens under it and
// when the phone turns. Kept here, not with what draws it, so the game can ask
// without importing any of it.

export type Confirm = {
  title: string;
  lines: string[];
  cancel: string; // the safe answer: the filled button, and what Back does
  confirm: string;
  onConfirm: () => void;
};

const asked = createStore<Confirm | null>(null);

export const useConfirm = asked.useValue;
export const askConfirm = (confirm: Confirm) => asked.set(confirm);
export const closeConfirm = () => asked.set(null);

// Going ahead runs once, however fast it's tapped.
export function goAhead() {
  const answered = asked.get();
  asked.set(null);
  answered?.onConfirm();
}

// The one question every way out of a game asks; `line` says what leaving costs.
export const confirmLeave = (line: string, onLeave: () => void) =>
  askConfirm({ title: 'Are you sure?', lines: [line], cancel: 'Stay', confirm: 'Leave', onConfirm: onLeave });
