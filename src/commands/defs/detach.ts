/**
 * `/detach` (decision 6, WFE-126): drop everything waiting for the next post.
 * Nothing uploaded stays attached — the files are the instance's by then, but
 * this post will not name them. Arguments are ignored; the whole pending list
 * is the only target. Already-uploaded posts are untouched.
 */

import { OK, contextRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Empty the pending list and echo the confirmation, the way /dm echoes a send. */
function handle(context: CommandContext): CommandOutcome {
  context.attachments.clear();
  context.print('attachments cleared');
  return OK;
}

/** The `/detach` definition. */
export const command: CommandDefinition = {
  name: 'detach',
  usage: '/detach',
  summary: 'Drop every attachment waiting for the next post',
  run: contextRun(handle),
};
