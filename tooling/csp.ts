/**
 * Content Security Policy for the built page.
 *
 * WiredFE keeps OAuth tokens in browser storage, so a tight CSP is its main
 * defence against XSS: scripts and styles only from the page's own origin,
 * no inline script, no plugins, no third-party origins. Remote media (avatars,
 * attachments, emoji) comes from arbitrary instances, so images and media
 * may load from any https origin.
 *
 * `connect-src` is `'self'` until the build-config ticket derives it from the
 * configured instance mode (fixed origins, a list, or any https/wss origin).
 */
import type { Plugin } from 'vite';

/** One CSP directive: its name and its source list. */
type Directive = readonly [name: string, sources: readonly string[]];

/** The directives, in the order they are written into the policy. */
const DIRECTIVES: readonly Directive[] = [
  ['default-src', ["'none'"]],
  ['script-src', ["'self'"]],
  ['style-src', ["'self'"]],
  ['img-src', ["'self'", 'https:', 'data:', 'blob:']],
  ['media-src', ["'self'", 'https:', 'blob:']],
  ['font-src', ["'self'", 'data:']],
  ['connect-src', ["'self'"]],
  ['manifest-src', ["'self'"]],
  ['base-uri', ["'none'"]],
  ['form-action', ["'none'"]],
  ['object-src', ["'none'"]],
];

/** The policy as one header/meta value. */
export function contentSecurityPolicy(): string {
  return DIRECTIVES.map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ');
}

/** The tag the policy is inserted after: it must precede every resource. */
const CHARSET_META = '<meta charset="utf-8" />';

/**
 * Insert the policy as a `<meta http-equiv>` tag directly after the charset
 * declaration, ahead of every script and stylesheet it governs.
 */
export function withPolicy(html: string): string {
  if (!html.includes(CHARSET_META)) {
    throw new Error(`index.html must contain ${CHARSET_META}`);
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy()}" />`;
  return html.replace(CHARSET_META, `${CHARSET_META}\n    ${meta}`);
}

/**
 * Vite plugin that writes the policy into the built `index.html`. Build
 * only: the dev server needs inline scripts for hot reload.
 */
export function cspPlugin(): Plugin {
  return {
    name: 'wired-csp',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: withPolicy },
  };
}
