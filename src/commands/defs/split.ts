/**
 * `/split [view…]` (alias `/sp`; decisions 6, 12 and 13): split the focused
 * pane stacked (`column`) and focus the new pane. Everything else is
 * `/vsplit`'s: no argument shows the same window in the new pane, and a view
 * spec opens a view into it (`/split tag rust`).
 */

import { t } from '../../i18n/translate';
import { VIEW_USAGE, splitRun } from '../splitRun';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandDefinition } from '../types';

/** The command's grammar: /help shows it, a bad argument echoes it. */
function usage(): string {
  return t('commands.defs.split.usage', { views: VIEW_USAGE });
}

/** The `/split` (alias `/sp`) definition. */
export const command: CommandDefinition = {
  name: 'split',
  aliases: ['sp'],
  get usage(): string {
    return usage();
  },
  get summary(): string {
    return t('commands.defs.split.summary');
  },
  run: splitRun('column', usage),
  bindings: [...tmuxBindings('"', ''), { mode: 'navigation', chord: 'w s', args: '' }],
};
