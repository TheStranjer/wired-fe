/**
 * `/desktop` (decision 6, alias `/d`; decisions 12 and 18): list the desktops,
 * switch to one by number (creating the missing ones), step to the next or
 * previous one (left of the first wraps to the last, right of the last makes a
 * new one), make a new one, or close one. Closing drops the desktop's panes
 * but no window: they stay open, hidden. The last desktop is never closed. The
 * layout reducer performs every change; this command reads the layout and
 * hands the matching action over.
 */

import { wordsOf } from '../../lib/words';
import type { LayoutAction } from '../../windows/layoutAction';
import { desktopLines } from '../desktopList';
import { desktopNumber } from '../desktopNumber';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every form of the command: /help shows it, a bad argument echoes it. */
const USAGE =
  '/desktop [list] | /desktop <number> | /desktop next | /desktop prev | /desktop new | /desktop close [number]';

/** The argument text matched none of the command's forms. */
const USAGE_ERROR = fail(`Usage: ${USAGE}`);

/** The refusal: there is always one desktop to look at. */
const LAST_DESKTOP = fail("Can't close the last desktop");

/** Ask the layout reducer for {@link action}. */
function layout(context: CommandContext, action: LayoutAction): CommandOutcome {
  context.dispatch({ type: 'layout', action });
  return OK;
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
  const n = word === undefined ? active + 1 : desktopNumber(word, USAGE_ERROR);
  if (typeof n !== 'number') {
    return n;
  }
  if (desktops.length < 2) {
    return LAST_DESKTOP;
  }
  return n > desktops.length
    ? fail(`No desktop ${String(n)}`)
    : layout(context, { type: 'closeDesktop', n });
}

/** Read the argument words and do the one thing they ask for. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, second] = wordsOf(args);
  if (word === undefined || word === 'list') {
    return list(context);
  }
  if (word === 'next') {
    return layout(context, { type: 'stepDesktop', step: 1 });
  }
  if (word === 'prev' || word === 'previous') {
    return layout(context, { type: 'stepDesktop', step: -1 });
  }
  if (word === 'new') {
    return layout(context, { type: 'newDesktop' });
  }
  if (word === 'close') {
    return close(context, second);
  }
  const n = desktopNumber(word, USAGE_ERROR);
  return typeof n === 'number' ? layout(context, { type: 'goToDesktop', n }) : n;
}

/** The `/desktop` (alias `/d`) definition. */
export const command: CommandDefinition = {
  name: 'desktop',
  aliases: ['d'],
  usage: USAGE,
  summary: 'List, switch, create or close desktops',
  run: syncRun(handle),
};
