/**
 * Tests for how a window knows where its own content stands: the load state it is
 * in, the cursor that would fetch the next older page, the flag saying history has
 * run out, and the asks the reader makes for more of it.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, coreReducer, initialAppState } from './appState';
import { type Buffer, EMPTY_BUFFER } from './buffer';
import { bufferReducer } from './bufferActions';
import type { PageCursor } from '../api/pagination';
import { windowId } from '../windows/model';
import type { WindowRef } from '../windows/model';

const HOME: WindowRef = {
  kind: 'home',
  accountKey: 'https://wired.example#acct-1',
  target: null,
};
const HOME_ID = windowId(HOME);
const NOWHERE = 'nope:nope:nope';

/** Two cursors that differ by identity, the way paging answers do. */
const CURSOR: PageCursor = { max_id: 'a1' };
const EARLIER: PageCursor = { max_id: 'a0' };

/** Window 1 and an empty home window on screen. */
function blank(): AppState {
  return coreReducer(initialAppState(), {
    type: 'windows',
    action: { type: 'open', ref: HOME, title: 'home' },
  });
}

/** {@link state} with the home buffer replaced by {@link buffer}. */
function withHome(state: AppState, buffer: Buffer): AppState {
  return { ...state, buffers: new Map(state.buffers).set(HOME_ID, buffer) };
}

/** The home scrollback. */
function home(state: AppState): Buffer {
  const buffer = state.buffers.get(HOME_ID);
  if (buffer === undefined) {
    throw new Error(`no buffer for ${HOME_ID}`);
  }
  return buffer;
}

describe('the load state', () => {
  it('says what the window is doing and keeps the paging it had', () => {
    const loaded = withHome(blank(), {
      ...EMPTY_BUFFER,
      load: 'loaded',
      olderCursor: CURSOR,
      exhausted: true,
    });

    const next = bufferReducer(loaded, { type: 'load', windowId: HOME_ID, load: 'loading' });

    expect(home(next)).toStrictEqual({
      ...EMPTY_BUFFER,
      load: 'loading',
      olderCursor: CURSOR,
      exhausted: true,
    });
  });

  it('takes the older cursor and the exhausted flag it is told', () => {
    const next = bufferReducer(blank(), {
      type: 'load',
      windowId: HOME_ID,
      load: 'loaded',
      olderCursor: CURSOR,
      exhausted: false,
    });

    expect(home(next).load).toBe('loaded');
    expect(home(next).olderCursor).toBe(CURSOR);
  });

  it('clears the cursor when told to', () => {
    const loaded = withHome(blank(), { ...EMPTY_BUFFER, load: 'loaded', olderCursor: CURSOR });

    const next = bufferReducer(loaded, {
      type: 'load',
      windowId: HOME_ID,
      load: 'loaded',
      olderCursor: null,
    });

    expect(home(next).olderCursor).toBeNull();
  });

  it('changes nothing when the window already says this', () => {
    const loaded = withHome(blank(), {
      ...EMPTY_BUFFER,
      load: 'loaded',
      olderCursor: CURSOR,
      exhausted: true,
    });

    expect(bufferReducer(loaded, { type: 'load', windowId: HOME_ID, load: 'loaded' })).toBe(loaded);
    expect(
      bufferReducer(loaded, {
        type: 'load',
        windowId: HOME_ID,
        load: 'loaded',
        olderCursor: CURSOR,
        exhausted: true,
      }),
    ).toBe(loaded);
  });

  it('moves when only the cursor changed', () => {
    const loading = withHome(blank(), { ...EMPTY_BUFFER, load: 'loading', olderCursor: CURSOR });

    const older = bufferReducer(loading, {
      type: 'load',
      windowId: HOME_ID,
      load: 'loading',
      olderCursor: EARLIER,
    });
    const exhausted = bufferReducer(loading, {
      type: 'load',
      windowId: HOME_ID,
      load: 'loading',
      olderCursor: CURSOR,
      exhausted: true,
    });

    expect(home(older).olderCursor).toBe(EARLIER);
    expect(home(exhausted).exhausted).toBe(true);
  });

  it('changes nothing for a window that is not open', () => {
    const state = blank();

    expect(
      bufferReducer(state, { type: 'load', windowId: NOWHERE, load: 'error', exhausted: true }),
    ).toBe(state);
  });
});

describe('the ask for older history', () => {
  it('bumps the counter, which stays until the ask is handled', () => {
    const state = blank();

    const once = bufferReducer(state, { type: 'requestOlder', windowId: HOME_ID });
    const twice = bufferReducer(once, { type: 'requestOlder', windowId: HOME_ID });

    expect(home(once).olderRequests).toBe(1);
    expect(home(twice).olderRequests).toBe(2);
    expect(home(twice).lines).toBe(home(state).lines);
  });

  it('ignores the ask once the window has reached the end of history', () => {
    const atTheEnd = withHome(blank(), { ...EMPTY_BUFFER, exhausted: true });

    expect(bufferReducer(atTheEnd, { type: 'requestOlder', windowId: HOME_ID })).toBe(atTheEnd);
  });

  it('changes nothing for a window that is not open', () => {
    const state = blank();

    expect(bufferReducer(state, { type: 'requestOlder', windowId: NOWHERE })).toBe(state);
  });
});
