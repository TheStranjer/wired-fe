/**
 * `/vis [public|unlisted|private|direct|local]` (decision 6, alias
 * `/visibility`): show or set the audience new posts aim at by default. With no
 * argument it only prints the current default (AGENTS.md: everything reachable
 * by command, hotkey and click — this is the command half of a setting the
 * composer fills from); with one accepted word it dispatches the `settings`
 * action and prints the new default back. `followers` reads as `private`, the
 * Mastodon name for the same audience. `local` is Wired's instance-only
 * audience and needs the active account's `localOnlyPosts` capability
 * (decision 5); without one the command refuses and /help does not list the
 * word (WFE-172). The dispatch reaches storage
 * through the app's settings persistence (WFE-129).
 */

import type { Visibility } from '../../api/schemas/status';
import type { Capabilities } from '../../capabilities/capabilities';
import { requireFeature } from '../../capabilities/requireFeature';
import { availableVisibilities } from '../../capabilities/visibilities';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form; a refused argument echoes it. */
const USAGE = '/vis [public|unlisted|private|direct|local]';

/** The words the command takes, and the audience each names; may be none. */
const AUDIENCES: ReadonlyMap<string, Visibility> = new Map([
  ['public', 'public'],
  ['unlisted', 'unlisted'],
  ['private', 'private'],
  ['followers', 'private'],
  ['direct', 'direct'],
  ['local', 'local'],
]);

/** The usage on a backend with {@link capabilities}: `local` is listed only where it exists. */
function usageFor(capabilities: Capabilities | null): string {
  return `/vis [${availableVisibilities(capabilities).join('|')}]`;
}

/** The line that answers both showing and setting: what new posts now are. */
function report(context: CommandContext, visibility: Visibility): void {
  context.print(`New posts are ${visibility} by default`);
}

/**
 * Do what {@link args} asks: no argument prints the reader's current default,
 * one accepted word makes it the new default — `local` only on a server that
 * has the capability, on the account commands act as — and anything else
 * echoes the usage without touching the state.
 */
function handle(args: string, context: CommandContext): CommandOutcome {
  const word = args.trim();
  if (word === '') {
    report(context, context.state.settings.defaultVisibility);
    return OK;
  }
  const visibility = AUDIENCES.get(word);
  if (visibility === undefined) {
    return fail(`Usage: ${USAGE}`);
  }
  if (visibility === 'local') {
    const local = requireFeature(context, context.state.activeAccountKey, 'localOnlyPosts');
    if (!local.ok) {
      return fail(local.error);
    }
  }
  context.dispatch({ type: 'settings', settings: { defaultVisibility: visibility } });
  report(context, visibility);
  return OK;
}

/** The `/vis` (alias `/visibility`) definition. */
export const command: CommandDefinition = {
  name: 'vis',
  aliases: ['visibility'],
  usage: USAGE,
  summary: 'Show or set the default audience for new posts',
  usageFor,
  run: syncRun(handle),
};
