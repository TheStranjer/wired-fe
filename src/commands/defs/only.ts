/**
 * `/only` (decision 6, decision 12): close every pane and float of the active
 * desktop except the focused one. Their windows stay open as hidden buffers,
 * still listed in the status line — unlike `/close`, which closes a window.
 */

import { t } from '../../i18n/translate';
import { activeDesktop } from '../../windows/desktops';
import { OK, contextRun, fail } from '../outcome';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandDefinition } from '../types';

/** The `/only` definition. */
export const command: CommandDefinition = {
  name: 'only',
  usage: '/only',
  get summary(): string {
    return t('commands.defs.only.summary');
  },
  bindings: [...tmuxBindings('z', ''), { mode: 'navigation', chord: 'w o', args: '' }],
  run: contextRun((context) => {
    const { layout } = context.state;
    if (activeDesktop(layout).focusedPaneId === null) {
      return fail(t('commands.defs.only.no_panes'));
    }
    context.dispatch({ type: 'layout', action: { type: 'only' } });
    return OK;
  }),
};
