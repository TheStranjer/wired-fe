/**
 * Which addresses the browser may be sent to (WFE-168, WFE-169): an answer
 * from an instance says where to go next, but a `javascript:` or `data:` URL
 * from a hostile or confused answer must never be navigated to, nor shown as
 * a link. Pure.
 */

/** {@link value} as an absolute http(s) URL string, or null. */
export function webUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
