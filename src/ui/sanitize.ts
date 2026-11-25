/**
 * The one sanitizer for remote HTML (AGENTS.md Security, decision 10):
 * status, bio and display-name markup arrives from arbitrary servers and is
 * hostile, so it must never reach the DOM except through this module.
 *
 * `sanitizeRemoteHtml` returns an HTML string restricted to a small set of
 * formatting elements, with `href` reduced to absolute http(s) URLs, class
 * names reduced to the fediverse tokens the UI styles, and every surviving
 * link forced to open safely. DOMPurify runs on a dedicated `window`
 * instance so these hooks cannot leak to, or be changed by, any other user
 * of the library.
 */

import createDOMPurify from 'dompurify';
import type { Config } from 'dompurify';

import { isHttpUrl } from '../lib/url';

/** The only elements remote HTML may keep; every other element is removed. */
const ALLOWED_TAGS: readonly string[] = [
  'p',
  'br',
  'a',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
];

/** The only attributes remote HTML may keep; the hook restricts them per element. */
const ALLOWED_ATTRIBUTES: readonly string[] = ['href', 'class'];

/**
 * Elements removed together with their content, on top of DOMPurify's own
 * list, which already covers script, style, iframe, svg, math and template.
 */
const FORBIDDEN_CONTENTS: readonly string[] = ['embed', 'object'];

/**
 * The class backends put on the plain-text "RE:/RT: link" fallback of a quote
 * post (Mastodon, Wired, Pleroma, Misskey). It survives sanitizing so that
 * {@link sanitizeRemoteHtml} can drop it when the quote renders as a card.
 */
const QUOTE_FALLBACK_CLASS = 'quote-inline';

/** The class tokens the UI styles: mentions, hashtags, microformats, ellipses. */
const ALLOWED_CLASS_TOKENS: readonly string[] = [
  'mention',
  'hashtag',
  'u-url',
  'h-card',
  'invisible',
  'ellipsis',
  QUOTE_FALLBACK_CLASS,
];

/** Whitespace between class tokens. */
const CLASS_SEPARATOR = /\s+/u;

/** The `rel` of every surviving link: no credit, no opener, no referrer. */
const LINK_REL = 'nofollow noopener noreferrer';

/** The DOMPurify configuration: tag and attribute allowlists only. */
const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: [...ALLOWED_TAGS],
  ALLOWED_ATTR: [...ALLOWED_ATTRIBUTES],
  ADD_FORBID_CONTENTS: [...FORBIDDEN_CONTENTS],
};

/** Keeps only the `allowed` tokens (default {@link ALLOWED_CLASS_TOKENS}) of a class attribute. */
function filterClassTokens(
  element: Element,
  allowed: readonly string[] = ALLOWED_CLASS_TOKENS,
): void {
  const value = element.getAttribute('class');
  if (value === null) {
    return;
  }
  const kept = value.split(CLASS_SEPARATOR).filter((token) => allowed.includes(token));
  if (kept.length === 0) {
    element.removeAttribute('class');
  } else {
    element.setAttribute('class', kept.join(' '));
  }
}

/**
 * Applies the per-element attribute policy once DOMPurify has finished:
 * `href` only on `a` and only when it is an absolute http(s) URL, `class`
 * only on `a` and `span` with known tokens (and on `p` only the quote fallback), and every link that
 * kept its `href` gets `rel` and `target` added.
 */
function applyAttributePolicy(element: Element): void {
  if (element.tagName === 'A') {
    const href = element.getAttribute('href');
    if (href === null || !isHttpUrl(href)) {
      element.removeAttribute('href');
    } else {
      element.setAttribute('rel', LINK_REL);
      element.setAttribute('target', '_blank');
    }
    filterClassTokens(element);
    return;
  }
  element.removeAttribute('href');
  if (element.tagName === 'P') {
    filterClassTokens(element, [QUOTE_FALLBACK_CLASS]);
  } else if (element.tagName === 'SPAN') {
    filterClassTokens(element);
  } else {
    element.removeAttribute('class');
  }
}

/** Dedicated instance: these hooks are its own, never the global default. */
const purifier = createDOMPurify(window);

purifier.addHook('afterSanitizeAttributes', applyAttributePolicy);

/** Options of {@link sanitizeRemoteHtml}. */
export type SanitizeOptions = {
  /** Remove the quote's "RE:/RT: link" fallback; set when a quote card shows. */
  readonly dropQuoteFallback?: boolean;
};

/**
 * Sanitizes hostile remote HTML into an HTML string that is safe to render:
 * only the {@link ALLOWED_TAGS}, only the {@link ALLOWED_ATTRIBUTES} the
 * hook accepts for that element, {@link ALLOWED_CLASS_TOKENS} class tokens,
 * absolute http(s) links only, and `rel`/`target` on every link that keeps
 * an `href`. With `dropQuoteFallback`, every element of class `quote-inline`
 * is removed with its content, so a quote card is not preceded by the same
 * link as text.
 */
export function sanitizeRemoteHtml(html: string, options: SanitizeOptions = {}): string {
  if (options.dropQuoteFallback !== true) {
    return purifier.sanitize(html, SANITIZE_CONFIG);
  }
  const body = purifier.sanitize(html, { ...SANITIZE_CONFIG, RETURN_DOM: true });
  if (!(body instanceof Element)) {
    return '';
  }
  for (const fallback of body.querySelectorAll(`.${QUOTE_FALLBACK_CLASS}`)) {
    fallback.remove();
  }
  return body.innerHTML;
}
