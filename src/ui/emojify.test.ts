/**
 * Tests for emojify: a known shortcode with an https image becomes an inline
 * img, unknown shortcodes and non-https URLs stay text, code and pre text is
 * left alone, attributes never gain elements, and markup that went through
 * the sanitizer comes out of emojify still free of scripts.
 */
import { describe, expect, it } from 'vitest';

import { emojify } from './emojify';
import type { EmojiRef } from './emojify';
import { sanitizeRemoteHtml } from './sanitize';

/** The one status emoji most of these tests offer. */
const CAT: readonly EmojiRef[] = [{ shortcode: 'cat', url: 'https://example.org/cat.png' }];

/** The markup emojify writes for {@link CAT}. */
const CAT_IMG =
  '<img class="emoji" src="https://example.org/cat.png" alt=":cat:" title=":cat:" draggable="false">';

describe(emojify, () => {
  it('replaces a known shortcode with an inline image', () => {
    expect(emojify('<p>i :cat: here</p>', CAT)).toBe(`<p>i ${CAT_IMG} here</p>`);
  });

  it('leaves unknown shortcodes as text', () => {
    expect(emojify('<p>:cat: and :dog:</p>', CAT)).toBe(`<p>${CAT_IMG} and :dog:</p>`);
  });

  it('ignores emojis whose URL is not https', () => {
    const emojis = [
      { shortcode: 'cat', url: 'http://example.org/cat.png' },
      { shortcode: 'dog', url: 'not a url' },
    ];

    expect(emojify('<p>:cat: :dog:</p>', emojis)).toBe('<p>:cat: :dog:</p>');
  });

  it('returns the HTML unchanged when no emoji has a usable image', () => {
    expect(emojify('<p>:cat:</p>', [])).toBe('<p>:cat:</p>');
  });

  it('does not touch text inside code or pre', () => {
    expect(emojify('<p>:cat:</p><code>:cat:</code><pre>:cat:</pre>', CAT)).toBe(
      `<p>${CAT_IMG}</p><code>:cat:</code><pre>:cat:</pre>`,
    );
  });

  it('does not create elements from attributes', () => {
    expect(emojify('<a href="https://example.org/:cat:">:cat:</a>', CAT)).toBe(
      `<a href="https://example.org/:cat:">${CAT_IMG}</a>`,
    );
  });

  it('leaves the result free of scripts', () => {
    const sanitized = sanitizeRemoteHtml('<p>:cat:<script>alert(1)</script></p>');

    expect(emojify(sanitized, CAT)).toBe(`<p>${CAT_IMG}</p>`);
  });
});
