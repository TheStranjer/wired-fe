/**
 * Tests for the sync request channel: a listener hears requests until it
 * stops, and a request nobody hears is dropped.
 */
import { describe, expect, it, vi } from 'vitest';

import { onSyncRequest, requestSync } from './syncRequests';

describe('sync requests', () => {
  it('hands each request to the listeners until they stop', () => {
    const heard = vi.fn();
    const stop = onSyncRequest(heard);

    requestSync('pull');
    requestSync('now');
    stop();
    requestSync('pull');

    expect(heard.mock.calls).toStrictEqual([['pull'], ['now']]);
  });
});
