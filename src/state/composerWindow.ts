/**
 * Composer windows (decision 13): the transition that opens a fresh composer
 * pane. Every `/composer` is a new draft, so the window's target is the draft's
 * number — the lowest one no open composer holds — and its title is `compose`
 * for the first and `compose/<n>` for the extras, the way a second buffer of
 * one kind is named elsewhere. The posting account is the window's
 * `accountKey`; the "Post as" picker changes it (windows `setAccount`).
 */

import type { StoredAccount } from '../accounts/accountStore';
import type { WindowState } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** The title of draft number {@link n}: plain for the first, `compose/<n>` after. */
function composerTitle(n: number): string {
  return n === 1 ? 'compose' : `compose/${String(n)}`;
}

/** The lowest draft number, from 1, that no composer in {@link windows} holds. */
function freeDraftNumber(windows: readonly WindowState[]): number {
  const taken = new Set(
    windows.filter((win) => win.ref.kind === 'composer').map((win) => win.ref.target),
  );
  let n = 1;
  while (taken.has(String(n))) {
    n += 1;
  }
  return n;
}

/** The window-list transition that opens a fresh composer posting as {@link account}. */
export function composerWindowOpen(
  account: StoredAccount,
  windows: readonly WindowState[],
): WindowsAction {
  const n = freeDraftNumber(windows);
  return {
    type: 'open',
    ref: { kind: 'composer', accountKey: account.key, target: String(n) },
    title: composerTitle(n),
  };
}
