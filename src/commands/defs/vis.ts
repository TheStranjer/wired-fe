/**
 * `/vis [public|unlisted|private|direct|local]` (decision 6, alias
 * `/visibility`): show or set the audience new posts aim at by default. With no
 * argument it only prints the current default (AGENTS.md: everything reachable
 * by command, hotkey and click — this is the command half of a setting the
 * composer fills from); with one accepted word it dispatches the `settings`
 * action and prints the new default back. `followers` reads as `private`, the
 * Mastodon name for the same audience. `local` is Wired's instance-only
 * audience and needs the active account's `localOnlyPosts` capability
 * (decision 5); without one the command refuses. Moving settings in and out of
 * storage is the later persistence ticket.
 */

import type { Visibility } from '../../api/schemas/status';
import { type Capabilities, hasFeature } from '../../capabilities/capabilities';
import { capabilitiesFor } from '../../state/selectors';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's one form; a refused argument echoes it. */
const USAGE = '/vis [public|unlisted|private|direct|local]';

/** The refusal of `local` to an instance that cannot carry it. */
const NO_LOCAL = 'This server has no local-only posts';

/** The default is shown, or the settings action is on its way to the reducer. */
const OK: CommandOutcome = { ok: true };

/** The words the command takes, and the audience each names; may be none. */
const AUDIENCES: ReadonlyMap<string, Visibility> = new Map([
  ['public', 'public'],
  ['unlisted', 'unlisted'],
  ['private', 'private'],
  ['followers', 'private'],
  ['direct', 'direct'],
  ['local', 'local'],
]);

/** A failure reporting {@link message}. */
function fail(message: string): CommandOutcome {
  return { ok: false, message };
}

/** The line that answers both showing and setting: what new posts now are. */
function report(context: CommandContext, visibility: Visibility): void {
  context.print(`New posts are ${visibility} by default`);
}

/** Whether an instance with {@link capabilities} serves local-only posts. */
function servesLocal(capabilities: Capabilities | null): boolean {
  return capabilities !== null && hasFeature(capabilities, 'localOnlyPosts');
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
  const active = capabilitiesFor(context.state, context.state.activeAccountKey);
  if (visibility === 'local' && !servesLocal(active)) {
    return fail(NO_LOCAL);
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
  run: async (args, context) => await Promise.resolve(handle(args, context)),
};
