/**
 * Tests for the alert queue the core reducer keeps (WFE-271): an error line
 * queues an alert beside printing, info and warn lines do not, a repeat of the
 * last text counts up, the queue is capped and `dismissAlert` pops the head.
 */

import { describe, expect, it } from 'vitest';

import { MAX_ALERTS } from './alerts';
import { type AppState, coreReducer, initialAppState } from './appState';
import type { LineLevel } from './buffer';
import { appReducer } from './reducer';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The moment every printed line in these tests carries. */
const DATE = new Date('2026-11-25T10:00:00Z');

/** {@link state} after a line of {@link level} reading {@link text} printed in the status window. */
function printed(state: AppState, level: LineLevel, text: string): AppState {
  return coreReducer(state, { type: 'print', windowId: STATUS_WINDOW_ID, date: DATE, level, text });
}

/** The texts of the queue, head first. */
function texts(state: AppState): readonly string[] {
  return state.alerts.map((alert) => alert.text);
}

describe('the alert queue', () => {
  it('starts empty', () => {
    expect(initialAppState().alerts).toStrictEqual([]);
  });

  it('queues an alert for an error line and still prints the line', () => {
    const state = printed(initialAppState(), 'error', 'Unknown command: /nope. Try /help');

    expect(state.alerts).toStrictEqual([
      { id: 0, text: 'Unknown command: /nope. Try /help', count: 1 },
    ]);
    expect(state.seq).toBe(1);
    expect(state.buffers.get(STATUS_WINDOW_ID)?.lines.at(-1)).toMatchObject({
      kind: 'system',
      level: 'error',
      text: 'Unknown command: /nope. Try /help',
    });
  });

  it('queues nothing for info and warn lines', () => {
    const state = printed(printed(initialAppState(), 'info', 'fine'), 'warn', 'hmm');

    expect(state.alerts).toStrictEqual([]);
  });

  it('counts up a repeat of the last text instead of stacking it', () => {
    const state = printed(printed(initialAppState(), 'error', 'again'), 'error', 'again');

    expect(state.alerts).toStrictEqual([{ id: 0, text: 'again', count: 2 }]);
  });

  it('queues a repeat that is not the last text as a new alert', () => {
    const state = ['one', 'two', 'one'].reduce(
      (current, text) => printed(current, 'error', text),
      initialAppState(),
    );

    expect(texts(state)).toStrictEqual(['one', 'two', 'one']);
    expect(state.alerts.map((alert) => alert.count)).toStrictEqual([1, 1, 1]);
  });

  it('drops the oldest alerts beyond the cap', () => {
    const state = Array.from(
      { length: MAX_ALERTS + 2 },
      (_, index) => `error ${String(index)}`,
    ).reduce((current, text) => printed(current, 'error', text), initialAppState());

    expect(state.alerts).toHaveLength(MAX_ALERTS);
    expect(texts(state).at(0)).toBe('error 2');
    expect(texts(state).at(-1)).toBe(`error ${String(MAX_ALERTS + 1)}`);
  });

  it('pops the head on dismissAlert', () => {
    const queued = printed(printed(initialAppState(), 'error', 'one'), 'error', 'two');

    const state = appReducer(queued, { type: 'dismissAlert' });

    expect(texts(state)).toStrictEqual(['two']);
  });

  it('leaves an empty queue as it is on dismissAlert', () => {
    const state = initialAppState();

    expect(appReducer(state, { type: 'dismissAlert' })).toBe(state);
  });
});
