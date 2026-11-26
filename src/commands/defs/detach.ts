/**
 * `/detach` (decision 6, WFE-126): drop everything waiting for the next post.
 * Nothing uploaded stays attached — the files are the instance's by then, but
 * this post will not name them. Arguments are ignored; the whole pending list
 * is the only target. Already-uploaded posts are untouched.
 */

import { t } from '../../i18n/translate';
import { OK, contextRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Empty the pending list and echo the confirmation, the way /dm echoes a send. */
function handle(context: CommandContext): CommandOutcome {
  context.attachments.clear();
  context.print(t('commands.defs.detach.cleared'));
  return OK;
}

/** The `/detach` definition. */
export const command: CommandDefinition = {
  name: 'detach',
  usage: '/detach',
  get summary(): string {
    return t('commands.defs.detach.summary');
  },
  run: contextRun(handle),
};
