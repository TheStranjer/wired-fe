/**
 * Tests for the target resolvers in a signed-out window (WFE-340): the one
 * place commands resolve the account of a line refuses an `act` there with
 * the sign-in message, resolves a `read` through the tokenless session of the
 * window's origin, and, once an account has taken the window over, acts as
 * that account rather than as the signed-out key a line was fetched under.
 */
import { describe, expect, it } from 'vitest';

import { resolveAccountTarget, resolveStatusTarget } from './targets';
import { anonKey } from '../state/anonAccount';
import { type AppState, initialAppState } from '../state/appState';
import { EMPTY_BUFFER } from '../state/buffer';
import { appReducer } from '../state/reducer';
import { ANON_ORIGIN, anonContext } from '../test/anonWindow';
import { fakeCommandContext } from '../test/commandContext';
import { status } from '../test/fixtures';
import { LAIN } from '../test/hashRoute';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const SIGN_IN = 'Sign in to do that: this window is read-only. Type /connect to log in.';

describe('resolveStatusTarget in a signed-out window', () => {
  it('refuses to act', () => {
    const target = resolveStatusTarget('a0', anonContext([status('p')]));

    expect(target).toStrictEqual({ ok: false, error: SIGN_IN });
  });

  it('refuses to act on the selection too', () => {
    const target = resolveStatusTarget('', anonContext([status('p')], 'p'));

    expect(target).toStrictEqual({ ok: false, error: SIGN_IN });
  });

  it('resolves a read through the tokenless session of the window’s origin', () => {
    const target = resolveStatusTarget('a0', anonContext([status('p')]), 'read');

    expect(target).toMatchObject({
      ok: true,
      value: {
        accountKey: anonKey(ANON_ORIGIN),
        session: { origin: ANON_ORIGIN, token: null },
      },
    });
  });
});

describe('resolveAccountTarget in a signed-out window', () => {
  it('refuses to act, by label and by handle', async () => {
    const context = anonContext([status('p')]);

    await expect(resolveAccountTarget('a0', context)).resolves.toStrictEqual({
      ok: false,
      error: SIGN_IN,
    });
    await expect(resolveAccountTarget('@a@b.example', context)).resolves.toStrictEqual({
      ok: false,
      error: SIGN_IN,
    });
  });

  it('resolves a read of the author of a label', async () => {
    const target = await resolveAccountTarget('a0', anonContext([status('p')]), 'read');

    expect(target).toMatchObject({ ok: true, value: { session: { token: null } } });
  });
});

describe('a line fetched signed out in a window an account has taken over', () => {
  const HOME: WindowRef = { kind: 'thread', accountKey: LAIN.key, target: 'p' };
  const HOME_ID = windowId(HOME);

  /** Lain’s thread window holding a post whose line still records the signed-out key. */
  function rebound(): AppState {
    const signedIn = appReducer(initialAppState(), {
      type: 'accounts',
      accounts: [LAIN],
      activeKey: LAIN.key,
    });
    const opened = appReducer(signedIn, {
      type: 'windows',
      action: { type: 'open', ref: HOME, title: 'thread/p' },
    });
    const filled = appReducer(opened, {
      type: 'statuses',
      windowId: HOME_ID,
      statuses: [status('p')],
      where: 'newer',
    });
    const buffer = filled.buffers.get(HOME_ID) ?? EMPTY_BUFFER;
    const lines = buffer.lines.map((line) =>
      line.kind === 'post' ? { ...line, accountKey: anonKey(LAIN.origin) } : line,
    );
    return { ...filled, buffers: new Map(filled.buffers).set(HOME_ID, { ...buffer, lines }) };
  }

  it('acts as the window’s account, not as the signed-out key', () => {
    const state = rebound();
    const context = fakeCommandContext({ state, windows: state.windows });

    const target = resolveStatusTarget('a0', context);

    expect(target).toMatchObject({
      ok: true,
      value: { accountKey: LAIN.key, session: { token: LAIN.token } },
    });
  });
});
