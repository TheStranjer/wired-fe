/** Tests for the shared allowed-instance-URL rule. */
import { describe, expect, it } from 'vitest';

import { LOCAL_HOSTNAMES, isAllowedInstanceUrl } from './origin';

describe(isAllowedInstanceUrl, () => {
  it('accepts https on any host', () => {
    expect(isAllowedInstanceUrl(new URL('https://wired.example'))).toBe(true);
  });

  it.each(['http://localhost:5173', 'http://127.0.0.1:8080'])('accepts %s', (value) => {
    expect(isAllowedInstanceUrl(new URL(value))).toBe(true);
  });

  it('refuses http on any other host', () => {
    expect(isAllowedInstanceUrl(new URL('http://wired.example'))).toBe(false);
  });

  it('refuses other schemes', () => {
    expect(isAllowedInstanceUrl(new URL('ftp://localhost'))).toBe(false);
  });

  it('names the local hostnames', () => {
    expect(LOCAL_HOSTNAMES).toStrictEqual(['localhost', '127.0.0.1']);
  });
});
