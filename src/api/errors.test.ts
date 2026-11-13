/**
 * Tests for the API error descriptions shown in the status window.
 */
import { describe, expect, it } from 'vitest';

import { type ApiError, describeApiError } from './errors';

describe(describeApiError, () => {
  it('describes a network error with its message', () => {
    const error: ApiError = { kind: 'network', message: 'connection refused' };

    expect(describeApiError(error)).toBe('Network error: connection refused');
  });

  it('describes an aborted request', () => {
    const error: ApiError = { kind: 'aborted' };

    expect(describeApiError(error)).toBe('Request cancelled');
  });

  it('describes an HTTP error with its status and message', () => {
    const error: ApiError = { kind: 'http', status: 404, message: 'Not Found' };

    expect(describeApiError(error)).toBe('HTTP 404: Not Found');
  });

  it('describes a rate limit with the local reset time', () => {
    const error: ApiError = { kind: 'rate-limited', resetAt: new Date(2026, 0, 1, 9, 5) };

    expect(describeApiError(error)).toBe('Rate limited until 09:05');
  });

  it('describes a rate limit without a reset time', () => {
    const error: ApiError = { kind: 'rate-limited', resetAt: null };

    expect(describeApiError(error)).toBe('Rate limited');
  });

  it('describes a parse error with its message', () => {
    const error: ApiError = { kind: 'parse', message: 'expected an array' };

    expect(describeApiError(error)).toBe('Unexpected response: expected an array');
  });
});
