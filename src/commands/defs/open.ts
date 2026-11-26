/**
 * `/open` (decision 6): send a link to the browser. A first argument that
 * carries a URL scheme is the link itself, so `/open https://example.org/a`
 * needs no target and no login. Anything else resolves the post target the way
 * the other post commands do (decision 6): a leading label names a post of the
 * active window's scrollback, otherwise the navigation selection stands, and a
 * boost opens its original. A post of the account's own instance opens its
 * thread window, as `/thread` does; any other post opens its `url ?? uri`.
 * Only http(s)
 * ever reaches the browser, typed argument or backend uri alike: a `javascript:`
 * link in the scrollback is hostile, and so the command refuses it.
 */

import { t } from '../../i18n/translate';
import { accountByKey } from '../../state/selectors';
import { OK, fail, syncRun } from '../outcome';
import { localPermalink, statusLink } from '../statusLink';
import { type StatusTarget, resolveStatusTarget } from '../targets';
import { openThreadWindow } from '../threadWindow';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';
import { splitFirstWord } from '../words';

/** The refusal for any link that is not http(s), however it arrived. */
function notHttp(): CommandOutcome {
  return fail(t('commands.defs.open.not_http'));
}

/** A first word that carries a URL scheme: `https:`, `javascript:`, `ftp:`. */
const SCHEMED = /^[a-z][a-z0-9+.-]*:/iu;

/** The schemes a browser may be sent to. */
const HTTP = /^https?:\/\//iu;

/** Open {@link url} in a new tab, giving the new page no handle back here. */
function openUrl(url: string): CommandOutcome {
  window.open(url, '_blank', 'noopener,noreferrer');
  return OK;
}

/** Open a local post's thread window, any other post's link in a tab. */
function openPost(target: StatusTarget, context: CommandContext): CommandOutcome {
  const account = accountByKey(context.state, target.accountKey);
  if (localPermalink(target.status, account, window.location) !== null) {
    return openThreadWindow(context, target);
  }
  const link = statusLink(target.status);
  return HTTP.test(link) ? openUrl(link) : notHttp();
}

/** Open the typed URL, or the link of the post the argument names. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word] = splitFirstWord(args);
  if (SCHEMED.test(word)) {
    return HTTP.test(word) ? openUrl(word) : notHttp();
  }
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  return openPost(target.value, context);
}

/** The `/open` definition. */
export const command: CommandDefinition = {
  name: 'open',
  get usage(): string {
    return t('commands.defs.open.usage');
  },
  get summary(): string {
    return t('commands.defs.open.summary');
  },
  run: syncRun(handle),
  bindings: [{ mode: 'navigation', chord: 'o', args: '' }],
};
