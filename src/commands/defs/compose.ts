/**
 * `/compose [text]` (alias `/c`; decision 6, WFE-125): open the composer
 * overlay for a long post, filled with the text it was given. The box itself
 * is the app's (src/app/ComposerOverlay); the command only asks for it through
 * {@link CommandContext.openComposer}. With no argument the composer opens
 * empty — the command line moves its own plain text in when the chord opens
 * it (insert `Ctrl+e`, navigation `c`).
 */

import type { CommandBinding, CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The one outcome: the box is open, whatever it was filled with. */
const OK: CommandOutcome = { ok: true };

/** `Ctrl+e` while typing, `c` while navigating: both ask for the composer. */
const BINDINGS: readonly CommandBinding[] = [
  { mode: 'insert', chord: 'Ctrl+e', args: '' },
  { mode: 'navigation', chord: 'c', args: '' },
];

/** Open the composer with the raw argument text, trimmed. */
function handle(args: string, context: CommandContext): CommandOutcome {
  context.openComposer(args.trim());
  return OK;
}

/** The `/compose` (alias `/c`) definition. */
export const command: CommandDefinition = {
  name: 'compose',
  aliases: ['c'],
  usage: '/compose [text]',
  summary: 'Open the composer for a long post',
  run: async (args, context) => await Promise.resolve(handle(args, context)),
  bindings: BINDINGS,
};
