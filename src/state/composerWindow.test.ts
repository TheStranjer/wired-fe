/**
 * Tests for opening composer windows: every one is a fresh draft numbered from
 * 1, the first titled `compose` and the extras `compose/<n>`, the lowest number
 * a closed composer freed is reused, and opening posts as the account given.
 */
import { describe, expect, it } from 'vitest';

import { composerWindowOpen } from './composerWindow';
import type { StoredAccount } from '../accounts/accountStore';
import { initialWindowsState } from '../windows/model';
import type { WindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';

const ACCOUNT: StoredAccount = {
  key: 'https://wired.example#1',
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** {@link windows} with one more composer opened. */
function opened(windows: WindowsState): WindowsState {
  return windowsReducer(windows, composerWindowOpen(ACCOUNT, windows.windows));
}

/** The id of the window at 0-based {@link index}, failing when there is none. */
function idAt(windows: WindowsState, index: number): string {
  const win = windows.windows.at(index);
  if (win === undefined) {
    throw new Error(`no window at ${String(index)}`);
  }
  return win.id;
}

describe(composerWindowOpen, () => {
  it('opens the first composer as `compose`, posting as the account', () => {
    expect(composerWindowOpen(ACCOUNT, initialWindowsState().windows)).toStrictEqual({
      type: 'open',
      ref: { kind: 'composer', accountKey: ACCOUNT.key, target: '1' },
      title: 'compose',
    });
  });

  it('titles the extras compose/<n>, each a window of its own', () => {
    const two = opened(opened(initialWindowsState()));

    expect(two.windows.map((win) => win.title)).toStrictEqual(['status', 'compose', 'compose/2']);
    expect(two.activeId).toBe(idAt(two, 2));
  });

  it('reuses the lowest number a closed composer freed', () => {
    const two = opened(opened(initialWindowsState()));
    const closed = windowsReducer(two, { type: 'close', id: idAt(two, 1) });

    expect(opened(closed).windows.map((win) => win.title)).toStrictEqual([
      'status',
      'compose/2',
      'compose',
    ]);
  });
});
