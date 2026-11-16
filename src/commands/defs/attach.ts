/**
 * `/attach [alt text]` (alias `/att`; decision 6, WFE-126): choose files to
 * put on the next post. The command only opens the app's file dialog and
 * carries its argument text along as the alt description for whatever gets
 * chosen — the upload, the per-instance limit and the pending list are the
 * app's (src/app/useAttachments), reachable by mouse through the very dialog.
 */

import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The dialog is opening. */
const OK: CommandOutcome = { ok: true };

/** Open the file dialog asking it to describe what it picks. */
function handle(args: string, context: CommandContext): CommandOutcome {
  context.attachments.pick(args.trim());
  return OK;
}

/** The `/attach` (alias `/att`) definition. */
export const command: CommandDefinition = {
  name: 'attach',
  aliases: ['att'],
  usage: '/attach [alt text]',
  summary: 'Attach media to your next post',
  run: async (args, context) => await Promise.resolve(handle(args, context)),
};
