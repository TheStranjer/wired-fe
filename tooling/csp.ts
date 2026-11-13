/**
 * Content Security Policy for the built page.
 *
 * WiredFE keeps OAuth tokens in browser storage, so a tight CSP is its main
 * defence against XSS: scripts and styles only from the page's own origin,
 * no inline script, no plugins, no third-party origins. Remote media (avatars,
 * attachments, emoji) comes from arbitrary instances, so images and media
 * may load from any https origin.
 *
 * `connect-src` is derived from the build's instance mode (decision 3): the
 * origins the bundle is allowed to reach, each with its `ws(s)://` twin for
 * the streaming API.
 */
import type { Plugin } from 'vite';

import type { InstancesConfig } from '../src/config/schema.ts';

/** One CSP directive: its name and its source list. */
type Directive = readonly [name: string, sources: readonly string[]];

/** The `wss://`/`ws://` twin of an `https://`/`http://` origin; others pass through. */
function wsOrigin(origin: string): string {
  return origin.replace(/^https:\/\//u, 'wss://').replace(/^http:\/\//u, 'ws://');
}

/**
 * The `connect-src` sources of one instance mode (decision 3): always the page's
 * own origin, plus the instances the build may talk to and their websocket twins.
 */
export function connectSources(instances: InstancesConfig): readonly string[] {
  switch (instances.mode) {
    case 'same-origin':
      return ["'self'"];
    case 'fixed':
      return ["'self'", instances.origin, wsOrigin(instances.origin)];
    case 'list':
      return ["'self'", ...instances.origins.flatMap((origin) => [origin, wsOrigin(origin)])];
    case 'open':
      return ["'self'", 'https:', 'wss:'];
  }
}

/** The directives, in the order they are written into the policy. */
function directives(instances: InstancesConfig): readonly Directive[] {
  return [
    ['default-src', ["'none'"]],
    ['script-src', ["'self'"]],
    ['style-src', ["'self'"]],
    ['img-src', ["'self'", 'https:', 'data:', 'blob:']],
    ['media-src', ["'self'", 'https:', 'blob:']],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connectSources(instances)],
    ['manifest-src', ["'self'"]],
    ['base-uri', ["'none'"]],
    ['form-action', ["'none'"]],
    ['object-src', ["'none'"]],
  ];
}

/** The policy as one header/meta value. */
export function contentSecurityPolicy(instances: InstancesConfig): string {
  return directives(instances)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/** The tag the policy is inserted after: it must precede every resource. */
const CHARSET_META = '<meta charset="utf-8" />';

/**
 * Insert the policy as a `<meta http-equiv>` tag directly after the charset
 * declaration, ahead of every script and stylesheet it governs.
 */
export function withPolicy(html: string, instances: InstancesConfig): string {
  if (!html.includes(CHARSET_META)) {
    throw new Error(`index.html must contain ${CHARSET_META}`);
  }
  const policy = contentSecurityPolicy(instances);
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
  return html.replace(CHARSET_META, `${CHARSET_META}\n    ${meta}`);
}

/**
 * Vite plugin that writes the policy into the built `index.html`. Build
 * only: the dev server needs inline scripts for hot reload.
 */
export function cspPlugin(instances: InstancesConfig): Plugin {
  return {
    name: 'wired-csp',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: (html) => withPolicy(html, instances) },
  };
}
