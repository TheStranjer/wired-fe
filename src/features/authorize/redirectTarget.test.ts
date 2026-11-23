/**
 * Tests for where an answer may send the browser: http(s) URLs and the
 * out-of-band URN, nothing else (no script, data or custom schemes, no
 * relative or malformed addresses).
 */
import { describe, expect, it } from 'vitest';

import { OOB_URI, redirectTarget, webUrl } from './redirectTarget';

describe(redirectTarget, () => {
  it('accepts https and http URLs', () => {
    expect(redirectTarget('https://cool.example/cb?code=1')).toStrictEqual({
      kind: 'url',
      url: 'https://cool.example/cb?code=1',
    });
    expect(redirectTarget('http://localhost:3000/cb')).toStrictEqual({
      kind: 'url',
      url: 'http://localhost:3000/cb',
    });
  });

  it('accepts the out-of-band URN', () => {
    expect(redirectTarget(OOB_URI)).toStrictEqual({ kind: 'oob' });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hi',
    'myapp://callback',
    'urn:ietf:wg:oauth:2.0:oob:auto',
    '/relative',
    '',
  ])('refuses %j', (uri) => {
    expect(redirectTarget(uri)).toBeNull();
  });
});

describe(webUrl, () => {
  it('answers null for what is not an http(s) URL', () => {
    expect(webUrl('ftp://a.example')).toBeNull();
    expect(webUrl('not a url')).toBeNull();
  });
});
