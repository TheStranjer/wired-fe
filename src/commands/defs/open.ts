/**
 * `/open` (decision 6): send a link to the browser. A first argument that
 * carries a URL scheme is the link itself, so `/open https://example.org/a`
 * needs no target and no login. Anything else resolves the post target the way
 * the other post commands do (decision 6): a leading label names a post of the
 * active window's scrollback, otherwise the navigation selection stands, and a
 * boost opens its original. The link is the post's `url ?? uri`. Only http(s)
 * ever reaches the browser, typed argument or backend uri alike: a `javascript:`
 * link in the scrollback is hostile, and so the command refuses it.
 */

import type { Status } from '../../api/schemas/status';
import { syncRun } from '../outcome';
import { resolveStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The link was handed to the browser. */
const OK: CommandOutcome = { ok: true };

/** Shown for any link that is not http(s), however it arrived. */
const NOT_HTTP: CommandOutcome = {
  ok: false,
  message: 'Only http(s) links can be opened',
};

/** A first word that carries a URL scheme: `https:`, `javascript:`, `ftp:`. */
const SCHEMED = /^[a-z][a-z0-9+.-]*:/iu;

/** The schemes a browser may be sent to. */
const HTTP = /^https?:\/\//iu;

/** Where a post links: its web page, or its canonical id when it has none. */
function linkOf(status: Status): string {
  return status.url ?? status.uri;
}

/** Open {@link url} in a new tab, giving the new page no handle back here. */
function openUrl(url: string): CommandOutcome {
  window.open(url, '_blank', 'noopener,noreferrer');
  return OK;
}

/** The trimmed argument's first word; `''` when there are no arguments. */
function firstWord(args: string): string {
  const [word = ''] = args.trim().split(/\s+/u);
  return word;
}

/** Open the typed URL, or the link of the post the argument names. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const word = firstWord(args);
  if (SCHEMED.test(word)) {
    return HTTP.test(word) ? openUrl(word) : NOT_HTTP;
  }
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return { ok: false, message: target.error };
  }
  const link = linkOf(target.value.status);
  return HTTP.test(link) ? openUrl(link) : NOT_HTTP;
}

/** The `/open` definition. */
export const command: CommandDefinition = {
  name: 'open',
  usage: '/open [label | url]',
  summary: 'Open a post or URL in a new browser tab',
  run: syncRun(handle),
  bindings: [{ mode: 'navigation', chord: 'o', args: '' }],
};
