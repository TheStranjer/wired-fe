/**
 * Tests for the sync's error texts: each typed refusal has its own line, and
 * a plain API failure says what {@link describeApiError} says.
 */
import { describe, expect, it } from 'vitest';

import { describeSyncError } from './syncError';

describe(describeSyncError, () => {
  it('says the desk is too large', () => {
    expect(describeSyncError({ kind: 'tooLarge' })).toBe(
      'Sync: the server says the desk is too large to store',
    );
  });

  it('says the login may not use the settings store', () => {
    expect(describeSyncError({ kind: 'forbidden' })).toContain('may not use the settings store');
  });

  it('says the server has no settings store', () => {
    expect(describeSyncError({ kind: 'unsupported' })).toContain('no settings store');
  });

  it('describes any other failure as the API does', () => {
    expect(describeSyncError({ kind: 'network', message: 'offline' })).toBe(
      'Sync failed. Network error: offline',
    );
    expect(describeSyncError({ kind: 'http', status: 500, message: 'Boom' })).toBe(
      'Sync failed. HTTP 500: Boom',
    );
  });
});
