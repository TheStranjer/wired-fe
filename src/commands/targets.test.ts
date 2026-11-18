/**
 * Tests for the shared post-target resolvers: a label finding its post in the
 * active window, an unknown label refused, the selection fallback with all of
 * args kept as rest, nothing selected refused, a boost resolved to the
 * original status, and the refusal while the window's account has no session.
 * The own-post resolver on top: the same target when this account wrote the
 * post, the verb's refusal when somebody else did, and the resolver's own
 * refusal carried through.
 */
import { describe, expect, it } from 'vitest';

import { resolveOwnStatusTarget, resolveStatusTarget } from './targets';
import type { CommandContext } from './types';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import type { ApiSession } from '../api/session';
import { err, ok } from '../lib/result';
import { type AppState, initialAppState } from '../state/appState';
import { appReducer } from '../state/reducer';
import { fakeCommandContext } from '../test/commandContext';
import { status } from '../test/fixtures';
import { type WindowRef, windowId } from '../windows/model';

const ORIGIN = 'https://wired.example';

/** The signed-in account every acting test runs as. */
const LAIN: StoredAccount = {
  key: `${ORIGIN}#1`,
  origin: ORIGIN,
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
};

/** The session the resolver hands back for {@link LAIN}. */
const SESSION: ApiSession = { origin: ORIGIN, token: 'token' };

/** Lain's home window: the active window the resolver reads. */
const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

const ALPHA = status('a');

const BRAVO = status('b');

/** A boost by lain of BRAVO, for the unwrap. */
const BOOST = status('boost', { reblog: BRAVO });

/** The twelve wire fields of an account this client did not sign in as. */
const ALICE = {
  id: '2',
  username: 'alice',
  acct: 'alice@wired.example',
  display_name: 'Alice',
  created_at: '2026-11-01T00:00:00.000Z',
  note: '',
  url: 'https://wired.example/@alice',
  avatar: 'https://wired.example/avi.png',
  header: 'https://wired.example/banner.png',
  followers_count: 0,
  following_count: 0,
  statuses_count: 0,
};

/** A post alice wrote, and lain's boost of it, for the own-post resolver. */
const HERS = status('hers', { account: ALICE });

const HER_BOOST = status('her-boost', { reblog: HERS });

/**
 * The signed-in state with lain's home window open, showing {@link posts}
 * (API order, newest first) and {@link selectedId} selected when one is given.
 */
function homeState(posts: readonly Status[], selectedId: string | null): AppState {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN],
    activeKey: LAIN.key,
  });
  const opened = appReducer(signedIn, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: posts,
    where: 'newer',
  });
  if (selectedId === null) {
    return filled;
  }
  return appReducer(filled, { type: 'select', windowId: HOME_ID, key: `post:${selectedId}` });
}

/** A context whose active window shows {@link posts}, {@link selectedId} selected. */
function homeContext(
  posts: readonly Status[] = [BRAVO, ALPHA],
  selectedId: string | null = null,
): CommandContext {
  const state = homeState(posts, selectedId);
  return fakeCommandContext({ state, windows: state.windows });
}

describe(resolveStatusTarget, () => {
  it('resolves a label to the status it names and keeps what follows', () => {
    const result = resolveStatusTarget('a1 two words', homeContext());

    expect(result).toStrictEqual(
      ok({ status: BRAVO, rest: 'two words', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('reads the label in any case and with no rest', () => {
    const result = resolveStatusTarget('A0', homeContext());

    expect(result).toStrictEqual(
      ok({ status: ALPHA, rest: '', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('refuses a label this window never gave', () => {
    expect(resolveStatusTarget('z9 hi', homeContext())).toStrictEqual(err('No post z9 here'));
  });

  it('stands on the selection for a word that is no label, keeping all of args', () => {
    const context = homeContext([BRAVO, ALPHA], 'b');

    const result = resolveStatusTarget('hello a0 world', context);

    expect(result).toStrictEqual(
      ok({ status: BRAVO, rest: 'hello a0 world', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('takes the whole selection when no args are given', () => {
    const context = homeContext([BRAVO, ALPHA], 'a');

    expect(resolveStatusTarget('  ', context)).toStrictEqual(
      ok({ status: ALPHA, rest: '', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('refuses when nothing is selected to fall back to', () => {
    const context = homeContext();

    expect(resolveStatusTarget('', context)).toStrictEqual(
      err('Select a post first (j/k) or give a label'),
    );
    expect(resolveStatusTarget('plain text', context)).toStrictEqual(
      err('Select a post first (j/k) or give a label'),
    );
  });

  it('resolves a boost to the original status', () => {
    const result = resolveStatusTarget('a0', homeContext([BOOST]));

    expect(result).toStrictEqual(
      ok({ status: BRAVO, rest: '', accountKey: LAIN.key, session: SESSION }),
    );
  });

  it('refuses while nobody is signed in', () => {
    expect(resolveStatusTarget('a0', fakeCommandContext())).toStrictEqual(
      err('Not logged in. Type /connect'),
    );
  });
});

describe(resolveOwnStatusTarget, () => {
  it('hands the target over untouched when this account wrote the post', () => {
    const context = homeContext();

    expect(resolveOwnStatusTarget('a0', context, 'delete')).toStrictEqual(
      resolveStatusTarget('a0', context),
    );
  });

  it('refuses a post of somebody else in the wording of the verb', () => {
    const context = homeContext([HERS]);

    expect(resolveOwnStatusTarget('a0', context, 'edit')).toStrictEqual(
      err('You can only edit your own posts'),
    );
    expect(resolveOwnStatusTarget('a0', context, 'delete')).toStrictEqual(
      err('You can only delete your own posts'),
    );
  });

  it('refuses the original of a boost of somebody else post', () => {
    const context = homeContext([HER_BOOST]);

    expect(resolveOwnStatusTarget('a0', context, 'delete')).toStrictEqual(
      err('You can only delete your own posts'),
    );
  });

  it('keeps the resolver refusal when no post can be resolved', () => {
    expect(resolveOwnStatusTarget('z9', homeContext(), 'edit')).toStrictEqual(
      err('No post z9 here'),
    );
  });
});
