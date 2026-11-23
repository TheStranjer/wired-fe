/**
 * Tests for `fetchThread`, the thread job the hook runs: the status answer
 * and the context answer become one newest-first `statuses` batch — which
 * the buffer's own reversal turns into ancestors → status → replies — then
 * the target's line is selected and the load closed exhausted. A half that
 * refuses prints its description once into the window and fails the load,
 * and a job whose window closed while the instance was thinking reports
 * nothing at all. The MSW conversation comes from src/test/threadWindow.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { fetchThread, type ThreadJob } from './useThread';
import type { Dispatch } from '../../state/StateContext';
import {
  FIRST_DOWN,
  FIRST_UP,
  SECOND_DOWN,
  SECOND_UP,
  serveThread,
  THREAD_SESSION,
  THREAD_TARGET,
  THREAD_WINDOW,
} from '../../test/threadWindow';
import { withSession } from '../../test/withToken';

/** A job fetching target five into the thread window, aborted when told. */
function jobFor(dispatch: Dispatch, signal = new AbortController().signal): ThreadJob {
  return {
    withToken: withSession(THREAD_SESSION),
    id: '5',
    windowId: THREAD_WINDOW,
    signal,
    dispatch,
  };
}

/** The actions a recorded dispatch saw, in order. */
function dispatched(dispatch: Mock<Dispatch>): readonly unknown[] {
  return dispatch.mock.calls.map((call) => call[0]);
}

describe(fetchThread, () => {
  it('delivers one newest-first batch, the selection, and an exhausted load', async () => {
    serveThread();
    const dispatch = vi.fn<Dispatch>();

    await fetchThread(jobFor(dispatch));

    expect(dispatched(dispatch)).toStrictEqual([
      {
        type: 'statuses',
        windowId: THREAD_WINDOW,
        statuses: [SECOND_DOWN, FIRST_DOWN, THREAD_TARGET, SECOND_UP, FIRST_UP],
        where: 'newer',
      },
      { type: 'select', windowId: THREAD_WINDOW, key: 'post:5' },
      { type: 'load', windowId: THREAD_WINDOW, load: 'loaded', exhausted: true },
    ]);
  });

  it('prints a failed context answer once and fails the load', async () => {
    serveThread({ context: true });
    const dispatch = vi.fn<Dispatch>();

    await fetchThread(jobFor(dispatch));

    const calls = dispatched(dispatch);

    expect(calls.at(-2)).toMatchObject({
      type: 'print',
      windowId: THREAD_WINDOW,
      level: 'error',
      text: 'HTTP 500: Boom',
    });
    expect(calls.at(-1)).toStrictEqual({
      type: 'load',
      windowId: THREAD_WINDOW,
      load: 'error',
    });
    expect(calls).toHaveLength(2);
  });

  it('reports the status answer failing, before any context one', async () => {
    serveThread({ status: true });
    const dispatch = vi.fn<Dispatch>();

    await fetchThread(jobFor(dispatch));

    const [printed, load] = dispatched(dispatch);

    expect(printed).toMatchObject({
      type: 'print',
      windowId: THREAD_WINDOW,
      level: 'error',
      text: 'HTTP 404: Record not found',
    });
    expect(load).toMatchObject({ type: 'load', load: 'error' });
  });

  it('reports nothing once the window it answers has closed', async () => {
    serveThread();
    const controller = new AbortController();
    controller.abort();
    const dispatch = vi.fn<Dispatch>();

    await fetchThread(jobFor(dispatch, controller.signal));

    expect(dispatch).not.toHaveBeenCalled();
  });
});
