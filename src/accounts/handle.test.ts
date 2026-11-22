/**
 * Tests for fullHandle: the fqn wins when the backend reports one, an acct
 * that already carries a host is kept as it is, and a bare local acct gets
 * the instance's hostname appended — the three answers an instance can
 * give for the one account behind a token.
 */
import { describe, expect, it } from 'vitest';

import { fullHandle, usernameOf } from './handle';

const ORIGIN = 'https://wired.example';

describe(fullHandle, () => {
  it('takes the fqn when the account reports one', () => {
    expect(fullHandle({ acct: 'lain', fqn: 'lain@wired.example' }, ORIGIN)).toBe(
      'lain@wired.example',
    );
  });

  it('keeps an acct that already carries a host', () => {
    expect(fullHandle({ acct: 'alice@mastodon.example', fqn: null }, ORIGIN)).toBe(
      'alice@mastodon.example',
    );
  });

  it('appends the origin hostname to a local acct', () => {
    expect(fullHandle({ acct: 'lain', fqn: null }, ORIGIN)).toBe('lain@wired.example');
  });

  it('uses the hostname alone, without scheme or port', () => {
    expect(fullHandle({ acct: 'dev', fqn: null }, 'http://localhost:3000')).toBe('dev@localhost');
  });
});

describe(usernameOf, () => {
  it('takes the part before the first @', () => {
    expect(usernameOf('lain@wired.example')).toBe('lain');
  });

  it('returns a bare username whole', () => {
    expect(usernameOf('lain')).toBe('lain');
  });
});
