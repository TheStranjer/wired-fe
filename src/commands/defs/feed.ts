/**
 * `/feed` (decision 6 and 14): make and manage saved feeds, each a merge of
 * sources — `<who>:<source>`, `*:home` for every signed-in account,
 * `@me@host:tag:rust` for one — and open their windows. `/feed` or `/feed
 * list` prints every feed with its sources; `new`, `add`, `rm`, `rename` and
 * `delete` change them (and `delete` closes the windows showing the feed);
 * `open <name>` — or just `/feed <name>` — shows the feed's window, or
 * activates the one that already does. Feeds live in the settings, so changes
 * are saved and synced with them. The subcommands are in src/commands/feedChange
 * and src/commands/feedManage; `/vsplit feed <name>` reads `open` too
 * (src/commands/viewSpec).
 */

import { wordsOf } from '../../lib/words';
import { FEED_SUBCOMMANDS } from '../feedArgs';
import { feedAdd, feedNew, feedRemove } from '../feedChange';
import { feedDelete, feedList, feedOpen, feedRename } from '../feedManage';
import { syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';
import { splitFirstWord } from '../words';

/** What one subcommand does with the words after it. */
type Subcommand = (words: readonly string[], context: CommandContext) => CommandOutcome;

/** The subcommands by the word that names them; their names are {@link FEED_SUBCOMMANDS}. */
const SUBCOMMANDS: ReadonlyMap<string, Subcommand> = new Map<string, Subcommand>([
  ['list', feedList],
  ['new', feedNew],
  ['add', feedAdd],
  ['rm', feedRemove],
  ['rename', feedRename],
  ['delete', feedDelete],
  ['open', feedOpen],
]);

/** The command's forms: /help shows them. */
const USAGE =
  '/feed [list] | /feed <name> | /feed new|add|rm <name> <source>… | /feed rename <old> <new> | /feed delete <name>';

/** Run the subcommand the first word names; a first word that names none is a feed to open. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [first, rest] = splitFirstWord(args);
  if (first === '') {
    return feedList([], context);
  }
  const sub = SUBCOMMANDS.get(first.toLowerCase());
  return sub === undefined ? feedOpen(wordsOf(args), context) : sub(wordsOf(rest), context);
}

/** The `/feed` definition. */
export const command: CommandDefinition = {
  name: 'feed',
  usage: USAGE,
  summary: `Make, change and open feeds (${FEED_SUBCOMMANDS.join(', ')})`,
  run: syncRun(handle),
};
