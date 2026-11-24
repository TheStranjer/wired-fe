/**
 * Where an authorization answer may send the browser (WFE-168): the instance
 * says where to go next, but a `javascript:` or `data:` URL from a hostile or
 * confused answer must never be navigated to. Only `http:` and `https:` URLs
 * and the out-of-band URN are accepted. Pure.
 */

import { webUrl } from '../../lib/webUrl';

/** The redirect URI of an app that wants the code shown instead of delivered. */
export const OOB_URI = 'urn:ietf:wg:oauth:2.0:oob';

/** Where an answer sends the browser: to a URL, or nowhere (the out-of-band URN). */
export type RedirectTarget =
  { readonly kind: 'url'; readonly url: string } | { readonly kind: 'oob' };

/** The target {@link uri} stands for, or null when it is neither an http(s) URL nor the out-of-band URN. */
export function redirectTarget(uri: string): RedirectTarget | null {
  if (uri === OOB_URI) {
    return { kind: 'oob' };
  }
  const url = webUrl(uri);
  return url === null ? null : { kind: 'url', url };
}
