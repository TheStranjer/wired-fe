/**
 * `/desktop` (decision 6, alias `/d`; decisions 12 and 18): list the desktops,
 * switch to one by number, step to the next or previous one (left of the first
 * wraps to the last), make a new one, close one (`Ctrl+B &`) or prune the empty
 * ones. A desktop is made (by `new`, `next` on the last, or the number just
 * past the end) only when the last desktop is not empty; otherwise the command
 * fails with the reason, so no empty desktops pile up. Closing drops the
 * desktop's panes but no window: they stay open, hidden. The last desktop is
 * never closed. The layout reducer performs every change; this command reads
 * the layout, refuses by the same rule (`appendRefusal`) and hands the matching
 * action over.
 */

import { t } from '../../i18n/translate';
import { wordsOf } from '../../lib/words';
import { appendRefusal } from '../../windows/desktopAppend';
import { isEmptyDesktop } from '../../windows/desktopPanes';
import type { LayoutAction } from '../../windows/layoutAction';
import type { CommandBinding } from '../bindingTypes';
import { desktopLines } from '../desktopList';
import { desktopNumber } from '../desktopNumber';
import { OK, fail, syncRun } from '../outcome';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** The digits whose Alt+N binding jumps straight to desktop N. */
const DESKTOP_DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** The digits of `Ctrl+B 0..9`; 0 stands for desktop 10, as with Alt. */
const TMUX_DIGITS: readonly string[] = ['0', ...DESKTOP_DIGITS];

/**
 * The default bindings (decision 18): `Alt+1..9` jump, `Alt+0` standing for
 * desktop 10, in insert mode; `Alt+[` and `Alt+]` step left and right in both;
 * the tmux-style `Ctrl+B c`, `n`, `p` and `0..9` work in both modes.
 */
const BINDINGS: readonly CommandBinding[] = [
  ...DESKTOP_DIGITS.map((digit): CommandBinding => ({
    mode: 'insert',
    chord: `Alt+${digit}`,
    args: digit,
  })),
  { mode: 'insert', chord: 'Alt+0', args: '10' },
  { mode: 'insert', chord: 'Alt+[', args: 'prev' },
  { mode: 'insert', chord: 'Alt+]', args: 'next' },
  { mode: 'navigation', chord: 'Alt+[', args: 'prev' },
  { mode: 'navigation', chord: 'Alt+]', args: 'next' },
  ...tmuxBindings('c', 'new'),
  ...tmuxBindings('n', 'next'),
  ...tmuxBindings('p', 'prev'),
  ...tmuxBindings('&', 'close'),
  ...TMUX_DIGITS.flatMap((digit) => tmuxBindings(digit, digit === '0' ? '10' : digit)),
];

/** The argument text matched none of the command's forms: /help shows them, a bad argument echoes them. */
function usageError(): CommandOutcome {
  return fail(t('commands.defs.desktop.usage_error', { usage: t('commands.defs.desktop.usage') }));
}

/** The refusal: there is always one desktop to look at. */
function lastDesktop(): CommandOutcome {
  return fail(t('commands.defs.desktop.last_desktop'));
}

/** Ask the layout reducer for {@link action}. */
function layout(context: CommandContext, action: LayoutAction): CommandOutcome {
  context.dispatch({ type: 'layout', action });
  return OK;
}

/** Show desktop `n` (1-based), or fail with why the append rule refuses it. */
function goTo(context: CommandContext, n: number): CommandOutcome {
  const refusal = appendRefusal(context.state.layout, n);
  return refusal === null ? layout(context, { type: 'goToDesktop', n }) : fail(refusal);
}

/** Step right, or fail when that would make a desktop past an empty last one. */
function next(context: CommandContext): CommandOutcome {
  const refusal = appendRefusal(context.state.layout, context.state.layout.active + 2);
  return refusal === null ? layout(context, { type: 'stepDesktop', step: 1 }) : fail(refusal);
}

/** Make a desktop, or fail when the last one is empty. */
function make(context: CommandContext): CommandOutcome {
  const refusal = appendRefusal(context.state.layout, context.state.layout.desktops.length + 1);
  return refusal === null ? layout(context, { type: 'newDesktop' }) : fail(refusal);
}

/** Print one line per desktop, `*` on the active one. */
function list(context: CommandContext): CommandOutcome {
  for (const line of desktopLines(context.state.layout, context.windows)) {
    context.print(line);
  }
  return OK;
}

/** Close desktop `word` (the active one without it); the last desktop and unknown numbers are refused. */
function close(context: CommandContext, word: string | undefined): CommandOutcome {
  const { desktops, active } = context.state.layout;
  const n = word === undefined ? active + 1 : desktopNumber(word, usageError());
  if (typeof n !== 'number') {
    return n;
  }
  if (desktops.length < 2) {
    return lastDesktop();
  }
  if (n > desktops.length) {
    return fail(t('commands.defs.desktop.no_desktop', { number: String(n) }));
  }
  layout(context, { type: 'closeDesktop', n });
  context.print(t('commands.defs.desktop.closed', { number: String(n) }));
  return OK;
}

/** Close every empty desktop but the active one, and say how many went. */
function prune(context: CommandContext): CommandOutcome {
  const { desktops, active } = context.state.layout;
  const count = desktops.filter((desktop, i) => i !== active && isEmptyDesktop(desktop)).length;
  if (count === 0) {
    context.print(t('commands.defs.desktop.no_empty'));
    return OK;
  }
  layout(context, { type: 'pruneDesktops' });
  context.print(t('commands.defs.desktop.closed_empty', { count }));
  return OK;
}

/** Read the argument words and do the one thing they ask for. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, second] = wordsOf(args);
  if (word === undefined || word === 'list') {
    return list(context);
  }
  if (word === 'next') {
    return next(context);
  }
  if (word === 'prev' || word === 'previous') {
    return layout(context, { type: 'stepDesktop', step: -1 });
  }
  if (word === 'new') {
    return make(context);
  }
  if (word === 'close') {
    return close(context, second);
  }
  if (word === 'prune') {
    return prune(context);
  }
  const n = desktopNumber(word, usageError());
  return typeof n === 'number' ? goTo(context, n) : n;
}

/** The `/desktop` (alias `/d`) definition. */
export const command: CommandDefinition = {
  name: 'desktop',
  aliases: ['d'],
  get usage(): string {
    return t('commands.defs.desktop.usage');
  },
  get summary(): string {
    return t('commands.defs.desktop.summary');
  },
  run: syncRun(handle),
  bindings: BINDINGS,
};
