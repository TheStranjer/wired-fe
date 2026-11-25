/**
 * Tests for the account every post and notification line records (decision 14):
 * the producers stamp the key they are given, an unknown fetcher is null, and
 * the buffer reducer stamps the account of the window a page lands in — the
 * window's own, or the active account for the status window.
 */
import { describe, expect, it } from 'vitest';

import { coreReducer, initialAppState } from './appState';
import { EMPTY_BUFFER, type Buffer } from './buffer';
import { bufferReducer } from './bufferActions';
import { addNotifications, addNotificationsAs } from './bufferNotifications';
import { addStatuses, addStatusesAs } from './bufferPosts';
import type { StoredAccount } from '../accounts/accountStore';
import { notification, status } from '../test/fixtures';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';

const ACCOUNT: StoredAccount = {
  key: 'https://wired.example#1',
  origin: 'https://wired.example',
  accountId: '1',
  handle: 'lain@wired.example',
  token: 'token',
  refreshToken: null,
  expiresAt: null,
};

/** The account key every line of {@link buffer} records, in line order. */
function recorded(buffer: Buffer): (string | null | undefined)[] {
  return buffer.lines.map((line) => (line.kind === 'system' ? undefined : line.accountKey));
}

describe('the line producers', () => {
  it('stamp the given account on every post line', () => {
    const next = addStatusesAs('k')(EMPTY_BUFFER, [status('b'), status('a')], 'newer');

    expect(recorded(next)).toStrictEqual(['k', 'k']);
  });

  it('record an unknown account as null on post lines', () => {
    expect(recorded(addStatuses(EMPTY_BUFFER, [status('a')], 'newer'))).toStrictEqual([null]);
  });

  it('stamp the given account on every notification line', () => {
    const page = [notification('2', null), notification('1', status('a'))];

    const next = addNotificationsAs('k')(EMPTY_BUFFER, page, 'older');

    expect(recorded(next)).toStrictEqual(['k', 'k']);
  });

  it('record an unknown account as null on notification lines', () => {
    const next = addNotifications(EMPTY_BUFFER, [notification('1', null)], 'newer');

    expect(recorded(next)).toStrictEqual([null]);
  });
});

describe('a page in the buffer reducer', () => {
  const ref = { kind: 'home', accountKey: ACCOUNT.key, target: null } as const;
  const signedIn = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: ACCOUNT.key,
  });
  const state = coreReducer(signedIn, {
    type: 'windows',
    action: { type: 'open', ref, title: 'home' },
  });

  it('records the account of the window the statuses land in', () => {
    const next = bufferReducer(state, {
      type: 'statuses',
      windowId: windowId(ref),
      statuses: [status('a')],
      where: 'newer',
    });

    expect(recorded(next.buffers.get(windowId(ref)) ?? EMPTY_BUFFER)).toStrictEqual([ACCOUNT.key]);
  });

  it('records the active account for the status window, which has none of its own', () => {
    const next = bufferReducer(state, {
      type: 'statuses',
      windowId: STATUS_WINDOW_ID,
      statuses: [status('a')],
      where: 'newer',
    });

    expect(recorded(next.buffers.get(STATUS_WINDOW_ID) ?? EMPTY_BUFFER)).toStrictEqual([
      ACCOUNT.key,
    ]);
  });

  it('records the account of the window the notifications land in', () => {
    const next = bufferReducer(state, {
      type: 'notifications',
      windowId: windowId(ref),
      notifications: [notification('1', null)],
      where: 'newer',
    });

    expect(recorded(next.buffers.get(windowId(ref)) ?? EMPTY_BUFFER)).toStrictEqual([ACCOUNT.key]);
  });
});
