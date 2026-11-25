/**
 * `/sync` (decision 17, decision 6): which account's server holds the synced
 * desk. Bare `/sync` prints the primary, the fallbacks, which one is in use
 * and why the others are skipped; `primary <handle>` makes a signed-in
 * account the primary (and switches sync on); `fallback add|rm|up <handle>`
 * edits the ordered fallbacks behind it; `off` empties the list and turns
 * sync off, `on` turns it back on. The choice is local only (it decides where
 * sync goes) and signing an account out drops it from the list.
 */

import { findAccount } from '../../accounts/findAccount';
import { movedUp, withPrimary, withoutKey } from '../../accounts/syncList';
import type { SyncPrefs } from '../../accounts/syncPrefs';
import { wordsOf } from '../../lib/words';
import { OK, fail, syncRun } from '../outcome';
import { accountLabel, syncReport } from '../syncReport';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every form of the command: /help shows it, a bad argument echoes it. */
const USAGE =
  '/sync | /sync primary <handle> | /sync fallback add|rm|up <handle> | /sync off | /sync on';

/** The argument text matched none of the command's forms. */
const USAGE_ERROR = fail(`Usage: ${USAGE}`);

/** What {@link change} does to the list: the next list, or the refusal to give. */
type Edit = (list: readonly string[], key: string) => readonly string[] | string;

/** Print the report. */
function report(context: CommandContext): CommandOutcome {
  const lines = syncReport(context.stores.sync.read(), context.state);
  for (const line of lines) {
    context.print(line);
  }
  return OK;
}

/** Store {@link prefs} and say {@link text}. */
function save(context: CommandContext, prefs: SyncPrefs, text: string): CommandOutcome {
  context.stores.sync.write(prefs);
  context.print(text);
  return OK;
}

/** `on` and `off`. */
function switchTo(enabled: boolean, context: CommandContext): CommandOutcome {
  const { syncAccounts } = context.stores.sync.read();
  const kept = enabled ? syncAccounts : [];
  return save(
    context,
    { syncAccounts: kept, syncEnabled: enabled },
    `Sync: ${enabled ? 'on' : 'off'}`,
  );
}

/**
 * Apply {@link edit} to the list for the account {@link query} names, then
 * store and print the new list; refuse when no signed-in account matches or
 * the edit answers a refusal.
 */
function change(query: string | undefined, context: CommandContext, edit: Edit): CommandOutcome {
  if (query === undefined) {
    return USAGE_ERROR;
  }
  const account = findAccount(context.stores.accounts.list(), query);
  if (account === null) {
    return fail(`No account ${query}`);
  }
  const prefs = context.stores.sync.read();
  const next = edit(prefs.syncAccounts, account.key);
  if (typeof next === 'string') {
    return fail(next);
  }
  const text = `Sync accounts: ${next.map((key) => accountLabel(context.state, key)).join(', ')}`;
  return save(context, { syncAccounts: next, syncEnabled: true }, text);
}

/** `fallback add`: appended after the others, once. */
const ADD: Edit = (list, key) => {
  if (list.length === 0) {
    return 'No primary yet. Type /sync primary <handle> first';
  }
  return list.includes(key) ? 'Already in the sync list' : [...list, key];
};

/** `fallback rm`: dropped from the list. */
const REMOVE: Edit = (list, key) =>
  list.includes(key) ? withoutKey(list, key) : 'Not in the sync list';

/** `fallback up`: one place earlier; the second in line swaps with the primary. */
const UP: Edit = (list, key) => {
  if (!list.includes(key)) {
    return 'Not in the sync list';
  }
  return list[0] === key ? 'Already the primary' : movedUp(list, key);
};

/** The `fallback` forms by their second word. */
const FALLBACK_EDITS: ReadonlyMap<string, Edit> = new Map([
  ['add', ADD],
  ['rm', REMOVE],
  ['up', UP],
]);

/** `fallback <add|rm|up> <handle>`. */
function fallback(words: readonly string[], context: CommandContext): CommandOutcome {
  const [verb, query, extra] = words;
  const edit = verb === undefined ? undefined : FALLBACK_EDITS.get(verb);
  if (edit === undefined || extra !== undefined) {
    return USAGE_ERROR;
  }
  return change(query, context, edit);
}

/** Read the argument words and do the one thing they ask for. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, ...rest] = wordsOf(args);
  if (word === undefined) {
    return report(context);
  }
  if (word === 'primary' && rest.length === 1) {
    return change(rest[0], context, withPrimary);
  }
  if (word === 'fallback') {
    return fallback(rest, context);
  }
  if ((word === 'on' || word === 'off') && rest.length === 0) {
    return switchTo(word === 'on', context);
  }
  return USAGE_ERROR;
}

/** The `/sync` definition. */
export const command: CommandDefinition = {
  name: 'sync',
  usage: USAGE,
  summary: 'Choose which account holds your synced desk',
  run: syncRun(handle),
};
