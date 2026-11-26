/**
 * `/account` (alias `/acc`; decision 6, decision 8, AGENTS.md "Multi-account
 * and multi-instance from day one"): the view and switch for the signed-in
 * accounts. No argument or `list` prints one numbered line per account, `>`
 * marking the active one; `switch <n|handle>` resolves the query the way
 * `findAccount` does and makes that account current; `next` steps to the
 * following one, wrapping at the end — bound to insert `Alt+a` and navigation
 * `a`. `logout [n|handle]` (default: the active account) revokes the token on
 * its instance — a failed revoke is a warning, never a refusal — then forgets
 * the account and closes every window of its `ref.accountKey`. The store is
 * the source of truth; every change hands the fresh list and active pointer
 * to the reducer in an `accounts` action.
 */

import type { StoredAccount } from '../../accounts/accountStore';
import { getOrRegisterApp } from '../../accounts/appCache';
import { redirectUriFor } from '../../accounts/callback';
import { findAccount } from '../../accounts/findAccount';
import { describeApiError } from '../../api/errors';
import { revokeToken } from '../../api/oauth';
import { wordsOf } from '../../lib/words';
import { notSignedInAs } from '../notSignedInAs';
import { NOT_LOGGED_IN, OK, fail } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every form of the command: /help shows it, a bad argument echoes it. */
const USAGE =
  '/account [list] | /account switch <n|handle> | /account next | /account logout [n|handle]';

/** The refusal shared by every form with nothing to act on. */
const NO_ACCOUNTS: CommandOutcome = NOT_LOGGED_IN;

/** The argument text matched none of the command's forms. */
const USAGE_ERROR = fail(`Usage: ${USAGE}`);

/** The refusal naming the query nothing matched. */
function noAccount(query: string | undefined, context: CommandContext): CommandOutcome {
  return query === undefined ? NO_ACCOUNTS : notSignedInAs(query, context.stores.accounts.list());
}

/** One listing line: marker, 1-based number, then the `@`-prefixed handle. */
function listLine(account: StoredAccount, number: number, active: boolean): string {
  return `${active ? '>' : ' '} ${String(number)}: @${account.handle}`;
}

/** Print one line per account, `>` on the active one. */
function list(context: CommandContext): CommandOutcome {
  const { list: stored, activeKey } = context.stores.accounts;
  const accounts = stored();
  if (accounts.length === 0) {
    return NO_ACCOUNTS;
  }
  const active = activeKey();
  for (const [index, account] of accounts.entries()) {
    context.print(listLine(account, index + 1, account.key === active));
  }
  return OK;
}

/** Hand the store's fresh list and active pointer to the reducer. */
function syncAccounts(context: CommandContext): void {
  const { list: stored, activeKey } = context.stores.accounts;
  context.dispatch({ type: 'accounts', accounts: stored(), activeKey: activeKey() });
}

/** Make {@link account} the active one: in the store, in the state, on screen. */
function activate(context: CommandContext, account: StoredAccount): CommandOutcome {
  context.stores.accounts.setActive(account.key);
  syncAccounts(context);
  context.print(`Active account: @${account.handle}`);
  return OK;
}

/** `switch <n|handle>`: make the account the query names the active one. */
function switchTo(query: string | undefined, context: CommandContext): CommandOutcome {
  if (query === undefined || query === '') {
    return USAGE_ERROR;
  }
  const found = findAccount(context.stores.accounts.list(), query);
  if (found === null) {
    return noAccount(query, context);
  }
  return activate(context, found);
}

/**
 * `next`: the account after the active one, wrapping at the end — the first
 * when none is active. With no accounts at all there is nothing to step to.
 */
function nextAccount(context: CommandContext): CommandOutcome {
  const { list: stored, activeKey } = context.stores.accounts;
  const accounts = stored();
  const position = accounts.findIndex((account) => account.key === activeKey()) + 1;
  const [next] = [...accounts.slice(position), ...accounts.slice(0, position)];
  if (next === undefined) {
    return NO_ACCOUNTS;
  }
  return activate(context, next);
}

/** The account `logout` acts on: the query names it, or the active one does. */
function logoutTarget(context: CommandContext, query: string | undefined): StoredAccount | null {
  const { list: stored, activeKey } = context.stores.accounts;
  if (query === undefined || query === '') {
    return stored().find((account) => account.key === activeKey()) ?? null;
  }
  return findAccount(stored(), query);
}

/** Revoke {@link account}'s token as well as the instance will allow. */
async function revokeQuietly(account: StoredAccount, context: CommandContext): Promise<void> {
  const app = await getOrRegisterApp(context.stores.apps, {
    origin: account.origin,
    redirectUri: redirectUriFor(context.page),
    appName: context.config.appName,
  });
  if (!app.ok) {
    context.print(`Could not revoke the token: ${describeApiError(app.error)}`, 'warn');
    return;
  }
  const revoked = await revokeToken(account.origin, { app: app.value, token: account.token });
  if (!revoked.ok) {
    context.print(`Could not revoke the token: ${describeApiError(revoked.error)}`, 'warn');
  }
}

/** Close every window owned by the account with {@link key}. */
function closeWindowsOf(context: CommandContext, key: string): void {
  for (const win of context.windows.windows) {
    if (win.ref.accountKey === key) {
      context.dispatchWindows({ type: 'close', id: win.id });
    }
  }
}

/**
 * `logout [n|handle]`: best-effort revoke on the instance, then forget the
 * account, tell the reducer, close the account's windows and say so.
 */
async function logout(query: string | undefined, context: CommandContext): Promise<CommandOutcome> {
  const account = logoutTarget(context, query);
  if (account === null) {
    return noAccount(query, context);
  }
  await revokeQuietly(account, context);
  context.stores.accounts.remove(account.key);
  context.stores.sync.forget(account.key);
  syncAccounts(context);
  closeWindowsOf(context, account.key);
  context.print(`Logged out @${account.handle}`);
  return OK;
}

/** Read the argument words and do the one thing they ask for. */
async function handle(args: string, context: CommandContext): Promise<CommandOutcome> {
  const [word, second] = wordsOf(args);
  if (word === undefined || word === 'list') {
    return list(context);
  }
  if (word === 'switch') {
    return switchTo(second, context);
  }
  if (word === 'next') {
    return nextAccount(context);
  }
  if (word === 'logout') {
    return await logout(second, context);
  }
  return USAGE_ERROR;
}

/** The `/account` (alias `/acc`) definition. */
export const command: CommandDefinition = {
  name: 'account',
  aliases: ['acc'],
  usage: USAGE,
  summary: 'List, switch between and log out of accounts',
  run: handle,
  bindings: [
    { mode: 'insert', chord: 'Alt+a', args: 'next' },
    { mode: 'navigation', chord: 'a', args: 'next' },
  ],
};
