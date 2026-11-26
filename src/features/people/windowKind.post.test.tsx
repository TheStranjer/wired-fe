/**
 * Tests for posting from the people window kind (WFE-283): the draft is posted
 * as the watched window's account without entering any buffer, the API error
 * comes back as the result, and a window with no account of its own asks which
 * account to post as (WFE-284).
 */
import { describe, expect, it } from 'vitest';

import { windowKind } from './windowKind';
import { accountKey, type StoredAccount } from '../../accounts/accountStore';
import { type AppState, coreReducer, initialAppState } from '../../state/appState';
import { peopleWindowOpen } from '../../state/peopleWindow';
import { runKindPost } from '../../test/kindPost';
import { activeWindow, windowId } from '../../windows/model';
import type { WindowRef, WindowState } from '../../windows/model';

const ORIGIN = 'https://wired.example';

const ACCOUNT: StoredAccount = {
  key: accountKey(ORIGIN, '1'),
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

const HOME: WindowRef = { kind: 'home', accountKey: ACCOUNT.key, target: null };

/** A signed-in session with the home window's people window open and active. */
function peopleSession(): { readonly state: AppState; readonly win: WindowState } {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  const home = coreReducer(signed, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const watched = home.windows.windows.find((candidate) => candidate.id === windowId(HOME));
  if (watched === undefined) {
    throw new Error('the home window did not open');
  }
  const state = coreReducer(home, { type: 'windows', action: peopleWindowOpen(watched) });
  return { state, win: activeWindow(state.windows) };
}

describe('posting from the people window kind', () => {
  it('posts as the watched window’s account, not into the buffer', async () => {
    const { state, win } = peopleSession();

    const run = await runKindPost(windowKind, { state, win, origin: ORIGIN }, 'sup');

    expect(run.result).toBeNull();
    expect(run.bodies).toStrictEqual([{ status: 'sup', visibility: 'public' }]);
    expect(run.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'statuses' }));
    expect(run.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'print', text: 'posted as @lain@wired.example' }),
    );
  });

  it('resolves the API error when the post is refused', async () => {
    const { state, win } = peopleSession();

    const run = await runKindPost(windowKind, { state, win, origin: ORIGIN, refused: true }, 'sup');

    expect(run.result).toBe('HTTP 422: Text is too long');
  });

  it('asks which account when the watched window has no account of its own', async () => {
    const { state, win } = peopleSession();
    const accountless = { ...win, ref: { ...win.ref, accountKey: null } };
    const two = coreReducer(state, {
      type: 'accounts',
      accounts: [ACCOUNT, { ...ACCOUNT, key: accountKey(ORIGIN, '2'), accountId: '2' }],
      activeKey: ACCOUNT.key,
    });

    const run = await runKindPost(
      windowKind,
      { state: two, win: accountless, origin: ORIGIN },
      'sup',
    );

    expect(run.result).toBeNull();
    expect(run.bodies).toStrictEqual([]);
    expect(run.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'openAccountPick' }));
  });
});
