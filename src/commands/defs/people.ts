/**
 * `/people` (decision 6, decision 13): who is in the focused window, as a
 * window of its own. It opens the people window of the focused window in a
 * `row` split to its right at ratio 0.8, so it looks like the old side pane
 * (WFE-220), and puts focus back on the watched window. It toggles: when the
 * active desktop already shows that people window, the command closes its
 * pane instead. A people window has nobody of its own to list, so asking
 * there is refused. The focused window is the subject; a trailing `--in <placement>`, or a
 * per-kind `openIn.people` setting, puts the window somewhere other than that
 * split (decision 13).
 */

import { peopleWindowId, peopleWindowOpen } from '../../state/peopleWindow';
import { type Placement, chosenPlacement } from '../../state/placement';
import { activeDesktop } from '../../windows/desktops';
import { activeWindow } from '../../windows/model';
import type { WindowState } from '../../windows/model';
import { paneShowing } from '../../windows/shownPanes';
import { splitPlacement } from '../openWindowRun';
import { OK, fail, syncRun } from '../outcome';
import type { CommandContext, CommandDefinition, CommandOutcome } from '../types';

/**
 * How far the new pane shrinks from the even split a fresh split starts as:
 * the people pane is the `b` side, so `a` — the watched window — ends at 0.8.
 */
const SHRINK = -0.3;

/** The refusal: a people window is not itself something to list. */
const NOTHING_TO_LIST = fail('A people window has no people of its own');

/** Show the people window of {@link watched} in a split to its right, focus staying put. */
function show(context: CommandContext, watched: WindowState): void {
  const windowId = peopleWindowId(watched);
  context.dispatch({ type: 'layout', action: { type: 'split', dir: 'row', windowId } });
  context.dispatchWindows(peopleWindowOpen(watched));
  context.dispatch({ type: 'layout', action: { type: 'resizePane', dir: 'row', delta: SHRINK } });
  context.dispatchWindows({ type: 'activate', id: watched.id });
}

/** Close the pane `paneId` showing a people window; focus returns to {@link watched}. */
function hide(context: CommandContext, watched: WindowState, paneId: string): void {
  context.dispatch({ type: 'layout', action: { type: 'focusPane', paneId } });
  context.dispatch({ type: 'layout', action: { type: 'closePane' } });
  context.dispatchWindows({ type: 'activate', id: watched.id });
}

/** Open the people window of {@link watched} as {@link placement} says, where the reader chose one. */
function place(context: CommandContext, watched: WindowState, placement: Placement): void {
  context.dispatch({ type: 'openPlaced', action: peopleWindowOpen(watched), placement });
}

/**
 * Toggle the people pane of the focused window. It opens in its own split to
 * the right unless `--in` or the per-kind setting for `people` places it; the
 * global default placement does not apply, since the split is its own default.
 */
function handle(args: string, context: CommandContext): CommandOutcome {
  const placed = splitPlacement(args);
  const watched = activeWindow(context.windows);
  if (!placed.ok) {
    return fail(placed.error);
  }
  if (watched.ref.kind === 'people') {
    return NOTHING_TO_LIST;
  }
  const paneId = paneShowing(activeDesktop(context.state.layout), peopleWindowId(watched));
  const chosen = chosenPlacement(context.state.settings, 'people', placed.value.placement);
  if (paneId !== null) {
    hide(context, watched, paneId);
  } else if (chosen === null) {
    show(context, watched);
  } else {
    place(context, watched, chosen);
  }
  return OK;
}

/** The `/people` definition. */
export const command: CommandDefinition = {
  name: 'people',
  usage: '/people',
  summary: 'Show or hide who is in this window',
  run: syncRun(handle),
};
