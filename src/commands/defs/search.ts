/**
 * `/search <query>` (alias `/s`; decision 6, AGENTS.md "Windows, like IRC
 * buffers"): search the active account's instance and show the answer as its
 * own window, the way an IRC client answers `/msg * search`. The argument is
 * the query, used verbatim (only the surrounding whitespace comes off) so a
 * phrase or a `#tag` or an `@handle` searches for exactly what was typed; an
 * empty argument echoes the usage. The window is opened for the active account
 * targeted at that query and titled `search/<query truncated to twenty>` — the
 * full query is the target, so the same search run twice activates the window
 * that already shows it (src/windows/reducer). ./useSearch then fills it with
 * the accounts, tags and posts the instance found (src/features/search).
 * Without an account there is no instance to search, so after the query is
 * checked the command says what to type instead.
 */

import { activeAccount } from '../../state/selectors';
import { NOT_LOGGED_IN, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's grammar: /help shows it, a bare argument echoes it. */
const USAGE = '/search <query>';

/** How many query characters the window title shows; the target keeps it all. */
const TITLE_QUERY_LENGTH = 20;

/** The search window is open, or was already and is active now. */
const OK: CommandOutcome = { ok: true };

/** The window's title: `search/` and the query cut off at {@link TITLE_QUERY_LENGTH}. */
function searchTitle(query: string): string {
  return `search/${query.slice(0, TITLE_QUERY_LENGTH)}`;
}

/** Check the query and account, then ask the window list for the active account's search window. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const query = args.trim();
  if (query === '') {
    return fail(`Usage: ${USAGE}`);
  }
  const account = activeAccount(context.state);
  if (account === null) {
    return NOT_LOGGED_IN;
  }
  context.dispatchWindows({
    type: 'open',
    ref: { kind: 'search', accountKey: account.key, target: query },
    title: searchTitle(query),
  });
  return OK;
}

/** The `/search` (alias `/s`) definition. */
export const command: CommandDefinition = {
  name: 'search',
  aliases: ['s'],
  usage: USAGE,
  summary: 'Search accounts, posts and tags',
  run: syncRun(handle),
};
