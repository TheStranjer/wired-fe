/**
 * `/only` (decision 6, decision 12): close every pane and float of the active
 * desktop except the focused one. Their windows stay open as hidden buffers,
 * still listed in the status line — unlike `/close`, which closes a window.
 */

import { activeDesktop } from '../../windows/desktops';
import { OK, contextRun, fail } from '../outcome';
import type { CommandDefinition } from '../types';

/** The refusal on a desktop with nothing focused. */
const NO_PANES = fail('There are no panes on this desktop');

/** The `/only` definition. */
export const command: CommandDefinition = {
  name: 'only',
  usage: '/only',
  summary: 'Close every other pane and float; their windows stay open (unlike /close)',
  run: contextRun((context) => {
    const { layout } = context.state;
    if (activeDesktop(layout).focusedPaneId === null) {
      return NO_PANES;
    }
    context.dispatch({ type: 'layout', action: { type: 'only' } });
    return OK;
  }),
};
