/**
 * Tests for the two buffer actions that name no window: an edited status that
 * every scrollback showing it has to redraw, and a deleted one that every
 * scrollback showing it has to lose, selection and all.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer, initialAppState } from './appState';
import { type Buffer, EMPTY_BUFFER } from './buffer';
import { bufferReducer } from './bufferActions';
import type { StoredAccount } from '../accounts/accountStore';
import type { Status } from '../api/schemas/status';
import { notification, status } from '../test/fixtures';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const MY_KEY = 'https://wired.example#acct-1';

/** The account all three windows belong to. */
const ACCOUNT: StoredAccount = {
  key: MY_KEY,
  origin: 'https://wired.example',
  accountId: 'acct-1',
  handle: 'lain@wired.example',
  token: 'never-logged',
  refreshToken: null,
  expiresAt: null,
};

const HOME: WindowRef = { kind: 'home', accountKey: MY_KEY, target: null };
const LOCAL: WindowRef = { kind: 'local', accountKey: MY_KEY, target: null };
const NOTES: WindowRef = { kind: 'notifications', accountKey: MY_KEY, target: null };
const HOME_ID = windowId(HOME);
const LOCAL_ID = windowId(LOCAL);
const NOTES_ID = windowId(NOTES);

/** The scrollback of {@link id}. */
function bufferOf(state: AppState, id: string): Buffer {
  const buffer = state.buffers.get(id);
  if (buffer === undefined) {
    throw new Error(`no buffer for ${id}`);
  }
  return buffer;
}

/** Window 1 and the three views, none of them on screen. */
function offscreen(): AppState {
  const signed = coreReducer(initialAppState(), {
    type: 'accounts',
    accounts: [ACCOUNT],
    activeKey: MY_KEY,
  });
  const shown = [HOME, LOCAL, NOTES].reduce(
    (state, view) =>
      coreReducer(state, {
        type: 'windows',
        action: { type: 'open', ref: view, title: view.kind },
      }),
    signed,
  );
  return coreReducer(shown, {
    type: 'windows',
    action: { type: 'activate', id: STATUS_WINDOW_ID },
  });
}

/** A page of {@link shown} joining the window {@link at}, oldest first. */
function statuses(at: string, shown: readonly Status[]) {
  return { type: 'statuses', windowId: at, statuses: shown, where: 'newer' } as const;
}

/** The line keys of {@link id}'s scrollback, oldest first. */
function keysOf(state: AppState, id: string): string[] {
  return bufferOf(state, id).lines.map((line) => line.key);
}

/** The status of the post line at {@link at} in {@link id}'s scrollback. */
function postAt(state: AppState, id: string, at: number): Status {
  const line = bufferOf(state, id).lines[at];
  if (line?.kind !== 'post') {
    throw new RangeError(`no post line at ${String(at)} of ${id}`);
  }
  return line.status;
}

/** Home and local each showing status `a`, notifications a mention of it, home on it. */
function showingA(): AppState {
  const withNotes = bufferReducer(offscreen(), {
    type: 'notifications',
    windowId: NOTES_ID,
    notifications: [notification('n1', status('a'))],
    where: 'newer',
  });
  const withPosts = bufferReducer(
    bufferReducer(withNotes, statuses(HOME_ID, [status('a')])),
    statuses(LOCAL_ID, [status('a')]),
  );
  return {
    ...withPosts,
    buffers: new Map(withPosts.buffers).set(HOME_ID, {
      ...bufferOf(withPosts, HOME_ID),
      selectedKey: 'post:a',
    }),
  };
}

describe('a status that changed', () => {
  it('redraws every scrollback that shows it', () => {
    const edited = status('a', { content: '<p>edited</p>' });

    const next = bufferReducer(showingA(), { type: 'statusUpdated', status: edited });

    expect(postAt(next, HOME_ID, 0).content).toBe('<p>edited</p>');
    expect(postAt(next, LOCAL_ID, 0).content).toBe('<p>edited</p>');
  });

  it('keeps a boost boosting the status, now the new one', () => {
    const boosted = bufferReducer(
      offscreen(),
      statuses(HOME_ID, [status('wrap', { reblog: status('a') })]),
    );

    const next = bufferReducer(boosted, {
      type: 'statusUpdated',
      status: status('a', { content: '<p>edited</p>' }),
    });

    expect(postAt(next, HOME_ID, 0).reblog?.content).toBe('<p>edited</p>');
  });

  it('leaves the scrollbacks that do not show it as they were', () => {
    const shown = showingA();

    const next = bufferReducer(shown, {
      type: 'statusUpdated',
      status: status('a', { content: '<p>x</p>' }),
    });

    expect(bufferOf(next, NOTES_ID)).toBe(bufferOf(shown, NOTES_ID));
    expect(bufferOf(next, STATUS_WINDOW_ID)).toBe(EMPTY_BUFFER);
  });

  it('changes nothing when no window shows the status', () => {
    const shown = showingA();

    expect(bufferReducer(shown, { type: 'statusUpdated', status: status('gone') })).toBe(shown);
  });
});

describe('a status that was deleted', () => {
  it('comes off the scrollback of every window that showed it', () => {
    const next = bufferReducer(showingA(), { type: 'statusDeleted', id: 'a' });

    expect(keysOf(next, HOME_ID)).toStrictEqual([]);
    expect(keysOf(next, LOCAL_ID)).toStrictEqual([]);
  });

  it('takes a boost of it off too', () => {
    const boosted = bufferReducer(
      offscreen(),
      statuses(HOME_ID, [status('wrap', { reblog: status('a') })]),
    );

    const next = bufferReducer(boosted, { type: 'statusDeleted', id: 'a' });

    expect(keysOf(next, HOME_ID)).toStrictEqual([]);
  });

  it('clears a selection standing on a line that goes', () => {
    const next = bufferReducer(showingA(), { type: 'statusDeleted', id: 'a' });

    expect(bufferOf(next, HOME_ID).selectedKey).toBeNull();
  });

  it('leaves a notification line to its own removal', () => {
    const next = bufferReducer(showingA(), { type: 'statusDeleted', id: 'a' });

    expect(keysOf(next, NOTES_ID)).toStrictEqual(['notif:n1']);
  });

  it('changes nothing when no window shows the status', () => {
    const shown = showingA();

    expect(bufferReducer(shown, { type: 'statusDeleted', id: 'gone' })).toBe(shown);
  });
});
