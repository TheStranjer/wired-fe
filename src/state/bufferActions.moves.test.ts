/**
 * Tests for the reader's own moves in the buffer reducer: the selection the
 * navigation mode walks and the content warnings standing open. Each move belongs
 * to one window, so each one also has to leave the state alone when the window it
 * names is not open. The load state and the asks for older history are next door
 * in bufferActions.paging.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, type CoreAction, coreReducer, initialAppState } from './appState';
import type { Buffer } from './buffer';
import { bufferReducer } from './bufferActions';
import { status } from '../test/fixtures';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const HOME: WindowRef = {
  kind: 'home',
  accountKey: 'https://wired.example#acct-1',
  target: null,
};
const HOME_ID = windowId(HOME);
const NOWHERE = 'nope:nope:nope';

/** The moment the printed line in these tests carries. */
const DATE = new Date('2026-11-14T21:04:00Z');

/** A home window showing two posts, oldest first, and a client message below them. */
function seeded(): AppState {
  const opened = coreReducer(initialAppState(), {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
  const withPosts = bufferReducer(opened, {
    type: 'statuses',
    windowId: HOME_ID,
    statuses: [status('b'), status('a')],
    where: 'newer',
  });
  return coreReducer(withPosts, print('win 2 ok'));
}

/** The action that prints one client message into the home window. */
function print(text: string): CoreAction {
  return { type: 'print', windowId: HOME_ID, date: DATE, level: 'info', text };
}

/** The home scrollback. */
function home(state: AppState): Buffer {
  const buffer = state.buffers.get(HOME_ID);
  if (buffer === undefined) {
    throw new Error(`no buffer for ${HOME_ID}`);
  }
  return buffer;
}

describe('the selection', () => {
  it('stands on the line a move names, and on nothing for null', () => {
    const state = seeded();

    const onB = bufferReducer(state, { type: 'select', windowId: HOME_ID, key: 'post:b' });
    const off = bufferReducer(onB, { type: 'select', windowId: HOME_ID, key: null });

    expect(home(onB).selectedKey).toBe('post:b');
    expect(home(off).selectedKey).toBeNull();
  });

  it('refuses a client message, which carries no post to act on', () => {
    const state = seeded();

    expect(bufferReducer(state, { type: 'select', windowId: HOME_ID, key: 'sys:0' }).windows).toBe(
      state.windows,
    );
    expect(bufferReducer(state, { type: 'select', windowId: HOME_ID, key: 'nope' })).toBe(state);
  });

  it('walks the post lines by a delta and holds at both ends', () => {
    const selected = bufferReducer(seeded(), {
      type: 'select',
      windowId: HOME_ID,
      key: 'post:a',
    });

    const down = bufferReducer(selected, { type: 'selectRelative', windowId: HOME_ID, delta: 1 });
    const past = bufferReducer(down, { type: 'selectRelative', windowId: HOME_ID, delta: 4 });
    const up = bufferReducer(past, { type: 'selectRelative', windowId: HOME_ID, delta: -9 });

    expect(home(down).selectedKey).toBe('post:b');
    expect(home(past).selectedKey).toBe('post:b');
    expect(home(up).selectedKey).toBe('post:a');
  });

  it('takes the newest post line while nothing is selected', () => {
    const next = bufferReducer(seeded(), { type: 'selectRelative', windowId: HOME_ID, delta: -1 });

    expect(home(next).selectedKey).toBe('post:b');
  });

  it('jumps to the oldest or the newest post line', () => {
    const state = seeded();

    const first = bufferReducer(state, { type: 'selectEdge', windowId: HOME_ID, edge: 'first' });
    const last = bufferReducer(state, { type: 'selectEdge', windowId: HOME_ID, edge: 'last' });

    expect(home(first).selectedKey).toBe('post:a');
    expect(home(last).selectedKey).toBe('post:b');
  });

  it('changes nothing for a window that is not open', () => {
    const state = seeded();

    expect(bufferReducer(state, { type: 'select', windowId: NOWHERE, key: 'post:a' })).toBe(state);
    expect(bufferReducer(state, { type: 'selectRelative', windowId: NOWHERE, delta: 1 })).toBe(
      state,
    );
    expect(bufferReducer(state, { type: 'selectEdge', windowId: NOWHERE, edge: 'first' })).toBe(
      state,
    );
  });
});

describe('content warnings', () => {
  it('open a warning on the line named and close it again', () => {
    const state = seeded();

    const open = bufferReducer(state, { type: 'toggleReveal', windowId: HOME_ID, key: 'post:a' });
    const closed = bufferReducer(open, { type: 'toggleReveal', windowId: HOME_ID, key: 'post:a' });

    expect([...home(open).revealed]).toStrictEqual(['post:a']);
    expect([...home(closed).revealed]).toStrictEqual([]);
    expect(home(open).lines).toBe(home(state).lines);
  });

  it('changes nothing for a window that is not open', () => {
    const state = seeded();

    expect(bufferReducer(state, { type: 'toggleReveal', windowId: NOWHERE, key: 'post:a' })).toBe(
      state,
    );
  });
});
