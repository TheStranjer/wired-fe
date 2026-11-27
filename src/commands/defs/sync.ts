/**
 * `/sync` (decision 17, decision 6): which account's server holds the synced
 * desk. Bare `/sync` prints the primary, the fallbacks, which one is in use
 * and why the others are skipped; `primary <handle>` makes a signed-in
 * account the primary (and switches sync on); `fallback add|rm|up <handle>`
 * edits the ordered fallbacks behind it; `off` empties the list and turns
 * sync off, `on` turns it back on; `now` pulls from the primary and pushes at
 * once. Every change to the list has the sync pull from the account now in
 * use. The choice is local only (it decides where sync goes) and signing an
 * account out drops it from the list.
 */

import { findAccount } from '../../accounts/findAccount';
import { movedUp, withPrimary, withoutKey } from '../../accounts/syncList';
import type { SyncPrefs } from '../../accounts/syncPrefs';
import { literals } from '../../i18n/messages';
import { t } from '../../i18n/translate';
import { wordsOf } from '../../lib/words';
import { pickSyncAccount } from '../../state/syncAccount';
import { notSignedInAs } from '../notSignedInAs';
import { OK, fail, syncRun } from '../outcome';
import { accountLabel, syncReport } from '../syncReport';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every form of the command: /help shows it, a bad argument echoes it. */
function usage(): string {
  return t('commands.defs.sync.usage');
}

/** The argument text matched none of the command's forms. */
function usageError(): CommandOutcome {
  return fail(t('commands.defs.sync.usage_error', { usage: usage() }));
}

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

/** Store {@link prefs}, say {@link text} and have the sync look at the (maybe new) primary. */
function save(context: CommandContext, prefs: SyncPrefs, text: string): CommandOutcome {
  context.stores.sync.write(prefs);
  context.print(text);
  context.requestSync('pull');
  return OK;
}

/** `on` and `off`. */
function switchTo(enabled: boolean, context: CommandContext): CommandOutcome {
  const { syncAccounts } = context.stores.sync.read();
  const kept = enabled ? syncAccounts : [];
  const text = t(enabled ? 'commands.defs.sync.switched_on' : 'commands.defs.sync.switched_off');
  return save(context, { syncAccounts: kept, syncEnabled: enabled }, text);
}

/**
 * Apply {@link edit} to the list for the account {@link query} names, then
 * store and print the new list; refuse when no signed-in account matches or
 * the edit answers a refusal.
 */
function change(query: string | undefined, context: CommandContext, edit: Edit): CommandOutcome {
  if (query === undefined) {
    return usageError();
  }
  const accounts = context.stores.accounts.list();
  const account = findAccount(accounts, query);
  if (account === null) {
    return notSignedInAs(query, accounts);
  }
  const prefs = context.stores.sync.read();
  const next = edit(prefs.syncAccounts, account.key);
  if (typeof next === 'string') {
    return fail(next);
  }
  const accountList = next.map((key) => accountLabel(context.state, key)).join(', ');
  const text = t('commands.defs.sync.accounts', { accounts: accountList });
  return save(context, { syncAccounts: next, syncEnabled: true }, text);
}

/** `fallback add`: appended after the others, once. */
const ADD: Edit = (list, key) => {
  if (list.length === 0) {
    return t('commands.defs.sync.no_primary', literals('primary'));
  }
  return list.includes(key) ? t('commands.defs.sync.already_listed') : [...list, key];
};

/** `fallback rm`: dropped from the list. */
const REMOVE: Edit = (list, key) =>
  list.includes(key) ? withoutKey(list, key) : t('commands.defs.sync.not_listed');

/** `fallback up`: one place earlier; the second in line swaps with the primary. */
const UP: Edit = (list, key) => {
  if (!list.includes(key)) {
    return t('commands.defs.sync.not_listed');
  }
  return list[0] === key ? t('commands.defs.sync.already_primary') : movedUp(list, key);
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
    return usageError();
  }
  return change(query, context, edit);
}

/** `now`: pull from the primary, then push; refused when no account can hold the desk. */
function syncNow(context: CommandContext): CommandOutcome {
  if (pickSyncAccount(context.stores.sync.read(), context.state) === null) {
    return fail(t('commands.defs.sync.no_holder'));
  }
  context.print(t('commands.defs.sync.syncing'));
  context.requestSync('now');
  return OK;
}

/** The forms that are one word and nothing else. */
const BARE_FORMS: ReadonlyMap<string, (context: CommandContext) => CommandOutcome> = new Map([
  ['on', (context: CommandContext) => switchTo(true, context)],
  ['off', (context: CommandContext) => switchTo(false, context)],
  ['now', syncNow],
]);

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
  const bare = rest.length === 0 ? BARE_FORMS.get(word) : undefined;
  return bare === undefined ? usageError() : bare(context);
}

/** The `/sync` definition. */
export const command: CommandDefinition = {
  name: 'sync',
  get usage(): string {
    return usage();
  },
  get summary(): string {
    return t('commands.defs.sync.summary');
  },
  run: syncRun(handle),
};
