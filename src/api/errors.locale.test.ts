/**
 * Tests that the API error descriptions follow the language (decision 19):
 * the frame around an error is translated text, while the server's own
 * message is passed through as it came.
 */
import { describe, expect, it } from 'vitest';

import { type ApiError, describeApiError } from './errors';
import { installFakeLocale } from '../test/i18n';

describe(describeApiError, () => {
  it('words each kind in the language in use and keeps the remote text', () => {
    installFakeLocale({
      api: {
        http_error: 'XX {status} / {message}',
        network_error: 'XX net {message}',
        rate_limited: 'XX slow down',
        request_cancelled: 'XX cancelled',
      },
    });
    const http: ApiError = { kind: 'http', status: 422, message: 'Server says no' };
    const network: ApiError = { kind: 'network', message: 'refused' };

    expect(describeApiError(http)).toBe('XX 422 / Server says no');
    expect(describeApiError(network)).toBe('XX net refused');
    expect(describeApiError({ kind: 'aborted' })).toBe('XX cancelled');
    expect(describeApiError({ kind: 'rate-limited', resetAt: null })).toBe('XX slow down');
  });
});
