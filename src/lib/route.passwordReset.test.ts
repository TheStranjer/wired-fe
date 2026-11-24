/**
 * Tests for the reset-letter hash route: `#/password_reset/<token>` yields its
 * decoded token (a query after it is ignored); every other hash, an empty or
 * extra segment and malformed escapes included, yields none.
 */
import { describe, expect, it } from 'vitest';

import { parsePasswordResetRoute } from './route';

describe(parsePasswordResetRoute, () => {
  it.each([
    ['#/password_reset/abc123', 'abc123'],
    ['#/password_reset/a%20b', 'a b'],
    ['#/password_reset/abc?x=1', 'abc'],
  ])('reads the token of %s', (hash, token) => {
    expect(parsePasswordResetRoute(hash)).toBe(token);
  });

  it.each([
    '',
    '#/password_reset',
    '#/password_reset/',
    '#/password_reset/a/b',
    '#/password_reset/%E0%A4%A',
    '#/registration/abc',
  ])('reads no token from %j', (hash) => {
    expect(parsePasswordResetRoute(hash)).toBeNull();
  });
});
