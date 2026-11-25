/**
 * Tests for which account a command on a line acts as (decision 14): the one
 * that fetched the line, with its own origin and token, when it is still
 * signed in; the window's account when the line records none or records one
 * no longer in the store.
 */
import { describe, expect, it } from 'vitest';

import { resolveAccountTarget, resolveOwnStatusTarget, resolveStatusTarget } from './targets';
import type { StoredAccount } from '../accounts/accountStore';
import { type AppState, initialAppState } from '../state/appState';
import { EMPTY_BUFFER, type LineData } from '../state/buffer';
import { appReducer } from '../state/reducer';
import { fakeCommandContext } from '../test/commandContext';
import { status } from '../test/fixtures';
import { type WindowRef, windowId } from '../windows/model';

/** The account the window acts as. */
const LAIN: StoredAccount = {
  key: 'https://wired.example#1',
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'lain-token',
  refreshToken: null,
  expiresAt: null,
};

/** A second account, on another instance, that fetched some of the lines. */
const EIRI: StoredAccount = {
  key: 'https://other.example#9',
  origin: 'https://other.example',
  accountId: '9',
  handle: 'eiri@other.example',
  token: 'eiri-token',
  refreshToken: null,
  expiresAt: null,
};

const HOME: WindowRef = { kind: 'home', accountKey: LAIN.key, target: null };

const HOME_ID = windowId(HOME);

/** The one post on the line: written by Eiri's account. */
const POST = status('a', { account: { ...status('x').account, id: EIRI.accountId } });

/** Lain's window holding one post, `a0`, whose line records {@link lineKey}. */
function context(lineKey: string | null, selected = false): ReturnType<typeof fakeCommandContext> {
  const signedIn = appReducer(initialAppState(), {
    type: 'accounts',
    accounts: [LAIN, EIRI],
    activeKey: LAIN.key,
  });
  const opened = appReducer(signedIn, {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const filled = appReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: [POST],
    where: 'newer',
  });
  const state = recorded(filled, lineKey);
  const chosen = selected
    ? appReducer(state, { type: 'select', windowId: HOME_ID, key: 'post:a' })
    : state;
  return fakeCommandContext({ state: chosen, windows: chosen.windows });
}

/** {@link state} with every line of the home window recording {@link accountKey}. */
function recorded(state: AppState, accountKey: string | null): AppState {
  const buffer = state.buffers.get(HOME_ID) ?? EMPTY_BUFFER;
  const lines: readonly LineData[] = [{ kind: 'post', key: 'post:a', status: POST, accountKey }];
  return { ...state, buffers: new Map(state.buffers).set(HOME_ID, { ...buffer, lines }) };
}

describe('commands on a line', () => {
  it('act as the account that fetched a labelled line, with its origin and token', () => {
    const result = resolveStatusTarget('a0', context(EIRI.key));

    expect(result).toMatchObject({
      ok: true,
      value: {
        accountKey: EIRI.key,
        session: { origin: EIRI.origin, token: EIRI.token },
      },
    });
  });

  it('act as the account that fetched the selected line', () => {
    const result = resolveStatusTarget('', context(EIRI.key, true));

    expect(result).toMatchObject({ ok: true, value: { accountKey: EIRI.key } });
  });

  it('act as the window account when the line records none', () => {
    const result = resolveStatusTarget('a0', context(null));

    expect(result).toMatchObject({
      ok: true,
      value: { accountKey: LAIN.key, session: { origin: LAIN.origin, token: LAIN.token } },
    });
  });

  it('act as the window account when the recorded one is no longer signed in', () => {
    const result = resolveStatusTarget('a0', context('https://gone.example#3'));

    expect(result).toMatchObject({ ok: true, value: { accountKey: LAIN.key } });
  });

  it('name an account as the line account on a label', async () => {
    const result = await resolveAccountTarget('a0', context(EIRI.key));

    expect(result).toMatchObject({
      ok: true,
      value: { accountKey: EIRI.key, session: { token: EIRI.token } },
    });
  });

  it('judge authorship by the line account', () => {
    const own = resolveOwnStatusTarget('a0', context(EIRI.key), 'delete');
    const notOwn = resolveOwnStatusTarget('a0', context(LAIN.key), 'delete');

    expect(own.ok).toBe(true);
    expect(notOwn).toStrictEqual({ ok: false, error: 'You can only delete your own posts' });
  });
});
