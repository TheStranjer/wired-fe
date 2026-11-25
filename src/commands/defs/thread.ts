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

import { placedRun } from '../openWindowRun';
import { fail, syncRun } from '../outcome';
import { resolveStatusTarget } from '../targets';
import { openThreadWindow } from '../threadWindow';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Resolve the post, then ask the window list for its thread window. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const target = resolveStatusTarget(args, context);
  return target.ok ? openThreadWindow(context, target.value) : fail(target.error);
}

/** The `/thread` definition. */
export const command: CommandDefinition = {
  name: 'thread',
  usage: '/thread [label]',
  summary: "Open a post's thread window",
  run: placedRun(syncRun(handle)),
  bindings: [{ mode: 'navigation', chord: 't', args: '' }],
};
