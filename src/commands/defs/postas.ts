/**
 * `/postas [--global] [<handle|n>|--clear]` (WFE-281, decision 6): choose which
 * account plain text posts as where the window has none of its own. Bare, it
 * opens the account picker (WFE-282; `--global` alone says who the active
 * window posts as and why). With an account (named as `/as`
 * names one) it sets the default of the feed the active window shows, or the
 * global default when the window is no feed, has its own account or `--global`
 * is given. `--clear` forgets the feed's default, or the global one. Feeds and
 * the settings are saved and synced like any setting (decision 17). `Shift+a`
 * in navigation mode and `Ctrl+B A` open the picker (WFE-285).
 */

import { findAccount } from '../../accounts/findAccount';
import { wordsOf } from '../../lib/words';
import type { FeedSpec } from '../../state/feeds';
import { postingLine, postingPatch, postingSetLine } from '../../state/postingDefault';
import { activeWindow } from '../../windows/model';
import { NOT_LOGGED_IN, OK, fail, syncRun } from '../outcome';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The command's grammar: /help shows it, a bad argument echoes it. */
const USAGE = '/postas [--global] [<handle|n>|--clear]';

/** What the arguments ask for. */
type Request = {
  readonly global: boolean;
  readonly clear: boolean;
  /** The account word, or null when none was given. */
  readonly word: string | null;
};

/** The arguments read as flags and at most one account word; null for anything else. */
function parseRequest(words: readonly string[]): Request | null {
  const plain = words.filter((word) => !word.startsWith('--'));
  const flags = words.filter((word) => word.startsWith('--'));
  const known = flags.every((flag) => flag === '--global' || flag === '--clear');
  const clear = flags.includes('--clear');
  if (!known || plain.length > 1 || (clear && plain.length > 0)) {
    return null;
  }
  return { global: flags.includes('--global'), clear, word: plain[0] ?? null };
}

/** The feed the active window shows and a default would be set on; null when the global default is meant. */
function feedTarget(context: CommandContext, global: boolean): FeedSpec | null {
  const { ref } = activeWindow(context.windows);
  if (global || ref.kind !== 'feed') {
    return null;
  }
  return context.state.settings.feeds.find((feed) => feed.id === ref.target) ?? null;
}

/** Say who the active window posts as and why, or that nothing decides it. */
function describe(context: CommandContext): CommandOutcome {
  const line = postingLine(context.state, activeWindow(context.windows));
  context.print(line ?? 'No posting account set: /postas <handle|n>');
  return OK;
}

/** Open the account picker for the active window; nobody signed in has nothing to pick from. */
function pick(context: CommandContext): CommandOutcome {
  if (context.state.accounts.length === 0) {
    return NOT_LOGGED_IN;
  }
  const { id } = activeWindow(context.windows);
  context.dispatch({ type: 'openAccountPick', pick: { purpose: 'default', windowId: id } });
  return OK;
}

/** Make {@link key} (or nothing) the account {@link feed}, or the whole client when null, posts as. */
function save(context: CommandContext, feed: FeedSpec | null, key: string | null): void {
  const patch = postingPatch(context.state.settings.feeds, feed?.id ?? null, key);
  context.dispatch({ type: 'settings', settings: patch });
}

/** Forget the default of {@link feed}, or the global one when null. */
function clearDefault(context: CommandContext, feed: FeedSpec | null): CommandOutcome {
  save(context, feed, null);
  context.print(feed === null ? 'Global posting account cleared' : `~${feed.name} default cleared`);
  return OK;
}

/** An account word to make a default, and whether `--global` insisted on the global one. */
type Setting = { readonly word: string; readonly global: boolean };

/** Set the default of {@link feed}, or the global one when null, to the account the word names. */
function setDefault(
  context: CommandContext,
  feed: FeedSpec | null,
  setting: Setting,
): CommandOutcome {
  const account = findAccount(context.stores.accounts.list(), setting.word);
  if (account === null) {
    return fail(`No account ${setting.word}`);
  }
  save(context, feed, account.key);
  const line = postingSetLine(feed?.name ?? null, account.handle);
  const own =
    feed === null && !setting.global && activeWindow(context.windows).ref.accountKey !== null;
  const note = own ? '; this window has its own account, so it is the global default' : '';
  context.print(`${line}${note}`);
  return OK;
}

/** Show, set or clear the posting account the arguments ask about. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const request = parseRequest(wordsOf(args));
  if (request === null) {
    return fail(`Usage: ${USAGE}`);
  }
  const feed = feedTarget(context, request.global);
  if (request.clear) {
    return clearDefault(context, feed);
  }
  const { word, global } = request;
  if (word !== null) {
    return setDefault(context, feed, { word, global });
  }
  return args.trim() === '' ? pick(context) : describe(context);
}

/** The `/postas` definition. */
export const command: CommandDefinition = {
  name: 'postas',
  usage: USAGE,
  summary: 'Show or set which account feeds post as',
  run: syncRun(handle),
  bindings: [...tmuxBindings('Shift+a', ''), { mode: 'navigation', chord: 'Shift+a', args: '' }],
};
