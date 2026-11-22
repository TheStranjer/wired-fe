/**
 * Tests for the http(s) check: both web schemes pass, every other scheme,
 * relative references and junk are refused.
 */
import { describe, expect, it } from 'vitest';

import { isHttpUrl } from './url';

describe(isHttpUrl, () => {
  it.each(['http://example.com/a', 'https://example.com/a.png?x=1'])('accepts %s', (href) => {
    expect(isHttpUrl(href)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'file:///etc/passwd',
    'intent://x',
    '/media/a.png',
    '//example.com/a.png',
    'not a url',
    '',
  ])('refuses %j', (href) => {
    expect(isHttpUrl(href)).toBe(false);
  });
});
