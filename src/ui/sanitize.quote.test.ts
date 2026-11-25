/**
 * Tests for the quote fallback of the remote HTML sanitizer (WFE-175): the
 * "RE:/RT: link" element backends add for clients that cannot draw quotes is
 * dropped when a quote card shows, and kept when none does.
 */
import { describe, expect, it } from 'vitest';

import { sanitizeRemoteHtml } from './sanitize';

const MASTODON =
  '<p>quoting</p><p class="quote-inline">RE: <a href="https://m.test/@a/1">m.test/@a/1</a></p>';
const WIRED =
  '<p>quoting in gate test</p><p class="quote-inline">RE: <a href="https://wired2.test/notice/01a2">wired2.test/notice/01a2</a></p>';
const PLEROMA =
  '<p>quoting</p><span class="quote-inline"><br/><br/>RT: <a href="https://pleroma.test/objects/36">https://pleroma.test/objects/36</a></span>';
const MISSKEY = '<p>quoting</p><span class="quote-inline">RE: https://k.test/notes/1</span>';

describe('sanitizeRemoteHtml quote fallback', () => {
  it.each([
    ['Mastodon', MASTODON, '<p>quoting</p>'],
    ['Wired', WIRED, '<p>quoting in gate test</p>'],
    ['Pleroma', PLEROMA, '<p>quoting</p>'],
    ['Misskey', MISSKEY, '<p>quoting</p>'],
  ])('drops the %s fallback when a quote card shows', (_name, html, expected) => {
    const safe = sanitizeRemoteHtml(html, { dropQuoteFallback: true });

    expect(safe).toBe(expected);
    expect(safe).not.toMatch(/R[ET]:/u);
  });

  it.each([
    ['Mastodon', MASTODON, 'RE:'],
    ['Wired', WIRED, 'RE:'],
    ['Pleroma', PLEROMA, 'RT:'],
    ['Misskey', MISSKEY, 'RE:'],
  ])('keeps the %s fallback when no quote card shows', (_name, html, marker) => {
    expect(sanitizeRemoteHtml(html)).toContain(marker);
    expect(sanitizeRemoteHtml(html, { dropQuoteFallback: false })).toContain(marker);
  });

  it('drops only the fallback and keeps other classes and links', () => {
    const html = `<p><a class="mention" href="https://m.test/@a">@a</a> hi</p>${MASTODON}`;

    expect(sanitizeRemoteHtml(html, { dropQuoteFallback: true })).toBe(
      '<p><a class="mention" href="https://m.test/@a" rel="nofollow noopener noreferrer" target="_blank">@a</a> hi</p><p>quoting</p>',
    );
  });

  it('keeps hostile markup out while dropping the fallback', () => {
    const html = '<p>a<script>x()</script></p><p class="quote-inline evil">RE: b</p>';

    expect(sanitizeRemoteHtml(html, { dropQuoteFallback: true })).toBe('<p>a</p>');
  });

  it('keeps an empty string empty', () => {
    expect(sanitizeRemoteHtml('', { dropQuoteFallback: true })).toBe('');
  });
});
