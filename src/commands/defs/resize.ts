/**
 * `/resize` (decision 6): change the focused pane's size from the command
 * line. `width` works on the pane's nearest `row` split and `height` on its
 * nearest `column` split; `+N` and `-N` move its share by N percentage
 * points, a bare `N` sets it to N%. A float changes its own size instead, by
 * N% of the viewport. With nothing to resize the command changes nothing and
 * says so. The layout reducer clamps and applies; this command reads the
 * focused pane and hands the matching action over.
 */

import { wordsOf } from '../../lib/words';
import { activeDesktop } from '../../windows/desktops';
import { findFloat } from '../../windows/floats';
import type { FloatPane } from '../../windows/floats';
import { paneShare } from '../../windows/splitRatio';
import type { SplitDir } from '../../windows/splitTree';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/** Every form of the command: /help shows it, a bad argument echoes it. */
const USAGE = '/resize width|height +N|-N|N';

/** The refusal when the focused pane has no split or float to resize along that axis. */
const NOTHING_TO_RESIZE = fail('Nothing to resize');

/** Which edge a word resizes: a row split holds panes side by side, a column split stacks them. */
const AXES: ReadonlyMap<string, SplitDir> = new Map([
  ['width', 'row'],
  ['height', 'column'],
]);

/** A percentage amount: `relative` for a signed `+N`/`-N`, absolute for a bare `N`. */
type Amount = { readonly points: number; readonly relative: boolean };

/** The amount `text` spells (`+5`, `-10`, `40`), or null when it spells none. */
function parseAmount(text: string | undefined): Amount | null {
  if (text === undefined || !/^[+-]?\d+(?:\.\d+)?$/u.test(text)) {
    return null;
  }
  return { points: Number(text) / 100, relative: /^[+-]/u.test(text) };
}

/** The change to reach {@link amount} from the {@link current} size: the amount itself when relative. */
function change(amount: Amount, current: number): number {
  return amount.relative ? amount.points : amount.points - current;
}

/** Resize the float along {@link axis} by {@link amount} of the viewport. */
function resizeFloat(
  context: CommandContext,
  float: FloatPane,
  ...along: readonly [axis: SplitDir, amount: Amount]
): CommandOutcome {
  const [axis, amount] = along;
  const wide = axis === 'row';
  const delta = change(amount, wide ? float.rect.w : float.rect.h);
  context.dispatch({
    type: 'layout',
    action: {
      type: 'resizeFloat',
      paneId: float.paneId,
      dw: wide ? delta : 0,
      dh: wide ? 0 : delta,
    },
  });
  return OK;
}

/** Resize the focused pane along {@link axis}, whether it is a float or in the tree. */
function resizeFocused(context: CommandContext, axis: SplitDir, amount: Amount): CommandOutcome {
  const { tree, floats, focusedPaneId } = activeDesktop(context.state.layout);
  if (focusedPaneId === null) {
    return NOTHING_TO_RESIZE;
  }
  const float = findFloat(floats, focusedPaneId);
  if (float !== null) {
    return resizeFloat(context, float, axis, amount);
  }
  const share = tree === null ? null : paneShare(tree, focusedPaneId, axis);
  if (share === null) {
    return NOTHING_TO_RESIZE;
  }
  const delta = change(amount, share);
  context.dispatch({ type: 'layout', action: { type: 'resizePane', dir: axis, delta } });
  return OK;
}

/** Read the argument words and resize, or answer with the usage. */
function handle(args: string, context: CommandContext): CommandOutcome {
  const [word, size, ...extra] = wordsOf(args);
  const axis = AXES.get(word ?? '');
  const amount = parseAmount(size);
  if (axis === undefined || amount === null || extra.length > 0) {
    return fail(`Usage: ${USAGE}`);
  }
  return resizeFocused(context, axis, amount);
}

/** The `/resize` definition. */
export const command: CommandDefinition = {
  name: 'resize',
  usage: USAGE,
  summary: 'Resize the focused pane by percentage points, or set its share',
  run: syncRun(handle),
};
