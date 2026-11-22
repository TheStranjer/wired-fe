/**
 * `/win` (decision 6): jump to a window by number, cycle through the list,
 * reorder the active window and print the whole list, IRC-buffer style
 * (AGENTS.md "Windows, like IRC buffers"). Numbers are 1-based, as the status
 * line shows them. Window 1 is the status window: it never moves and nothing
 * moves into its place. The reducer next door performs every change; this
 * command only reads the list and hands the matching action over.
 */

import { wordsOf } from '../../lib/words';
import { STATUS_WINDOW_ID, activeWindow, type WindowState } from '../../windows/model';
import { OK, fail, syncRun } from '../outcome';
import type { CommandBinding, CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every form of the command: /help shows it, a bad argument echoes it. */
const USAGE = '/win <number> | /win next | /win prev | /win move <number> | /win list';

/** The argument text matched none of the command's forms. */
const USAGE_ERROR = fail(`Usage: ${USAGE}`);

/** The digits whose Alt+N and N bindings jump straight to window N. */
const WINDOW_DIGITS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * The default bindings (AGENTS.md "Two hotkey modes"): digits jump in both
 * modes, `0` standing for window 10; arrows and `h`/`l` cycle, in navigation
 * mode bare and in insert mode under Alt.
 */
const BINDINGS: readonly CommandBinding[] = [
  ...WINDOW_DIGITS.flatMap((digit): CommandBinding[] => [
    { mode: 'insert', chord: `Alt+${digit}`, args: digit },
    { mode: 'navigation', chord: digit, args: digit },
  ]),
  { mode: 'insert', chord: 'Alt+0', args: '10' },
  { mode: 'navigation', chord: '0', args: '10' },
  { mode: 'insert', chord: 'Alt+ArrowLeft', args: 'prev' },
  { mode: 'insert', chord: 'Alt+ArrowRight', args: 'next' },
  { mode: 'navigation', chord: 'ArrowLeft', args: 'prev' },
  { mode: 'navigation', chord: 'ArrowRight', args: 'next' },
  { mode: 'navigation', chord: 'h', args: 'prev' },
  { mode: 'navigation', chord: 'l', args: 'next' },
];

/** The positive integer `text` spells, or null when it spells none. */
function positiveInteger(text: string | undefined): number | null {
  if (text === undefined || !/^\d+$/u.test(text)) {
    return null;
  }
  const value = Number(text);
  return value >= 1 ? value : null;
}

/** Jump to window `number`; a list too short to have it is the refusal. */
function activate(context: CommandContext, number: number): CommandOutcome {
  if (number > context.windows.windows.length) {
    return fail(`No window ${String(number)}`);
  }
  context.dispatchWindows({ type: 'activateNumber', number });
  return OK;
}

/** Step to the next or previous window; the reducer wraps at both ends. */
function cycle(context: CommandContext, direction: 'next' | 'previous'): CommandOutcome {
  context.dispatchWindows({ type: direction });
  return OK;
}

/** Move the active window to slot `toNumber`; slot 1 is the status window's. */
function move(context: CommandContext, word: string | undefined): CommandOutcome {
  const toNumber = positiveInteger(word);
  if (toNumber === null) {
    return USAGE_ERROR;
  }
  const { id } = activeWindow(context.windows);
  if (id === STATUS_WINDOW_ID || toNumber < 2 || toNumber > context.windows.windows.length) {
    return fail("Can't move this window there");
  }
  context.dispatchWindows({ type: 'move', id, toNumber });
  return OK;
}

/** One listing line: marker, number, title, then unread and highlight tags. */
function listLine(win: WindowState, number: number, active: boolean): string {
  const marker = active ? '>' : ' ';
  const unread = win.unread > 0 ? ` (${String(win.unread)} unread)` : '';
  const highlighted = win.highlight ? ' *' : '';
  return `${marker} ${String(number)}: ${win.title}${unread}${highlighted}`;
}

/** Print one line per window, leading `>` on the active one. */
function list(context: CommandContext): CommandOutcome {
  const { windows, activeId } = context.windows;
  for (const [index, win] of windows.entries()) {
    context.print(listLine(win, index + 1, win.id === activeId));
  }
  return OK;
}

/** Read the argument words and do the one thing they ask for. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, second] = wordsOf(args);
  if (word === undefined || word === 'list') {
    return list(context);
  }
  const number = positiveInteger(word);
  if (number !== null) {
    return activate(context, number);
  }
  if (word === 'next') {
    return cycle(context, 'next');
  }
  if (word === 'prev' || word === 'previous') {
    return cycle(context, 'previous');
  }
  if (word === 'move') {
    return move(context, second);
  }
  return USAGE_ERROR;
}

/** The `/win` (aliases `/w`, `/window`) definition. */
export const command: CommandDefinition = {
  name: 'win',
  aliases: ['w', 'window'],
  usage: USAGE,
  summary: 'Switch, cycle, reorder or list windows',
  run: syncRun(handle),
  bindings: BINDINGS,
};
