/**
 * `/float move <dx> <dy>` and `/float size <dw> <dh>` (decisions 6 and 12):
 * nudge or resize the focused float from the keyboard, in percent of the
 * viewport. Positive moves go right and down; sizes grow from the bottom-right
 * corner. The layout reducer clamps the rectangle inside the viewport; this
 * module reads the numbers and hands the action over.
 */

import { focusedFloat } from './focusedFloat';
import { OK, fail } from './outcome';
import type { CommandContext, CommandOutcome } from './types';

/** The forms the two words take, for the refusal that echoes them. */
export const ADJUST_USAGE = 'move <dx> <dy> | size <dw> <dh>';

/** The refusal when the focused pane is not a float. */
const NOT_A_FLOAT = fail('The focused pane is not a float');

/** A signed or unsigned percentage, whole or decimal. */
const PERCENT = /^[+-]?\d+(?:\.\d+)?$/u;

/** The two percentages in {@link words} as viewport fractions, or null when they are not exactly two. */
function fractions(words: readonly string[]): readonly [number, number] | null {
  const [first, second, ...extra] = words;
  const valid =
    first !== undefined &&
    second !== undefined &&
    extra.length === 0 &&
    [first, second].every((w) => PERCENT.test(w));
  return valid ? [Number(first) / 100, Number(second) / 100] : null;
}

/**
 * Moves (`move`) or resizes (`size`) the focused float by the two percentages
 * in {@link words}; anything else echoes the grammar, and a focus that is not
 * a float says so.
 */
export function adjustFloat(
  context: CommandContext,
  word: 'move' | 'size',
  words: readonly string[],
): CommandOutcome {
  const delta = fractions(words);
  if (delta === null) {
    return fail(`Usage: /float ${ADJUST_USAGE}`);
  }
  const float = focusedFloat(context);
  if (float === null) {
    return NOT_A_FLOAT;
  }
  const [x, y] = delta;
  context.dispatch({
    type: 'layout',
    action:
      word === 'move'
        ? { type: 'moveFloat', paneId: float.paneId, dx: x, dy: y }
        : { type: 'resizeFloat', paneId: float.paneId, dw: x, dh: y },
  });
  return OK;
}
