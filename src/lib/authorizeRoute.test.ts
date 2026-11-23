/**
 * Tests for the authorization route: the query of `#/oauth/authorize?...`
 * comes back as parameters (decoded, last value of a repeat), and any other
 * hash, or one with no query, is not an authorization request.
 */
import { describe, expect, it } from 'vitest';

import { parseAuthorizeRoute } from './authorizeRoute';

describe(parseAuthorizeRoute, () => {
  it('reads the parameters of the route', () => {
    expect(
      parseAuthorizeRoute(
        '#/oauth/authorize?client_id=c1&redirect_uri=https%3A%2F%2Fa.example%2Fcb&scope=read+write',
      ),
    ).toStrictEqual({
      client_id: 'c1',
      redirect_uri: 'https://a.example/cb',
      scope: 'read write',
    });
  });

  it('keeps the last value of a repeated parameter', () => {
    expect(parseAuthorizeRoute('#/oauth/authorize?state=a&state=b')).toStrictEqual({ state: 'b' });
  });

  it.each([
    '',
    '#',
    '#/oauth/authorize',
    '#/oauth/authorize?',
    '#/oauth/external/consent?a=1',
    '#/notice/1',
  ])('is not a request: %j', (hash) => {
    expect(parseAuthorizeRoute(hash)).toBeNull();
  });
});
