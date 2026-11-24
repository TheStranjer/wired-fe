/**
 * Tests for the http(s) address check: absolute http and https URLs pass in
 * their normalized form, everything else (other schemes, relative or
 * malformed text) is null.
 */
import { describe, expect, it } from 'vitest';

import { webUrl } from './webUrl';

describe(webUrl, () => {
  it('answers the normalized URL of an http(s) address', () => {
    expect(webUrl('https://cool.example')).toBe('https://cool.example/');
    expect(webUrl('http://localhost:3000/cb')).toBe('http://localhost:3000/cb');
  });

  it.each(['ftp://a.example', 'javascript:alert(1)', 'not a url', '/relative', ''])(
    'answers null for %j',
    (value) => {
      expect(webUrl(value)).toBeNull();
    },
  );
});
