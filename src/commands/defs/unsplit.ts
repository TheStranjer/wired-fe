/**
 * `/unsplit` (decision 6, decision 12): close the focused pane or float. The
 * window it showed stays open as a hidden buffer, still listed in the status
 * line and still counting unread — unlike `/close`, which closes the window
 * and every pane showing it. Closing the last pane leaves the desktop empty.
 */

import { activeDesktop } from '../../windows/desktops';
import { OK, contextRun, fail } from '../outcome';
import type { CommandDefinition } from '../types';

/** The refusal on a desktop with nothing focused. */
const NO_PANE = fail('There is no pane to close on this desktop');

/** The `/unsplit` (alias `/pclose`) definition. */
export const command: CommandDefinition = {
  name: 'unsplit',
  aliases: ['pclose'],
  usage: '/unsplit',
  summary: 'Close the focused pane; its window stays open (unlike /close)',
  run: contextRun((context) => {
    const { layout } = context.state;
    if (activeDesktop(layout).focusedPaneId === null) {
      return NO_PANE;
    }
    context.dispatch({ type: 'layout', action: { type: 'closePane' } });
    return OK;
  }),
};
