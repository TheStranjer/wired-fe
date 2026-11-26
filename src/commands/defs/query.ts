/**
 * `/query <@handle>` (alias `/q`; decision 6, AGENTS.md "Windows, like IRC
 * buffers"): open a private conversation as its own window, the way IRC's
 * `/query nick` opens a dialog buffer. The word has to look like a handle —
 * `@user@host`, `user@host`, or `@user`/`user` for the acting instance's own
 * people — and it is normalized without its leading `@` and lowercased,
 * because the window is keyed by that form: querying somebody twice activates
 * the window that already shows the conversation, and ./useDirect matches the
 * same form against the `acct` each conversation reports. The window is owned
 * by the active account, titled `dm/<handle>`, and plain text typed into it
 * posts direct to that handle (src/features/dm). Without an account there is
 * nobody to be in a conversation with, so after the handle is checked the
 * command says what to type instead.
 */

import { t } from '../../i18n/translate';
import { activeAccount } from '../../state/selectors';
import { placedRun } from '../openWindowRun';
import { NOT_LOGGED_IN, OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's grammar: /help shows it, a bare argument echoes it. */
function usage(): string {
  return t('commands.defs.query.usage');
}

/** A normalized handle: `user`, or `user@host`; letters, digits, `.`, `_`, `-`, `~`. */
const HANDLE = /^[\w.~-]+(?:@[\w.~-]+)?$/u;

/**
 * The argument as the window keys its target: trimmed, minus one leading `@`
 * if it has one, lowercased — or null when nothing is left to name or what
 * is left does not look like a handle.
 */
function normalizeHandle(args: string): string | null {
  const trimmed = args.trim();
  const word = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return HANDLE.test(word) ? word.toLowerCase() : null;
}

/** Normalize the handle, then ask the window list for the active account's DM window. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const target = normalizeHandle(args);
  if (target === null) {
    return fail(t('commands.defs.query.usage_error', { usage: usage() }));
  }
  const account = activeAccount(context.state);
  if (account === null) {
    return NOT_LOGGED_IN;
  }
  context.dispatchWindows({
    type: 'open',
    ref: { kind: 'dm', accountKey: account.key, target },
    title: `dm/${target}`,
  });
  return OK;
}

/** The `/query` (alias `/q`) definition. */
export const command: CommandDefinition = {
  name: 'query',
  aliases: ['q'],
  get usage(): string {
    return usage();
  },
  get summary(): string {
    return t('commands.defs.query.summary');
  },
  run: placedRun(syncRun(handle)),
};
