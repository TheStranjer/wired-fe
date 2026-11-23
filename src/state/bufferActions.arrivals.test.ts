/**
 * Tests for which arrivals are worth a highlight: a post that mentions the
 * window's own account, a post aimed at it alone, and a notification that
 * announces somebody mentioned it. Everything else a window missed is still
 * counted, but stays plain.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer, initialAppState } from './appState';
import { bufferReducer } from './bufferActions';
import type { StoredAccount } from '../accounts/accountStore';
import type { Mention } from '../api/schemas/mention';
import { NotificationSchema, type Notification } from '../api/schemas/notification';
import type { Status } from '../api/schemas/status';
import { notification, status, TEST_DATE } from '../test/fixtures';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowKind, WindowRef, WindowState } from '../windows/model';

const ORIGIN = 'https://wired.example';
const MY_ID = 'acct-1';
const MY_KEY = `${ORIGIN}#${MY_ID}`;

/** The account every window here belongs to. */
const ACCOUNT: StoredAccount = {
  key: MY_KEY,
  origin: ORIGIN,
  accountId: MY_ID,
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The view of {@link kind} on the account under test. */
function ref(kind: WindowKind): WindowRef {
  return { kind, accountKey: MY_KEY, target: null };
}

const HOME = windowId(ref('home'));
const NOTIFICATIONS = windowId(ref('notifications'));

/** The two views these tests open. */
const VIEWS: readonly WindowRef[] = [ref('home'), ref('notifications')];

/** Window 1 and the two views, with {@link active} the window on screen. */
function opened(active: string): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: MY_KEY,
  });
  const shown = VIEWS.reduce(
    (state, view) =>
      coreReducer(state, {
        type: 'windows',
        action: { type: 'open', ref: view, title: view.kind },
      }),
    signed,
  );
  return coreReducer(shown, { type: 'windows', action: { type: 'activate', id: active } });
}

/** Nothing on screen but window 1. */
const OFFSCREEN = opened(STATUS_WINDOW_ID);

/** A page of statuses in API order, newest first, for the window {@link at}. */
function statusPage(at: string, shown: readonly Status[]) {
  return { type: 'statuses', windowId: at, statuses: shown, where: 'newer' } as const;
}

/** A page of notifications in API order, newest first, for the window {@link at}. */
function notifPage(at: string, shown: readonly Notification[]) {
  return { type: 'notifications', windowId: at, notifications: shown, where: 'newer' } as const;
}

/** An @-mention as the backend resolves it. */
function mentionOf(id: string): Mention {
  return { id, username: 'ally', acct: 'ally@wired.example', url: `${ORIGIN}/@ally` };
}

/** A notification on the wire, so its kind is chosen rather than inferred. */
function notice(id: string, type: string, shown: Status | null): Notification {
  return v.parse(NotificationSchema, {
    id,
    type,
    created_at: TEST_DATE,
    account: status('author').account,
    status: shown,
  });
}

/** The window {@link state} lists under {@link id}. */
function windowOf(state: AppState, id: string): WindowState {
  const win = state.windows.windows.find((candidate) => candidate.id === id);
  if (win === undefined) {
    throw new Error(`no window ${id}`);
  }
  return win;
}

describe('a highlighted arrival', () => {
  it('highlights the window for a post that mentions its own account', () => {
    const next = bufferReducer(
      OFFSCREEN,
      statusPage(HOME, [status('x', { mentions: [mentionOf(MY_ID)] })]),
    );

    expect(windowOf(next, HOME)).toStrictEqual({
      ...windowOf(OFFSCREEN, HOME),
      unread: 1,
      highlight: true,
    });
  });

  it('highlights the window for a post aimed at it alone', () => {
    const next = bufferReducer(
      OFFSCREEN,
      statusPage(HOME, [status('d', { visibility: 'direct' })]),
    );

    expect(windowOf(next, HOME).highlight).toBe(true);
  });

  it('does not highlight for a mention of somebody else', () => {
    const next = bufferReducer(
      OFFSCREEN,
      statusPage(HOME, [status('x', { mentions: [mentionOf('acct-other')] })]),
    );

    expect(windowOf(next, HOME)).toStrictEqual({
      ...windowOf(OFFSCREEN, HOME),
      unread: 1,
    });
  });

  it('highlights a direct message even in a window no account owns', () => {
    const away = opened(HOME);

    const next = bufferReducer(
      away,
      statusPage(STATUS_WINDOW_ID, [status('d', { visibility: 'direct' })]),
    );

    expect(windowOf(next, STATUS_WINDOW_ID)).toStrictEqual({
      ...windowOf(away, STATUS_WINDOW_ID),
      unread: 1,
      highlight: true,
    });
  });

  it('highlights once and stays highlighted across the pages that follow', () => {
    const first = bufferReducer(
      OFFSCREEN,
      statusPage(HOME, [status('d', { visibility: 'direct' })]),
    );

    const next = bufferReducer(first, statusPage(HOME, [status('p')]));

    expect(windowOf(next, HOME)).toStrictEqual({
      ...windowOf(OFFSCREEN, HOME),
      unread: 2,
      highlight: true,
    });
  });
});

describe('a page of notifications', () => {
  it('joins its window and counts for an off-screen one', () => {
    const next = bufferReducer(
      OFFSCREEN,
      notifPage(NOTIFICATIONS, [notification('n2', null), notification('n1', null)]),
    );

    expect(windowOf(next, NOTIFICATIONS)).toStrictEqual({
      ...windowOf(OFFSCREEN, NOTIFICATIONS),
      unread: 2,
    });
  });

  it('highlights the window for a mention', () => {
    const next = bufferReducer(
      OFFSCREEN,
      notifPage(NOTIFICATIONS, [notification('n1', status('s'))]),
    );

    expect(windowOf(next, NOTIFICATIONS).highlight).toBe(true);
  });

  it('highlights the window for a DM a notification carries under another kind', () => {
    const next = bufferReducer(
      OFFSCREEN,
      notifPage(NOTIFICATIONS, [notice('n1', 'favourite', status('s', { visibility: 'direct' }))]),
    );

    expect(windowOf(next, NOTIFICATIONS).highlight).toBe(true);
  });

  it('does not highlight a status-less follow', () => {
    const next = bufferReducer(OFFSCREEN, notifPage(NOTIFICATIONS, [notice('n1', 'follow', null)]));

    expect(windowOf(next, NOTIFICATIONS)).toStrictEqual({
      ...windowOf(OFFSCREEN, NOTIFICATIONS),
      unread: 1,
    });
  });

  it('counts only what joined, and nothing for the window on screen', () => {
    const seeded = bufferReducer(OFFSCREEN, notifPage(NOTIFICATIONS, [notification('n1', null)]));

    const repeat = bufferReducer(seeded, notifPage(NOTIFICATIONS, [notification('n1', null)]));
    const watching = bufferReducer(
      opened(NOTIFICATIONS),
      notifPage(NOTIFICATIONS, [notification('n9', null)]),
    );

    expect(repeat).toBe(seeded);
    expect(windowOf(watching, NOTIFICATIONS).unread).toBe(0);
  });

  it('changes nothing for a window that is not open', () => {
    const next = bufferReducer(
      OFFSCREEN,
      notifPage('nope:nope:nope', [notification('n1', status('s'))]),
    );

    expect(next).toBe(OFFSCREEN);
  });
});
