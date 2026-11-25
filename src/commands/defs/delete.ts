/**
 * `/delete` (decision 6, alias `/del`): take one of this account's own posts
 * away. The target resolves the way the other post commands resolve theirs
 * (decision 6) — a leading label names a post of the active window's
 * scrollback, otherwise the navigation selection stands — and only what the
 * window's own account wrote can go: a boost is the boosted author's post.
 * `Shift+d` prefills the line with the selected post's label, so Enter on the
 * filled `/delete a3` is the confirmation; there is no dialog in an IRC client.
 * A click on the card's `⋯` → Delete does ask in a dialog instead (WFE-266),
 * then runs the same line.
 * The instance answers with the status as it was; the id is what every
 * scrollback is told to drop, boost lines and all, and the window prints the
 * label of the line that showed it.
 */

import { deleteStatus } from '../../api/endpoints/statusWrite';
import { describeApiError } from '../../api/errors';
import { OK, fail } from '../outcome';
import { printedLabel } from '../statusLabel';
import { type StatusTarget, resolveOwnStatusTarget } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Delete {@link target}'s post and tell every scrollback its id is gone. */
async function remove(target: StatusTarget, context: CommandContext): Promise<CommandOutcome> {
  const { id } = target.status;
  const deleted = await deleteStatus(target.session, id);
  if (!deleted.ok) {
    return fail(describeApiError(deleted.error));
  }
  context.dispatch({ type: 'statusDeleted', id });
  context.print(`✗ deleted [${printedLabel(context, target.status)}]`);
  return OK;
}

/** Resolve this account's own post, then delete it; any refusal comes back instead. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const target = resolveOwnStatusTarget(args, context, 'delete');
  return target.ok ? await remove(target.value, context) : fail(target.error);
}

/** The `/delete` (alias `/del`) definition. */
export const command: CommandDefinition = {
  name: 'delete',
  aliases: ['del'],
  usage: '/delete [label]',
  summary: 'Delete one of your own posts',
  run: async (args, context) => await handle(args, context),
  bindings: [{ mode: 'navigation', chord: 'Shift+d', args: '{label}', prefill: true }],
};
