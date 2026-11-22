/**
 * Tests for the one-shot jobs' shared print and failure helpers: what they
 * dispatch into the job's window, and in which order.
 */

import { describe, expect, it, vi } from 'vitest';

import { failJob, printToJob } from './useOneShotLoad';

describe(printToJob, () => {
  it('prints the text at the level into the job window', () => {
    const dispatch = vi.fn();

    printToJob({ windowId: 'w2', dispatch }, 'info', 'hello');

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'print', windowId: 'w2', level: 'info', text: 'hello' }),
    );
  });
});

describe(failJob, () => {
  it('prints the described error, then fails the load', () => {
    const dispatch = vi.fn();

    failJob({ windowId: 'w3', dispatch }, { kind: 'http', status: 404, message: 'Not found' });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'print',
        windowId: 'w3',
        level: 'error',
        text: 'HTTP 404: Not found',
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: 'load',
      windowId: 'w3',
      load: 'error',
    });
  });
});
