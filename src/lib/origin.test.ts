/** Tests for the shared allowed-instance-URL rule. */
import { describe, expect, it } from 'vitest';

import {
  LOCAL_HOSTNAMES,
  hostOfOrigin,
  instanceWord,
  isAllowedInstanceUrl,
  originOfHost,
} from './origin';

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

describe(instanceWord, () => {
  it('is the bare host of an https origin, port included', () => {
    expect(instanceWord('https://wired.example')).toBe('wired.example');
    expect(instanceWord('https://wired.example:8443')).toBe('wired.example:8443');
  });

  it('keeps the scheme of a local http origin, which a bare host would lose', () => {
    expect(instanceWord('http://localhost:3000')).toBe('http://localhost:3000');
  });
});

describe(hostOfOrigin, () => {
  it.each([
    ['https://wired.example', 'wired.example'],
    ['https://wired.example:8443', 'wired.example:8443'],
    ['http://localhost:4000', 'localhost:4000'],
  ])('reads the host of %s', (origin, host) => {
    expect(hostOfOrigin(origin)).toBe(host);
  });
});

describe(originOfHost, () => {
  it.each([
    ['wired.example', 'https://wired.example'],
    ['Wired.Example:8443', 'https://wired.example:8443'],
    ['localhost', 'http://localhost'],
    ['localhost:4000', 'http://localhost:4000'],
    ['127.0.0.1:8080', 'http://127.0.0.1:8080'],
  ])('reads %s as %s', (host, origin) => {
    expect(originOfHost(host)).toBe(origin);
  });

  it.each(['', 'registration', 'oauth', 'localhost:', 'wired.example:', 'a..b', 'a b.example'])(
    'reads %j as no host',
    (host) => {
      expect(originOfHost(host)).toBeNull();
    },
  );

  it('refuses a port out of range', () => {
    expect(originOfHost('wired.example:99999')).toBeNull();
  });
});
