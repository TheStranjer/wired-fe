/**
 * Tests for the words of a failed authorization call: the trusted-app refusal
 * is explained, a 400 says the request was refused, anything else is the
 * shared description.
 */
import { describe, expect, it } from 'vitest';

import { describeAuthorizeError } from './describeError';

describe(describeAuthorizeError, () => {
  it('explains a 403 unauthorized_client', () => {
    expect(
      describeAuthorizeError({ kind: 'http', status: 403, message: 'unauthorized_client' }),
    ).toMatch(/not marked WiredFE as a trusted app/u);
  });

  it('names what a 400 was refused for', () => {
    expect(describeAuthorizeError({ kind: 'http', status: 400, message: 'invalid_scope' })).toBe(
      'The instance refused this authorization request: invalid_scope',
    );
  });

  it('describes any other failure', () => {
    expect(describeAuthorizeError({ kind: 'http', status: 403, message: 'Forbidden' })).toBe(
      'Could not authorize: HTTP 403: Forbidden',
    );
    expect(describeAuthorizeError({ kind: 'network', message: 'offline' })).toBe(
      'Could not authorize: Network error: offline',
    );
  });
});
