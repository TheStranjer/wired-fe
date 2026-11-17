/**
 * Tests for the lines a window's scrollback takes from the core reducer: where a
 * printed client message lands, the counter behind its key, and what `/clear`
 * takes off a window and leaves alone.
 */

import { describe, expect, it } from 'vitest';

import { type AppState, type CoreAction, coreReducer, initialAppState } from './appState';
import { type Buffer, EMPTY_BUFFER, type LineLevel } from './buffer';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowKind, WindowRef } from '../windows/model';

const ACCOUNT = 'lain@wired.example';

/** The moment every printed line in these tests carries. */
const DATE = new Date('2026-11-14T21:04:00Z');

/** The view of `kind` on the account under test, with a target when it needs one. */
function ref(kind: WindowKind, target: string | null = null): WindowRef {
  return { kind, accountKey: ACCOUNT, target };
}

/** The id of the window that shows `kind`. */
function viewId(kind: WindowKind, target: string | null = null): string {
  return windowId(ref(kind, target));
}

/** The buffer of a window, or the test fails rather than guess at one. */
function bufferOf(state: AppState, id: string): Buffer {
  const buffer = state.buffers.get(id);
  if (buffer === undefined) {
    throw new Error(`no buffer for window ${id}`);
  }
  return buffer;
}

/** The keys of the client messages a buffer holds, oldest first. */
function systemKeys(buffer: Buffer): readonly string[] {
  return buffer.lines.flatMap((line) => (line.kind === 'system' ? [line.key] : []));
}

/** The action that prints one client message into the window `target`, or the active one. */
function printLine(
  text: string,
  target: string | null = null,
  level: LineLevel = 'info',
): CoreAction {
  return { type: 'print', windowId: target, date: DATE, level, text };
}

/** The action that empties the scrollback of the window `id`. */
function clearWindow(id: string): CoreAction {
  return { type: 'clear', windowId: id };
}

/** Window 1 and a home window on the account under test, with home active. */
function withHome(): AppState {
  return coreReducer(initialAppState(), {
    type: 'windows',
    action: { type: 'open', ref: ref('home'), title: 'home' },
  });
}

describe('a printed line', () => {
  it('lands at the bottom of the window it names, keyed by seq', () => {
    const next = coreReducer(withHome(), printLine('/follow ok', viewId('home'), 'warn'));

    expect(bufferOf(next, viewId('home')).lines).toStrictEqual([
      { kind: 'system', key: 'sys:0', date: DATE, level: 'warn', text: '/follow ok' },
    ]);
    expect(bufferOf(next, STATUS_WINDOW_ID).lines).toStrictEqual([]);
    expect(next.seq).toBe(1);
  });

  it('takes the active window when none is named', () => {
    const active = coreReducer(initialAppState(), {
      type: 'windows',
      action: { type: 'open', ref: ref('notifications'), title: 'notifications' },
    });

    const next = coreReducer(active, printLine('here'));

    expect(bufferOf(next, viewId('notifications')).lines).toHaveLength(1);
    expect(bufferOf(next, STATUS_WINDOW_ID).lines).toStrictEqual([]);
  });

  it('falls back to the status window for a window that is not there', () => {
    const next = coreReducer(withHome(), printLine('lost', 'home:other:other'));

    expect(systemKeys(bufferOf(next, STATUS_WINDOW_ID))).toStrictEqual(['sys:0']);
    expect(systemKeys(bufferOf(next, viewId('home')))).toStrictEqual([]);
  });

  it('counts every client message up, so keys stay unique', () => {
    let state = initialAppState();
    for (const text of ['one', 'two', 'three']) {
      state = coreReducer(state, printLine(text));
    }

    expect(systemKeys(bufferOf(state, STATUS_WINDOW_ID))).toStrictEqual([
      'sys:0',
      'sys:1',
      'sys:2',
    ]);
    expect(state.seq).toBe(3);
  });

  it('opens the scrollback of a window whose buffer was never made', () => {
    const desynced: AppState = { ...initialAppState(), buffers: new Map<string, Buffer>() };

    const next = coreReducer(desynced, printLine('first line'));

    expect(bufferOf(next, STATUS_WINDOW_ID).lines).toHaveLength(1);
    expect(next.seq).toBe(1);
  });

  it('keeps the decorative flag of a banner line, and no flag without one', () => {
    const state = coreReducer(initialAppState(), {
      type: 'print',
      windowId: STATUS_WINDOW_ID,
      date: DATE,
      level: 'info',
      text: '█▀▄',
      decorative: true,
    });

    expect(bufferOf(state, STATUS_WINDOW_ID).lines[0]).toStrictEqual({
      kind: 'system',
      key: 'sys:0',
      date: DATE,
      level: 'info',
      text: '█▀▄',
      decorative: true,
    });
    expect(
      bufferOf(coreReducer(initialAppState(), printLine('plain')), STATUS_WINDOW_ID).lines[0],
    ).not.toHaveProperty('decorative');
  });
});

describe('a cleared window', () => {
  it('takes the lines off the window it names and leaves the others alone', () => {
    const printed = coreReducer(
      coreReducer(withHome(), printLine('here', viewId('home'))),
      printLine('there', STATUS_WINDOW_ID),
    );

    const next = coreReducer(printed, clearWindow(viewId('home')));

    expect(bufferOf(next, viewId('home')).lines).toStrictEqual([]);
    expect(bufferOf(next, STATUS_WINDOW_ID).lines).toHaveLength(1);
    expect(next.seq).toBe(printed.seq);
  });

  it('leaves the state alone for a window that is not there', () => {
    const state = withHome();

    expect(coreReducer(state, clearWindow('nope:nope:nope'))).toBe(state);
  });

  it('leaves the state alone when the window holds nothing to clear', () => {
    const state = withHome();

    expect(coreReducer(state, clearWindow(STATUS_WINDOW_ID))).toBe(state);
  });

  it('keeps the load a window had reached, which clearing is not about', () => {
    const loaded: AppState = {
      ...withHome(),
      buffers: new Map([[STATUS_WINDOW_ID, { ...EMPTY_BUFFER, load: 'loaded' }]]),
    };

    const next = coreReducer(loaded, clearWindow(STATUS_WINDOW_ID));

    expect(bufferOf(next, STATUS_WINDOW_ID)).toStrictEqual({ ...EMPTY_BUFFER, load: 'loaded' });
  });
});
