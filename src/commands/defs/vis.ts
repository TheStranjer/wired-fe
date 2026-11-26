/**
 * `/vis [public|unlisted|private|direct|local] [text]` (decision 6, alias
 * `/visibility`): show or set the audience new posts aim at by default, or post
 * one line with an audience of its own. With no argument it only prints the
 * current default (AGENTS.md: everything reachable by command, hotkey and
 * click — this is the command half of a setting the composer fills from); with
 * one accepted word it dispatches the `settings` action and prints the new
 * default back; with a word and text it posts the text once through
 * {@link CommandContext.post} with that `visibility` on the draft, leaves the
 * default alone and prints nothing on success, an error string from the post
 * coming back as the command's failure. `followers` reads as `private`, the
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
import { OK, fail } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';
import { splitFirstWord } from '../words';

/** The command's one form; a refused argument echoes it. */
const USAGE = '/vis [public|unlisted|private|direct|local] [text]';

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
  return `/vis [${availableVisibilities(capabilities).join('|')}] [text]`;
}

/** The line that answers both showing and setting: what new posts now are. */
function report(context: CommandContext, visibility: Visibility): void {
  context.print(`New posts are ${visibility} by default`);
}

/** The audience a word names, or the {@link error} that refuses it. */
type Audience =
  | { readonly ok: true; readonly visibility: Visibility }
  | { readonly ok: false; readonly error: string };

/**
 * The audience {@link word} names: an unknown word is refused with the usage,
 * and `local` only passes on a server that has the capability, on the account
 * commands act as.
 */
function audienceFor(word: string, context: CommandContext): Audience {
  const visibility = AUDIENCES.get(word);
  if (visibility === undefined) {
    return { ok: false, error: `Usage: ${USAGE}` };
  }
  if (visibility === 'local') {
    const local = requireFeature(context, context.state.activeAccountKey, 'localOnlyPosts');
    return local.ok ? { ok: true, visibility } : { ok: false, error: local.error };
  }
  return { ok: true, visibility };
}

/**
 * Do what {@link args} asks: no argument prints the reader's current default,
 * one accepted word makes it the new default, a word with text posts that text
 * once with the audience, and anything else echoes the usage without touching
 * the state.
 */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const [word, text] = splitFirstWord(args);
  if (word === '') {
    report(context, context.state.settings.defaultVisibility);
    return OK;
  }
  const audience = audienceFor(word, context);
  if (!audience.ok) {
    return fail(audience.error);
  }
  const { visibility } = audience;
  if (text !== '') {
    const error = await context.post({ text, visibility });
    return error === null ? OK : fail(error);
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
  summary: 'Show or set the default audience, or post one line with an audience',
  usageFor,
  run: handle,
};
