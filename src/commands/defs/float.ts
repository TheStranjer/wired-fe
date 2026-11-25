/**
 * `/float` (decisions 6, 12 and 13): tear the focused tiled pane off into a
 * floating window, keeping its window; `/float <view…>` opens a view (the
 * grammar of `/vsplit`: `home`, `tag rust`, `win 3`…) in a new float that
 * takes focus. `/float move <dx> <dy>` and `/float size <dw> <dh>` nudge and
 * resize the focused float in percent of the viewport (floatAdjust.ts). `/dock`
 * puts a float back in the tree and `/raise` brings one to the top.
 */

import { wordsOf } from '../../lib/words';
import { activeDesktop } from '../../windows/desktops';
import { findFloat } from '../../windows/floats';
import { ADJUST_USAGE, adjustFloat } from '../floatAdjust';
import { OK, fail } from '../outcome';
import { VIEW_USAGE, placeShown, viewToShow } from '../splitRun';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every form of the command: /help shows it, a bad view echoes it. */
const USAGE = `/float ${VIEW_USAGE} | /float ${ADJUST_USAGE}`;

/** The refusal on a desktop with nothing focused. */
const NO_PANE = fail('There is no pane to float on this desktop');

/** The refusal when the focused pane is a float already. */
const ALREADY_FLOATING = fail('The focused pane is already a float');

/** Tear the focused tiled pane off into a float. */
function floatFocused(context: CommandContext): CommandOutcome {
  const { floats, focusedPaneId } = activeDesktop(context.state.layout);
  if (focusedPaneId === null) {
    return NO_PANE;
  }
  if (findFloat(floats, focusedPaneId) !== null) {
    return ALREADY_FLOATING;
  }
  context.dispatch({ type: 'layout', action: { type: 'float' } });
  return OK;
}

/** Open the view {@link args} spell in a new float: a pane split off the tree, then torn off it. */
async function floatView(args: string, context: CommandContext): Promise<CommandOutcome> {
  const shown = await viewToShow(args, context, USAGE);
  if (!shown.ok) {
    return fail(shown.error);
  }
  const { windowId } = shown.value;
  return placeShown(context, shown.value, [
    { type: 'split', dir: 'row', windowId },
    { type: 'float' },
  ]);
}

/** The `/float` definition. */
export const command: CommandDefinition = {
  name: 'float',
  usage: USAGE,
  summary: 'Tear the focused pane off into a float, or open a view in a new one',
  bindings: [{ mode: 'navigation', chord: 'w f', args: '' }],
  run: async (args, context) => {
    const [first, ...rest] = wordsOf(args);
    const word = first?.toLowerCase();
    if (word === 'move' || word === 'size') {
      return adjustFloat(context, word, rest);
    }
    return args.trim() === '' ? floatFocused(context) : await floatView(args, context);
  },
};
