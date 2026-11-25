/**
 * `/quote [label] <text>` (decision 6, WBE-91): post a new status that quotes
 * an existing one. The post resolves the way the other post commands resolve
 * theirs — a leading label names a post of the active window's scrollback,
 * otherwise the navigation selection stands, and a boost quotes its original —
 * and the text is everything left over. The instance must carry the acting
 * account's `quotePosting` flag (decision 5); where it does not, the command
 * refuses before anything is posted. The draft goes to
 * {@link CommandContext.post} with the quoted post's id and the error string
 * the window's post handler answers with comes back as the command's failure;
 * success prints `❝ quoted [a3]`, naming the line the window shows. `Shift+r`
 * prefills the line with the selected post's label; type the comment and
 * Enter sends it.
 */

import { requireFeature } from '../../capabilities/requireFeature';
import { OK, fail } from '../outcome';
import { targetLabel } from '../statusLabel';
import { resolveStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** How to call the command; echoed when there is no text to post. */
const USAGE = '/quote [label] <text>';

/** Resolve the quoted post, gate on the capability, post the text, report. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const quoting = requireFeature(context, target.value.accountKey, 'quotePosting');
  if (!quoting.ok) {
    return fail(quoting.error);
  }
  const text = target.value.rest.trim();
  if (text === '') {
    return fail(`Usage: ${USAGE}`);
  }
  const error = await context.post({ text, quoteId: target.value.status.id });
  if (error !== null) {
    return fail(error);
  }
  context.print(`❝ quoted ${targetLabel(context, target.value.status)}`);
  return OK;
}

/** The `/quote` definition. */
export const command: CommandDefinition = {
  name: 'quote',
  usage: USAGE,
  summary: 'Quote a post with a new one',
  requires: 'quotePosting',
  run: handle,
  bindings: [{ mode: 'navigation', chord: 'Shift+r', args: '{label}', prefill: true }],
};
