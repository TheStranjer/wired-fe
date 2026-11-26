/**
 * `/vsplit [view…]` (alias `/vs`; decisions 6, 12 and 13): split the focused
 * pane side by side (`row`) and focus the new pane. With no argument the new
 * pane shows the same window, as vim's `:vsplit` does; with one, the rest of
 * the line is a view spec (src/commands/viewSpec) opened the way its own
 * command opens it — `/vsplit tag rust`, `/vsplit win 3`. A spec that is not
 * one echoes the usage and splits nothing. Completion of the view names is
 * viewProvider's; their arguments complete as they do for the open commands.
 */

import { t } from '../../i18n/translate';
import { VIEW_USAGE, splitRun } from '../splitRun';
import { tmuxBindings } from '../tmuxBindings';
import type { CommandDefinition } from '../types';

/** The command's grammar: /help shows it, a bad argument echoes it. */
function usage(): string {
  return t('commands.defs.vsplit.usage', { views: VIEW_USAGE });
}

/** The `/vsplit` (alias `/vs`) definition. */
export const command: CommandDefinition = {
  name: 'vsplit',
  aliases: ['vs'],
  get usage(): string {
    return usage();
  },
  get summary(): string {
    return t('commands.defs.vsplit.summary');
  },
  run: splitRun('row', usage),
  bindings: [...tmuxBindings('%', ''), { mode: 'navigation', chord: 'w v', args: '' }],
};
