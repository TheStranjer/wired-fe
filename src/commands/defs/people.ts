/**
 * `/people` (decision 6, decision 13): who is in the focused window, as a
 * window of its own. It opens the people window of the focused window in a
 * `row` split to its right at ratio 0.8, so it looks like the old side pane
 * (WFE-220), and puts focus back on the watched window. It toggles: when the
 * active desktop already shows that people window, the command closes its
 * pane instead. A people window has nobody of its own to list, so asking
 * there is refused. Arguments are ignored: the focused window is the subject.
 */

import { peopleWindowId, peopleWindowOpen } from '../../state/peopleWindow';
import { activeDesktop } from '../../windows/desktops';
import { activeWindow } from '../../windows/model';
import type { WindowState } from '../../windows/model';
import { paneShowing } from '../../windows/shownPanes';
import { OK, contextRun, fail } from '../outcome';
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

/** Toggle the people pane of the focused window. */
function handle(context: CommandContext): CommandOutcome {
  const watched = activeWindow(context.windows);
  if (watched.ref.kind === 'people') {
    return NOTHING_TO_LIST;
  }
  const paneId = paneShowing(activeDesktop(context.state.layout), peopleWindowId(watched));
  if (paneId === null) {
    show(context, watched);
  } else {
    hide(context, watched, paneId);
  }
  return OK;
}

/** The `/people` definition. */
export const command: CommandDefinition = {
  name: 'people',
  usage: '/people',
  summary: 'Show or hide who is in this window',
  run: contextRun(handle),
};
