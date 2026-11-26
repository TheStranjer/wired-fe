/**
 * Tests for posting as a window's own account without a timeline (WFE-283):
 * the post is created as the window's account with the draft's text, the
 * status is not added to any scrollback, a `posted as @handle` line confirms
 * it in the window, the instance's error comes back as the result, and a
 * window with no account (or one that is not signed in) refuses.
 */
import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer, initialAppState } from './appState';
import { postAsWindowAccount } from './postAsWindowAccount';
import { accountKey, type StoredAccount } from '../accounts/accountStore';
import { runKindPost } from '../test/kindPost';
import { windowId } from '../windows/model';
import type { WindowRef, WindowState } from '../windows/model';

const ORIGIN = 'https://wired.example';

/** The one signed-in account. */
const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** A window with {@link ref}, as the window list holds it. */
function windowOf(ref: WindowRef): WindowState {
  return {
    id: windowId(ref),
    ref,
    title: ref.kind,
    unread: 0,
    highlight: false,
    display: {},
  };
}

const SIGNED: AppState = coreReducer(initialAppState(), {
  type: 'accounts',
  accounts: [ACCOUNT],
  activeKey: ACCOUNT.key,
});

/** The handler as a kind would carry it, wrapped so the helper can drive it. */
const KIND = { onPost: postAsWindowAccount };

describe(postAsWindowAccount, () => {
  it('posts the draft as the window’s account and only prints the confirmation', async () => {
    const win = windowOf({ kind: 'search', accountKey: ACCOUNT.key, target: 'lain' });

    const run = await runKindPost(KIND, { state: SIGNED, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBeNull();
    expect(run.bodies).toStrictEqual([{ status: 'sup', visibility: 'public' }]);
    expect(run.dispatch).toHaveBeenCalledTimes(1);
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'print',
        windowId: win.id,
        level: 'info',
        text: 'posted as @lain@wired.example',
      }),
    );
  });

  it('resolves the instance’s error and prints nothing', async () => {
    const win = windowOf({ kind: 'search', accountKey: ACCOUNT.key, target: 'lain' });

    const run = await runKindPost(
      KIND,
      { state: SIGNED, win, origin: ORIGIN, refused: true },
      'sup',
    );

    expect(run.result).toBe('HTTP 422: Text is too long');
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('refuses a window with no account of its own', async () => {
    const win = windowOf({ kind: 'people', accountKey: null, target: 'feed:x' });

    const run = await runKindPost(KIND, { state: SIGNED, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBe("You can't post in this window. Try /home");
    expect(run.bodies).toStrictEqual([]);
    expect(run.dispatch).not.toHaveBeenCalled();
  });

  it('says to log in when the window’s account is not signed in', async () => {
    const win = windowOf({ kind: 'search', accountKey: 'gone', target: 'lain' });
    const run = await runKindPost(KIND, { state: SIGNED, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBe('Not logged in. Type /connect');
    expect(run.bodies).toStrictEqual([]);
  });
});
