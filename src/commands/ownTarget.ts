/**
 * The target resolver of the commands that may change only the acting
 * account's own posts (`/edit`, `/delete`): {@link resolveStatusTarget}'s
 * resolution (./targets) with the author check on top.
 */

import { type StatusTarget, resolveStatusTarget } from './targets';
import type { CommandContext } from './types';
import { t } from '../i18n/translate';
import { type Result, err } from '../lib/result';
import { accountByKey } from '../state/selectors';

/** Which verb the own-post commands refuse with: the one the reader typed. */
export type OwnCommand = 'delete' | 'edit';

/**
 * The post {@link args} names, kept only when the acting account authored it:
 * {@link resolveStatusTarget}'s resolution — a leading label, else the
 * navigation selection, a boost unwrapped to its original — with the author
 * check on top. A boost is the boosted author's post and not the booster's to
 * change, and a status of an account no longer in the store is nobody's here;
 * either refuses in the wording of {@link verb}, which is what a status window
 * line has to say on its own.
 */
export function resolveOwnStatusTarget(
  args: string,
  context: CommandContext,
  verb: OwnCommand,
): Result<StatusTarget, string> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return target;
  }
  const accountId = accountByKey(context.state, target.value.accountKey)?.accountId;
  return target.value.status.account.id === accountId
    ? target
    : err(t('commands.own_posts_only', { verb }));
}
