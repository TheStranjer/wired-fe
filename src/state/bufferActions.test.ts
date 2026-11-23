/**
 * Tests for the buffer reducer's pages: a batch of statuses joining the scrollback
 * of the window it names, oldest first and under that window's labels, and the
 * unread tally it leaves behind only when nobody was looking at that window. Which
 * arrivals are a highlight is next door in bufferActions.arrivals.test.ts, the
 * reader's own moves in bufferActions.moves.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, type CoreAction, coreReducer, initialAppState } from './appState';
import type { Buffer } from './buffer';
import { type BufferAction, bufferReducer } from './bufferActions';
import type { Where } from './bufferPosts';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { status } from '../test/fixtures';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';

const ORIGIN = 'https://wired.example';
const MY_KEY = `${ORIGIN}#acct-1`;

/** The account every window here belongs to. */
const ACCOUNT: StoredAccount = {
  key: MY_KEY,
  origin: ORIGIN,
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

const KINDS: readonly WindowKind[] = ['home', 'local'];

/** The view of {@link kind} on the account under test. */
function ref(kind: WindowKind): WindowRef {
  return { kind, accountKey: MY_KEY, target: null };
}

/** The id of the window showing {@link kind}. */
function viewId(kind: WindowKind): string {
  return windowId(ref(kind));
}

const HOME = viewId('home');
const LOCAL = viewId('local');

/** Window 1 and the two views, with {@link active} the window on screen. */
function opened(active: string): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: MY_KEY,
  });
  const shown = KINDS.reduce((state, kind) => coreReducer(state, openKind(kind)), signed);
  return coreReducer(shown, { type: 'windows', action: { type: 'activate', id: active } });
}

/** The action that opens the window showing {@link kind}. */
function openKind(kind: WindowKind): CoreAction {
  return { type: 'windows', action: { type: 'open', ref: ref(kind), title: kind } };
}

/** Nothing on screen but window 1, so every arrival is something a window missed. */
const OFFSCREEN = opened(STATUS_WINDOW_ID);

/** The home window on screen, so arrivals there are seen as they land. */
const ON_HOME = opened(HOME);

/** A page of statuses in API order, newest first, for the window {@link at}. */
function statusPage(at: string, shown: readonly Status[], where: Where = 'newer'): BufferAction {
  return { type: 'statuses', windowId: at, statuses: shown, where };
}

/** The unread tally of the window {@link state} lists under {@link id}. */
function tally(state: AppState, id: string): number {
  const win = state.windows.windows.find((candidate) => candidate.id === id);
  if (win === undefined) {
    throw new Error(`no window ${id}`);
  }
  return win.unread;
}

/** The scrollback of {@link id}. */
function bufferOf(state: AppState, id: string): Buffer {
  const buffer = state.buffers.get(id);
  if (buffer === undefined) {
    throw new Error(`no buffer for ${id}`);
  }
  return buffer;
}

/** The line keys of {@link id}'s scrollback, oldest first. */
function keysOf(state: AppState, id: string): string[] {
  return bufferOf(state, id).lines.map((line) => line.key);
}

describe('a page of statuses', () => {
  it('joins the scrollback of the window it names, oldest first, under its labels', () => {
    const next = bufferReducer(OFFSCREEN, statusPage(HOME, [status('b'), status('a')]));

    expect(keysOf(next, HOME)).toStrictEqual(['post:a', 'post:b']);
    expect(bufferOf(next, HOME).labels.byId.get('a')).toBe('a0');
    expect(bufferOf(next, LOCAL).lines).toStrictEqual([]);
  });

  it('counts what an off-screen window has not seen', () => {
    const next = bufferReducer(OFFSCREEN, statusPage(HOME, [status('b'), status('a')]));

    expect(tally(next, HOME)).toBe(2);
    expect(tally(next, LOCAL)).toBe(0);
    expect(next.windows.windows.find((win) => win.id === HOME)?.highlight).toBe(false);
  });

  it('counts nothing for the window on screen, which is seeing it arrive', () => {
    const next = bufferReducer(ON_HOME, statusPage(HOME, [status('a')]));

    expect(keysOf(next, HOME)).toStrictEqual(['post:a']);
    expect(next.windows).toBe(ON_HOME.windows);
  });

  it('counts only the lines that really joined', () => {
    const seeded = bufferReducer(OFFSCREEN, statusPage(HOME, [status('a')]));

    const next = bufferReducer(seeded, statusPage(HOME, [status('c'), status('a'), status('c')]));

    expect(keysOf(next, HOME)).toStrictEqual(['post:a', 'post:c']);
    expect(tally(next, HOME)).toBe(2);
  });

  it('changes nothing when the whole page is already shown', () => {
    const seeded = bufferReducer(OFFSCREEN, statusPage(HOME, [status('a')]));

    expect(bufferReducer(seeded, statusPage(HOME, [status('a')]))).toBe(seeded);
    expect(bufferReducer(OFFSCREEN, statusPage(HOME, []))).toBe(OFFSCREEN);
  });

  it('counts nothing for older history, which the window is paging into', () => {
    const next = bufferReducer(OFFSCREEN, statusPage(HOME, [status('o1')], 'older'));

    expect(keysOf(next, HOME)).toStrictEqual(['post:o1']);
    expect(tally(next, HOME)).toBe(0);
  });

  it('leaves the other windows on screen alone while it marks one', () => {
    const away = opened(LOCAL);

    const next = bufferReducer(away, statusPage(HOME, [status('a')]));

    expect(tally(next, LOCAL)).toBe(0);
    expect(away.windows.activeId).toBe(LOCAL);
    expect(tally(next, HOME)).toBe(1);
  });

  it('changes nothing for a window that is not open', () => {
    expect(bufferReducer(ON_HOME, statusPage('nope:nope:nope', [status('a')]))).toBe(ON_HOME);
  });
});

describe('the buffer reducer', () => {
  it('never mutates the state it is given', () => {
    const before = structuredClone(OFFSCREEN);
    const actions: readonly BufferAction[] = [
      statusPage(HOME, [status('a')]),
      {
        type: 'notifications',
        windowId: HOME,
        notifications: [],
        where: 'newer',
      },
      { type: 'statusUpdated', status: status('a', { visibility: 'private' }) },
      { type: 'statusDeleted', id: 'a' },
      { type: 'select', windowId: HOME, key: 'post:a' },
      { type: 'selectRelative', windowId: HOME, delta: 1 },
      { type: 'selectEdge', windowId: HOME, edge: 'last' },
      { type: 'toggleReveal', windowId: HOME, key: 'post:a' },
      { type: 'load', windowId: HOME, load: 'loading' },
      { type: 'requestOlder', windowId: HOME },
    ];

    for (const action of actions) {
      bufferReducer(OFFSCREEN, action);
    }

    expect(OFFSCREEN).toStrictEqual(before);
  });
});
