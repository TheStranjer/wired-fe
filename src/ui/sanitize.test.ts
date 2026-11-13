/**
 * Tests for the remote HTML sanitizer.
 */
import { describe, expect, it } from 'vitest';

import { sanitizeRemoteHtml } from './sanitize';

describe(sanitizeRemoteHtml, () => {
  it('leaves a plain paragraph with strong markup untouched', () => {
    expect(sanitizeRemoteHtml('<p>Hello <strong>world</strong></p>')).toBe(
      '<p>Hello <strong>world</strong></p>',
    );
  });

  it('removes a script element entirely, including its text', () => {
    expect(sanitizeRemoteHtml('<p>a<script>alert(1)</script>b</p>')).toBe('<p>ab</p>');
    expect(sanitizeRemoteHtml('<script>alert(1)</script>')).toBe('');
  });

  it('removes an img element carrying an onerror handler', () => {
    expect(sanitizeRemoteHtml('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('keeps the a element and its text but drops a javascript: href', () => {
    expect(sanitizeRemoteHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('keeps only the href of a styled link, plus the added rel and target', () => {
    expect(
      sanitizeRemoteHtml('<a href="https://example.com" style="color:red" onclick="x()">x</a>'),
    ).toBe(
      '<a href="https://example.com" rel="nofollow noopener noreferrer" target="_blank">x</a>',
    );
  });

  it('keeps only known class tokens on a span', () => {
    expect(sanitizeRemoteHtml('<span class="h-card evil">x</span>')).toBe(
      '<span class="h-card">x</span>',
    );
  });

  it('drops the class attribute when no known token remains', () => {
    expect(sanitizeRemoteHtml('<span class="evil">x</span>')).toBe('<span>x</span>');
  });

  it('removes an iframe element', () => {
    expect(sanitizeRemoteHtml('<iframe src="https://example.com"></iframe>')).toBe('');
  });

  it('removes an iframe together with its fallback content', () => {
    expect(sanitizeRemoteHtml('<iframe>gone</iframe>')).toBe('');
  });

  it('removes an object element together with its fallback content', () => {
    expect(sanitizeRemoteHtml('<object>gone</object>')).toBe('');
  });

  it('removes an embed element', () => {
    expect(sanitizeRemoteHtml('<embed src="https://example.com/e.swf">')).toBe('');
  });

  it('removes an svg element together with its content', () => {
    expect(sanitizeRemoteHtml('<svg><text>gone</text></svg>')).toBe('');
  });

  it('removes a math element together with its content', () => {
    expect(sanitizeRemoteHtml('<math><mi>gone</mi></math>')).toBe('');
  });

  it('removes a template element together with its content', () => {
    expect(sanitizeRemoteHtml('<template><img src=x onerror=alert(1)></template>')).toBe('');
  });

  it('unwraps a disallowed container but keeps the allowed child', () => {
    expect(sanitizeRemoteHtml('<div><p>kept</p></div>')).toBe('<p>kept</p>');
  });

  it('keeps the classes of a Mastodon-style mention and secures its link', () => {
    expect(
      sanitizeRemoteHtml(
        '<span class="h-card"><a href="https://m.example/@x" class="u-url mention">' +
          '@<span>x</span></a></span>',
      ),
    ).toBe(
      '<span class="h-card"><a href="https://m.example/@x" class="u-url mention" ' +
        'rel="nofollow noopener noreferrer" target="_blank">@<span>x</span></a></span>',
    );
  });

  it('keeps an http link with rel and target', () => {
    expect(sanitizeRemoteHtml('<a href="http://example.com/a">x</a>')).toBe(
      '<a href="http://example.com/a" rel="nofollow noopener noreferrer" target="_blank">x</a>',
    );
  });

  it('drops a relative href but keeps the a element and its text', () => {
    expect(sanitizeRemoteHtml('<a href="/home">x</a>')).toBe('<a>x</a>');
  });

  it('drops a mailto href but keeps the a element and its text', () => {
    expect(sanitizeRemoteHtml('<a href="mailto:lain@example.com">x</a>')).toBe('<a>x</a>');
  });

  it('drops an href on a span', () => {
    expect(sanitizeRemoteHtml('<span href="https://example.com">x</span>')).toBe('<span>x</span>');
  });

  it('drops class on an element that may not carry it', () => {
    expect(sanitizeRemoteHtml('<p class="mention">x</p>')).toBe('<p>x</p>');
  });

  it('drops id, name, target and rel from the input', () => {
    expect(
      sanitizeRemoteHtml(
        '<a id="a" name="n" target="_top" rel="me" href="https://example.com">x</a>',
      ),
    ).toBe(
      '<a href="https://example.com" rel="nofollow noopener noreferrer" target="_blank">x</a>',
    );
  });

  it('drops a class attribute that holds only unknown or empty value', () => {
    expect(sanitizeRemoteHtml('<a class="" href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com" rel="nofollow noopener noreferrer" target="_blank">x</a>',
    );
  });

  it('keeps the allowed formatting elements', () => {
    const html =
      '<p>a<br>b <em>c</em> <i>d</i> <u>e</u> <s>f</s> <del>g</del> <b>h</b> <code>i</code></p>' +
      '<pre>j</pre> <blockquote>k</blockquote> <ul><li>l</li></ul><ol><li>m</li></ol>';

    expect(sanitizeRemoteHtml(html)).toBe(html);
  });

  it('keeps an empty string empty', () => {
    expect(sanitizeRemoteHtml('')).toBe('');
  });
});
