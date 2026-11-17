/**
 * `/thread [label]` (decision 6, AGENTS.md "`t` thread"): open one post's
 * conversation in its own window. The target resolves like the other post
 * commands' (src/commands/targets): a leading label names a post of the
 * active window's scrollback, otherwise the navigation selection stands, and
 * a boost opens its original. The window list is asked for a `thread` window
 * owned by the acting account and targeted at the status id — opening the
 * same post twice activates the window that already shows it — titled
 * `thread/<label or id>`: the label of the line the command named, or the
 * bare id when the line never carried one. ./useThread then fetches the
 * conversation and typing into the window answers the post (src/features/
 * thread). Whatever the resolver refuses — no account, nothing selected — is
 * what the command says back.
 */

import type { Status } from '../../api/schemas/status';
import { fail } from '../outcome';
import { resolveStatusTarget, targetLabel } from '../targets';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The thread window is open, or was already and is active now. */
const OK: CommandOutcome = { ok: true };

/** The window's title: `thread/` and the target's label, or its id alone. */
function threadTitle(context: CommandContext, status: Status): string {
  return `thread/${targetLabel(context, status).slice(1, -1)}`;
}

/** Resolve the post, then ask the window list for its thread window. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const target = resolveStatusTarget(args, context);
  if (!target.ok) {
    return fail(target.error);
  }
  const { status, accountKey } = target.value;
  context.dispatchWindows({
    type: 'open',
    ref: { kind: 'thread', accountKey, target: status.id },
    title: threadTitle(context, status),
  });
  return OK;
}

/** The `/thread` definition. */
export const command: CommandDefinition = {
  name: 'thread',
  aliases: [],
  usage: '/thread [label]',
  summary: "Open a post's thread window",
  run: async (args, context) => await Promise.resolve(handle(args, context)),
  bindings: [{ mode: 'navigation', chord: 't', args: '' }],
};
