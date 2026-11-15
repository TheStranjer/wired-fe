/**
 * `/select` (decision 6, alias `/sel`): move or set the selected post of the
 * active window (AGENTS.md "Two hotkey modes", "Every post has a short label").
 * next/prev step one line towards the newest or the oldest, first/last jump to
 * an end, none clears the selection, and a label puts the selection on the
 * line that shows that post: the post's own line, or the notification line
 * holding it. The reducer owns every move; this command reads the buffer only
 * to turn a label into the line key the `select` action asks for.
 */

import type { Buffer, LineData } from '../../state/buffer';
import { statusForLabel, statusOfLine } from '../../state/bufferSelection';
import { activeBuffer } from '../../state/selectors';
import { activeWindow } from '../../windows/model';
import type { CommandBinding, CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every form of the command: /help shows it, a bad argument echoes it. */
const USAGE = '/select next | prev | first | last | none | <label>';

/** The command ran; what it asked for is on its way to the reducer. */
const OK: CommandOutcome = { ok: true };

/** The argument text matched none of the command's forms. */
const USAGE_ERROR: CommandOutcome = { ok: false, message: `Usage: ${USAGE}` };

/** Anything beyond a single word is no form of this command. */
const WHITESPACE = /\s/u;

/**
 * The navigation-mode movement (AGENTS.md "Two hotkey modes"): j/k and the
 * arrows step, g and G / Home and End jump to an end, Escape drops the
 * selection but stays in navigation mode.
 */
const BINDINGS: readonly CommandBinding[] = [
  { mode: 'navigation', chord: 'j', args: 'next' },
  { mode: 'navigation', chord: 'ArrowDown', args: 'next' },
  { mode: 'navigation', chord: 'k', args: 'prev' },
  { mode: 'navigation', chord: 'ArrowUp', args: 'prev' },
  { mode: 'navigation', chord: 'g', args: 'first' },
  { mode: 'navigation', chord: 'Shift+g', args: 'last' },
  { mode: 'navigation', chord: 'Home', args: 'first' },
  { mode: 'navigation', chord: 'End', args: 'last' },
  { mode: 'navigation', chord: 'Escape', args: 'none' },
];

/** A failure saying {@link message}. */
function fail(message: string): CommandOutcome {
  return { ok: false, message };
}

/** The line of {@link buffer} showing status `id`: its own or the notification line holding it. */
function lineShowing(buffer: Buffer, id: string): LineData | undefined {
  return buffer.lines.find((line) => statusOfLine(line)?.id === id);
}

/** Put the selection on the line the active window gave {@link label}; no such post refuses. */
function selectLabel(context: CommandContext, windowId: string, label: string): CommandOutcome {
  const buffer = activeBuffer(context.state);
  const status = statusForLabel(buffer, label);
  const line = status === null ? undefined : lineShowing(buffer, status.id);
  if (line === undefined) {
    return fail(`No post ${label} here`);
  }
  context.dispatch({ type: 'select', windowId, key: line.key });
  return OK;
}

/** Do the one move {@link word} names on the active window, or resolve it as a label. */
function move(context: CommandContext, word: string): CommandOutcome {
  const windowId = activeWindow(context.state.windows).id;
  switch (word) {
    case 'next':
      context.dispatch({ type: 'selectRelative', windowId, delta: 1 });
      return OK;
    case 'prev':
      context.dispatch({ type: 'selectRelative', windowId, delta: -1 });
      return OK;
    case 'first':
      context.dispatch({ type: 'selectEdge', windowId, edge: 'first' });
      return OK;
    case 'last':
      context.dispatch({ type: 'selectEdge', windowId, edge: 'last' });
      return OK;
    case 'none':
      context.dispatch({ type: 'select', windowId, key: null });
      return OK;
    default:
      return selectLabel(context, windowId, word);
  }
}

/** The command's one argument word; nothing or more than one word is the usage. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const word = args.trim();
  if (word === '' || WHITESPACE.test(word)) {
    return USAGE_ERROR;
  }
  return move(context, word);
}

/** The `/select` (alias `/sel`) definition. */
export const command: CommandDefinition = {
  name: 'select',
  aliases: ['sel'],
  usage: USAGE,
  summary: 'Move or set the selected post',
  run: async (args, context) => await Promise.resolve(handle(args, context)),
  bindings: BINDINGS,
};
