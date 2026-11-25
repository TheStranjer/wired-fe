/**
 * Tests for the reducer's window side: where a printed line goes, how the
 * buffers follow the window list, and which requests hand back the very same map.
 */

import { describe, expect, it } from 'vitest';

import { isBlank, printTarget, putBuffer, syncBuffers } from './appReducer';
import { type Buffer, EMPTY_BUFFER, type SystemLineData } from './buffer';
import { STATUS_WINDOW_ID } from '../windows/model';
import type { WindowState, WindowsState } from '../windows/model';

/** One client message, enough to make a buffer not blank. */
const LINE: SystemLineData = {
  kind: 'system',
  key: 'sys:0',
  date: new Date('2026-11-14T21:04:00Z'),
  level: 'info',
  text: 'hello',
};

/** A scrollback holding that one line. */
const ONE_LINE: Buffer = { ...EMPTY_BUFFER, lines: [LINE] };

/** A window named after its id; the view behind the name is not under test. */
function windowFor(id: string): WindowState {
  return {
    id,
    ref: { kind: 'home', accountKey: 'lain@wired.example', target: null },
    title: id,
    unread: 0,
    highlight: false,
    display: {},
  };
}

/** The window list of {@link ids}, showing `activeId`. */
function windowList(ids: readonly string[], activeId: string): WindowsState {
  return { windows: ids.map(windowFor), activeId };
}

const HOME = 'home:lain@wired.example:-';

const DM = 'dm:lain@wired.example:@a3@wired.example';

const WINDOWS = [windowFor(STATUS_WINDOW_ID), windowFor(HOME), windowFor(DM)];

describe(printTarget, () => {
  const list = windowList([STATUS_WINDOW_ID, HOME, DM], DM);

  it('names the window it is given', () => {
    expect(printTarget(list, HOME)).toBe(HOME);
  });

  it('takes the active window for none', () => {
    expect(printTarget(list, null)).toBe(DM);
  });

  it('falls back to the status window for an id no window has', () => {
    expect(printTarget(list, 'nope:nope:nope')).toBe(STATUS_WINDOW_ID);
  });

  it('falls back to the status window when nothing is active', () => {
    expect(printTarget(windowList([STATUS_WINDOW_ID, HOME], 'gone'), null)).toBe(STATUS_WINDOW_ID);
  });
});

describe(syncBuffers, () => {
  it('opens the scrollback of a window that has none', () => {
    const next = syncBuffers(WINDOWS, new Map([[STATUS_WINDOW_ID, ONE_LINE]]));

    expect([...next.keys()]).toStrictEqual([STATUS_WINDOW_ID, HOME, DM]);
    expect(next.get(HOME)).toBe(EMPTY_BUFFER);
  });

  it('closes the scrollback of a window that is gone', () => {
    const buffers = new Map([
      [STATUS_WINDOW_ID, ONE_LINE],
      [HOME, ONE_LINE],
      [DM, ONE_LINE],
    ]);

    const next = syncBuffers(WINDOWS.slice(0, 2), buffers);

    expect([...next.keys()]).toStrictEqual([STATUS_WINDOW_ID, HOME]);
    expect(next.get(HOME)).toBe(ONE_LINE);
  });

  it('adds and drops in one pass', () => {
    const buffers = new Map([
      [STATUS_WINDOW_ID, ONE_LINE],
      [DM, ONE_LINE],
    ]);

    const next = syncBuffers(WINDOWS.slice(0, 2), buffers);

    expect([...next.keys()]).toStrictEqual([STATUS_WINDOW_ID, HOME]);
  });

  it('hands back the very same map when the list already matches', () => {
    const buffers = syncBuffers(WINDOWS, new Map());

    expect(syncBuffers(WINDOWS, buffers)).toBe(buffers);
  });
});

describe(putBuffer, () => {
  const buffers = new Map([[HOME, EMPTY_BUFFER]]);

  it('replaces one window scrollback and keeps the others', () => {
    const next = putBuffer(buffers, DM, ONE_LINE);

    expect(next.get(DM)).toBe(ONE_LINE);
    expect(next.get(HOME)).toBe(EMPTY_BUFFER);
    expect(buffers.get(DM)).toBeUndefined();
  });

  it('hands back the very same map for the buffer it already holds', () => {
    expect(putBuffer(buffers, HOME, EMPTY_BUFFER)).toBe(buffers);
  });
});

describe(isBlank, () => {
  it('sees nothing to clear in a fresh buffer', () => {
    expect(isBlank(EMPTY_BUFFER)).toBe(true);
  });

  it('sees lines, a selection and an open warning as something to clear', () => {
    expect(isBlank({ ...EMPTY_BUFFER, lines: [LINE] })).toBe(false);
    expect(isBlank({ ...EMPTY_BUFFER, selectedKey: 'sys:0' })).toBe(false);
    expect(isBlank({ ...EMPTY_BUFFER, revealed: new Set(['sys:0']) })).toBe(false);
  });
});
