/**
 * Tests for the invite-link hash route: `#/registration/<token>` yields its
 * decoded token (a query after it is ignored); every other hash, an empty or
 * extra segment and malformed escapes included, yields none.
 */
import { describe, expect, it } from 'vitest';

import { parseRegistrationRoute } from './route';

describe(parseRegistrationRoute, () => {
  it.each([
    ['#/registration/abc123', 'abc123'],
    ['#/registration/a%20b', 'a b'],
    ['#/registration/abc?x=1', 'abc'],
  ])('reads the token of %s', (hash, token) => {
    expect(parseRegistrationRoute(hash)).toBe(token);
  });

  it.each([
    '',
    '#/registration',
    '#/registration/',
    '#/registration/a/b',
    '#/registration/%E0%A4%A',
    '#/notice/abc',
  ])('reads no token from %j', (hash) => {
    expect(parseRegistrationRoute(hash)).toBeNull();
  });
});
