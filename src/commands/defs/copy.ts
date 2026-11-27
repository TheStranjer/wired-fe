/**
 * `/copy` (decision 6, alias `/yank`): put a post's link on the clipboard. The
 * target resolves the way the other post commands resolve theirs: a leading
 * label names a post of the active window's scrollback, otherwise the
 * navigation selection stands, and a boost copies its original (decision 6).
 * The link is WiredFE's permalink for a post of the account's own instance,
 * otherwise the post's `url ?? uri`. A
 * browser that refuses the write — no permission, no clipboard, an insecure
 * context — is answered with a plain refusal, never a false `copied`.
 */

import { t } from '../../i18n/translate';
import { accountByKey } from '../../state/selectors';
import { OK, fail } from '../outcome';
import { currentPage, localPermalink, statusLink } from '../statusLink';
import { resolveStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Shown when the browser rejects the write or has no clipboard at all. */
function unavailable(): CommandOutcome {
  return fail(t('commands.defs.copy.unavailable'));
}

/** Resolve the target, write its link, and print what was copied. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const { status, accountKey } = target.value;
  const account = accountByKey(context.state, accountKey);
  const link = localPermalink(status, account, currentPage()) ?? statusLink(status);
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    return unavailable();
  }
  context.print(t('commands.defs.copy.copied', { link }));
  return OK;
}

/** The `/copy` (alias `/yank`) definition. */
export const command: CommandDefinition = {
  name: 'copy',
  aliases: ['yank'],
  get usage(): string {
    return t('commands.defs.copy.usage');
  },
  get summary(): string {
    return t('commands.defs.copy.summary');
  },
  run: handle,
  bindings: [{ mode: 'navigation', chord: 'y', args: '' }],
};
