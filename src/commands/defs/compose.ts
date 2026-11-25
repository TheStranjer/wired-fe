/**
 * `/compose [text]` (aliases `/c` and `/composer`; decisions 6 and
 * 13, WFE-245):
 * open a composer window for a long post, with the text it was given. The
 * window is a pane view like any other (src/features/composer), so it goes
 * where `--in <placement>` or the `openIn.composer` setting says — a float
 * unless told otherwise (src/state/placement) — takes what is typed at the
 * command line while it is focused, and has a "Post as" picker. A composer
 * whose draft is still empty is focused instead of opening another. With no
 * argument the composer takes the command line's own plain text, so the chord
 * that runs this turns a half-typed post into a draft (insert `Ctrl+e`,
 * navigation `c`); a line that is a command is left where it is.
 */

import type { StoredAccount } from '../../accounts/accountStore';
import { composerIsEmpty } from '../../state/composerActions';
import { composerWindowOpen } from '../../state/composerWindow';
import { activeAccount } from '../../state/selectors';
import { windowId } from '../../windows/model';
import type { CommandBinding } from '../bindingTypes';
import { placedRun } from '../openWindowRun';
import { NOT_LOGGED_IN, OK, syncRun } from '../outcome';
import { parseInput } from '../parseInput';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** `Ctrl+e` while typing, `c` while navigating: both ask for the composer. */
const BINDINGS: readonly CommandBinding[] = [
  { mode: 'insert', chord: 'Ctrl+e', args: '' },
  { mode: 'navigation', chord: 'c', args: '' },
];

/** The plain text of {@link line}, or nothing when it is a command or blank. */
function lineText(line: string): string {
  const parsed = parseInput(line);
  return parsed.kind === 'text' ? parsed.text : '';
}

/**
 * The command line's plain text a bare run takes along. A split command that
 * only wants to see the window ask (`/vsplit composer`) takes none: its window
 * opens after this run, so there is nowhere to put the text yet.
 */
function movableText(context: CommandContext): string {
  return context.placedByCaller === true ? '' : lineText(context.line);
}

/**
 * Brings up the composer to write in and answers its window id: the first one
 * whose draft is empty, else a fresh one posting as {@link account}. Focusing
 * an open one is `activate`, unless a split command holds the window ask back
 * and needs to see it.
 */
function bringUp(context: CommandContext, account: StoredAccount): string {
  const open = composerWindowOpen(account, context.windows.windows);
  const empty = context.windows.windows.find(
    (win) => win.ref.kind === 'composer' && composerIsEmpty(context.state, win.id),
  );
  if (empty === undefined) {
    context.dispatchWindows(open);
    return windowId(open.ref);
  }
  context.dispatchWindows(
    context.placedByCaller === true
      ? { type: 'open', ref: empty.ref, title: empty.title }
      : { type: 'activate', id: empty.id },
  );
  return empty.id;
}

/** Open or focus a composer and put the text in it: the argument, else the command line's own. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const account = activeAccount(context.state);
  if (account === null) {
    return NOT_LOGGED_IN;
  }
  const typed = args.trim();
  const text = typed === '' ? movableText(context) : typed;
  const id = bringUp(context, account);
  if (text !== '') {
    context.dispatch({ type: 'composerAppend', windowId: id, text });
  }
  if (typed === '' && text !== '') {
    context.setInput('');
  }
  return OK;
}

/** The `/compose` (aliases `/c`, `/composer`) definition. */
export const command: CommandDefinition = {
  name: 'compose',
  aliases: ['c', 'composer'],
  usage: '/compose [text] [--in <placement>]',
  summary: 'Open a composer window',
  run: placedRun(syncRun(handle)),
  bindings: BINDINGS,
};
