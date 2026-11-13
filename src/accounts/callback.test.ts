/**
 * Tests for the OAuth redirect URI derivation and the callback query parser
 * (decision 8).
 */
import { describe, expect, it } from 'vitest';

import { parseCallback, redirectUriFor } from './callback';

describe(redirectUriFor, () => {
  it('joins origin and pathname', () => {
    expect(redirectUriFor({ origin: 'https://fe.example', pathname: '/wiredfe/index.html' })).toBe(
      'https://fe.example/wiredfe/index.html',
    );
  });

  it('keeps a root pathname', () => {
    expect(redirectUriFor({ origin: 'https://fe.example', pathname: '/' })).toBe(
      'https://fe.example/',
    );
  });

  it('works for a local development origin', () => {
    expect(redirectUriFor({ origin: 'http://localhost:5173', pathname: '/' })).toBe(
      'http://localhost:5173/',
    );
  });
});

describe(parseCallback, () => {
  it('reads a code and state', () => {
    expect(parseCallback('?code=abc123&state=xyz789')).toStrictEqual({
      kind: 'code',
      code: 'abc123',
      state: 'xyz789',
    });
  });

  it('accepts a query without the leading question mark', () => {
    expect(parseCallback('code=abc123&state=xyz789')).toStrictEqual({
      kind: 'code',
      code: 'abc123',
      state: 'xyz789',
    });
  });

  it('prefers the code over an error in the same query', () => {
    expect(parseCallback('?code=abc&state=xyz&error=access_denied')).toStrictEqual({
      kind: 'code',
      code: 'abc',
      state: 'xyz',
    });
  });

  it('reads an error with a decoded description', () => {
    expect(parseCallback('?error=access_denied&error_description=You+declined')).toStrictEqual({
      kind: 'error',
      error: 'access_denied',
      description: 'You declined',
    });
  });

  it('reads an error without a description', () => {
    expect(parseCallback('?error=server_error')).toStrictEqual({
      kind: 'error',
      error: 'server_error',
      description: null,
    });
  });

  it('treats an empty description as none', () => {
    expect(parseCallback('?error=server_error&error_description=')).toStrictEqual({
      kind: 'error',
      error: 'server_error',
      description: null,
    });
  });

  it('is not a callback when the code has no state', () => {
    expect(parseCallback('?code=abc123')).toBeNull();
  });

  it('is not a callback when the state has no code', () => {
    expect(parseCallback('?state=xyz789')).toBeNull();
  });

  it('is not a callback when the code is empty', () => {
    expect(parseCallback('?code=&state=xyz789')).toBeNull();
  });

  it('is not a callback for an empty query', () => {
    expect(parseCallback('')).toBeNull();
  });

  it('is not a callback for an unrelated query', () => {
    expect(parseCallback('?q=lain')).toBeNull();
  });
});
