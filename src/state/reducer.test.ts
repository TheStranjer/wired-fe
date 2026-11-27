/**
 * Tests for the app's one reducer: every action the state understands goes in at
 * this door and out through the half that owns it — the window list, the accounts
 * and the settings in ./appState, the scrollbacks in ./bufferActions. Handing an
 * action to the wrong reducer answers with nothing at all, so each type is
 * compared against its own reducer's word and asked to have moved the state; the
 * last pair of tests puts both halves to work on one state.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, type CoreAction, coreReducer, initialAppState } from './appState';
import { type BufferAction, bufferReducer } from './bufferActions';
import { type AppAction, appReducer } from './reducer';
import type { StoredAccount } from '../accounts/accountStore';
import {
  type Capabilities,
  DEFAULT_POLL_LIMITS,
  NO_ANONYMOUS_READS,
} from '../capabilities/capabilities';
import type { InstanceProfile } from '../capabilities/detect';
import { notification, status } from '../test/fixtures';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowRef, WindowState } from '../windows/model';

const ORIGIN = 'https://wired.example';
const MY_KEY = `${ORIGIN}#acct-1`;

const HOME: WindowRef = { kind: 'home', accountKey: MY_KEY, target: null };
const HOME_ID = windowId(HOME);
const THREAD: WindowRef = { kind: 'thread', accountKey: MY_KEY, target: 'a1' };

/** The moment the printed line in these tests carries. */
const DATE = new Date('2026-11-14T21:04:00Z');

/** The account the state is told about. */
const ACCOUNT: StoredAccount = {
  key: MY_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

/** The capabilities of an instance these tests name without detecting it. */
const CAPABILITIES: Capabilities = {
  backend: 'wired',
  maxCharacters: 500,
  maxMediaAttachments: 4,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set(),
  anonymousReads: NO_ANONYMOUS_READS,
};

/** What the instance under test turned out to be. */
const PROFILE: InstanceProfile = { origin: ORIGIN, title: 'Wired', capabilities: CAPABILITIES };

/** The action that opens the window showing {@link view}. */
function open(view: WindowRef): CoreAction {
  return { type: 'windows', action: { type: 'open', ref: view, title: view.kind } };
}

/** A state showing a home window with one post in its scrollback. */
function seeded(): AppState {
  const opened = coreReducer(initialAppState(), open(HOME));
  return bufferReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: [status('seen')],
    where: 'newer',
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

/** One action per core type, each a move the seeded state has not already made. */
const CORE_CASES: readonly CoreAction[] = [
  open(THREAD),
  { type: 'print', windowId: HOME_ID, date: DATE, level: 'info', text: '/win 2 ok' },
  { type: 'clear', windowId: HOME_ID },
  { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
  { type: 'profile', profile: PROFILE },
  { type: 'mode', mode: 'navigation' },
  { type: 'settings', settings: { effects: true } },
];

/** One action per buffer type, each a move the seeded state has not already made. */
const BUFFER_CASES: readonly BufferAction[] = [
  { type: 'statuses', windowId: HOME_ID, statuses: [status('fresh')], where: 'newer' },
  {
    type: 'notifications',
    windowId: HOME_ID,
    notifications: [notification('n1', null)],
    where: 'older',
  },
  { type: 'statusUpdated', status: status('seen', { content: '<p>x</p>' }) },
  { type: 'statusDeleted', id: 'seen' },
  { type: 'select', windowId: HOME_ID, key: 'post:seen' },
  { type: 'selectRelative', windowId: HOME_ID, delta: 1 },
  { type: 'selectEdge', windowId: HOME_ID, edge: 'last' },
  { type: 'toggleReveal', windowId: HOME_ID, key: 'post:seen' },
  { type: 'load', windowId: HOME_ID, load: 'loading' },
  { type: 'requestOlder', windowId: HOME_ID },
];

describe(appReducer, () => {
  it.each(CORE_CASES)('routes the $type action to the core reducer', (action) => {
    const state = seeded();

    const next = appReducer(state, action);

    expect(next).not.toBe(state);
    expect(next).toStrictEqual(coreReducer(state, action));
  });

  it.each(BUFFER_CASES)('routes the $type action to the buffer reducer', (action) => {
    const state = seeded();

    const next = appReducer(state, action);

    expect(next).not.toBe(state);
    expect(next).toStrictEqual(bufferReducer(state, action));
  });

  it('changes nothing when the action changes nothing', () => {
    const state = seeded();
    const action: AppAction = { type: 'mode', mode: 'insert' };

    expect(appReducer(state, action)).toBe(state);
  });
});

describe('both halves on one state', () => {
  it('lets a window miss a page and acknowledge it once it is on screen', () => {
    const away = coreReducer(coreReducer(seeded(), open(THREAD)), {
      type: 'windows',
      action: { type: 'activate', id: STATUS_WINDOW_ID },
    });

    const arrived = appReducer(away, {
      type: 'statuses',
      windowId: HOME_ID,
      statuses: [status('while-away')],
      where: 'newer',
    });
    const read = appReducer(arrived, {
      type: 'windows',
      action: { type: 'activate', id: HOME_ID },
    });

    expect(windowOf(arrived, HOME_ID).unread).toBe(1);
    expect(windowOf(read, HOME_ID).unread).toBe(0);
    expect(read.mode).toBe('insert');
  });
});
