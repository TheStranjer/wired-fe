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

/** The class tokens the UI styles: mentions, hashtags, microformats, ellipses. */
const ALLOWED_CLASS_TOKENS: readonly string[] = [
  'mention',
  'hashtag',
  'u-url',
  'h-card',
  'invisible',
  'ellipsis',
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

/** Keeps only the {@link ALLOWED_CLASS_TOKENS} of a class attribute. */
function filterClassTokens(element: Element): void {
  const value = element.getAttribute('class');
  if (value === null) {
    return;
  }
  const kept = value.split(CLASS_SEPARATOR).filter((token) => ALLOWED_CLASS_TOKENS.includes(token));
  if (kept.length === 0) {
    element.removeAttribute('class');
  } else {
    element.setAttribute('class', kept.join(' '));
  }
}

/**
 * Applies the per-element attribute policy once DOMPurify has finished:
 * `href` only on `a` and only when it is an absolute http(s) URL, `class`
 * only on `a` and `span` and only with known tokens, and every link that
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
  if (element.tagName === 'SPAN') {
    filterClassTokens(element);
  } else {
    element.removeAttribute('class');
  }
}

/** Dedicated instance: these hooks are its own, never the global default. */
const purifier = createDOMPurify(window);

purifier.addHook('afterSanitizeAttributes', applyAttributePolicy);

/**
 * Sanitizes hostile remote HTML into an HTML string that is safe to render:
 * only the {@link ALLOWED_TAGS}, only the {@link ALLOWED_ATTRIBUTES} the
 * hook accepts for that element, {@link ALLOWED_CLASS_TOKENS} class tokens,
 * absolute http(s) links only, and `rel`/`target` on every link that keeps
 * an `href`.
 */
export function sanitizeRemoteHtml(html: string): string {
  return purifier.sanitize(html, SANITIZE_CONFIG);
}
