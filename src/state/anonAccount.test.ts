/**
 * Tests for the signed-out account key (WFE-340, decision 13): the one place
 * that knows `anon:<origin>`, the tokenless session it stands for, which
 * answers count as the instance refusing the read, and the rebinding of its
 * windows to an account that signs in on the same origin.
 */
import { describe, expect, it } from 'vitest';

import {
  anonKey,
  anonOrigin,
  anonSession,
  isAnonKey,
  isAnonWindow,
  isRefusedAnon,
  rebindAnon,
} from './anonAccount';
import { err, ok } from '../lib/result';
import { STATUS_WINDOW_ID, initialWindowsState, windowId } from '../windows/model';
import type { WindowRef, WindowsState } from '../windows/model';
import { windowsReducer } from '../windows/reducer';

const ORIGIN = 'https://wired.example';
const KEY = anonKey(ORIGIN);

/** The window list with a window of each of {@link refs} open. */
function opened(refs: readonly WindowRef[]): WindowsState {
  return refs.reduce(
    (state, ref) => windowsReducer(state, { type: 'open', ref, title: ref.kind }),
    initialWindowsState(),
  );
}

describe('the signed-out key', () => {
  it('is anon: and the origin, and gives the origin back', () => {
    expect(KEY).toBe('anon:https://wired.example');
    expect(anonOrigin(KEY)).toBe(ORIGIN);
    expect(isAnonKey(KEY)).toBe(true);
  });

  it('is not any other key, nor none', () => {
    expect(anonOrigin('https://wired.example|1')).toBeNull();
    expect(anonOrigin(null)).toBeNull();
    expect(isAnonKey('https://wired.example|1')).toBe(false);
    expect(isAnonKey(null)).toBe(false);
  });

  it('stands for a session with the origin and no token', () => {
    expect(anonSession(KEY)).toStrictEqual({ origin: ORIGIN, token: null });
    expect(anonSession('https://wired.example|1')).toBeNull();
    expect(anonSession(null)).toBeNull();
  });
});

describe(isRefusedAnon, () => {
  it('is true for a 401 and a 403', () => {
    expect(isRefusedAnon(err({ kind: 'http', status: 401, message: 'no' }))).toBe(true);
    expect(isRefusedAnon(err({ kind: 'http', status: 403, message: 'no' }))).toBe(true);
  });

  it('is false for any other status, any other error and a success', () => {
    expect(isRefusedAnon(err({ kind: 'http', status: 404, message: 'no' }))).toBe(false);
    expect(isRefusedAnon(err({ kind: 'network', message: 'down' }))).toBe(false);
    expect(isRefusedAnon(ok('fine'))).toBe(false);
  });
});

describe(isAnonWindow, () => {
  it('is true for a window under a signed-out key only', () => {
    const state = opened([
      { kind: 'thread', accountKey: KEY, target: '5' },
      { kind: 'thread', accountKey: 'https://wired.example|1', target: '5' },
    ]);
    const [status, anon, own] = state.windows;

    expect(status?.id).toBe(STATUS_WINDOW_ID);
    expect(anon === undefined ? null : isAnonWindow(anon)).toBe(true);
    expect(own === undefined ? null : isAnonWindow(own)).toBe(false);
  });
});

describe(rebindAnon, () => {
  const ANON_THREAD: WindowRef = { kind: 'thread', accountKey: KEY, target: '5' };
  const OTHER: WindowRef = {
    kind: 'thread',
    accountKey: anonKey('https://b.example'),
    target: '5',
  };

  it('points every signed-out window of the origin at the account, keeping ids and places', () => {
    const state = opened([ANON_THREAD, OTHER]);

    const rebound = rebindAnon(state, ORIGIN, 'https://wired.example|1');

    expect(rebound.windows.map((win) => win.id)).toStrictEqual(state.windows.map((win) => win.id));
    expect(rebound.windows.map((win) => win.ref.accountKey)).toStrictEqual([
      null,
      'https://wired.example|1',
      anonKey('https://b.example'),
    ]);
    expect(rebound.windows[1]?.id).toBe(windowId(ANON_THREAD));
  });

  it('is the same state when no window is signed out on that origin', () => {
    const state = opened([OTHER]);

    expect(rebindAnon(state, ORIGIN, 'https://wired.example|1')).toBe(state);
  });
});
