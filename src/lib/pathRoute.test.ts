/**
 * Tests for `pathToHash` (decision 4): every path wired-be redirects to
 * becomes the hash route that means the same thing, the ones with no window
 * keep their path and query, and the page's own paths and unknown ones are not
 * converted.
 */
import { describe, expect, it } from 'vitest';

import { pathToHash } from './pathRoute';
import { parseRoute } from './route';

/** The hash {@link pathname} and {@link search} convert to. */
function hashOf(pathname: string, search = ''): string | null {
  return pathToHash({ pathname, search });
}

describe(pathToHash, () => {
  it('converts /notice/<id> to the notice route', () => {
    expect(hashOf('/notice/AbC123')).toBe('#/notice/AbC123');
    expect(hashOf('/notice/a%20b')).toBe('#/notice/a%20b');
  });

  it('converts /<nickname> to the account route', () => {
    expect(hashOf('/lain')).toBe('#/@lain');
    expect(hashOf('/@lain')).toBe('#/@lain');
    expect(hashOf('/lain%40wired.example')).toBe('#/@lain@wired.example');
  });

  it('converts /users/<nickname> to the account route', () => {
    expect(hashOf('/users/lain')).toBe('#/@lain');
    expect(parseRoute(hashOf('/users/lain') ?? '')).toStrictEqual({ kind: 'acct', value: 'lain' });
  });

  it('keeps /authorize_interaction and its uri as a hash', () => {
    const search = `?uri=${encodeURIComponent('https://other.example/notice/7')}`;

    expect(hashOf('/authorize_interaction', search)).toBe(`#/authorize_interaction${search}`);
  });

  it('keeps /registration/<token> and /password_reset/<token> as hashes', () => {
    expect(hashOf('/registration/tok-1')).toBe('#/registration/tok-1');
    expect(hashOf('/password_reset/tok-2')).toBe('#/password_reset/tok-2');
  });

  it.each(['/oauth/authorize', '/oauth/external/register', '/oauth/external/consent'])(
    'keeps %s and its query as a hash',
    (path) => {
      expect(hashOf(path, '?client_id=c&state=s')).toBe(`#${path}?client_id=c&state=s`);
      expect(hashOf(path)).toBe(`#${path}`);
    },
  );

  it.each(['/', '', '/index.html', '/notice', '/notice/', '/users', '/a/b/c', '/@'])(
    'leaves %j alone',
    (path) => {
      expect(hashOf(path)).toBeNull();
    },
  );

  it('keeps the path segment as the address bar spells it, escapes and all', () => {
    expect(hashOf('/notice/%C3%A9t%C3%A9')).toBe('#/notice/%C3%A9t%C3%A9');
    expect(parseRoute(hashOf('/notice/%C3%A9') ?? '')).toStrictEqual({
      kind: 'notice',
      value: 'é',
    });
  });

  it('turns a path with malformed escapes into a hash that is no route', () => {
    expect(parseRoute(hashOf('/notice/%E0%A4%A') ?? '')).toBeNull();
  });
});
