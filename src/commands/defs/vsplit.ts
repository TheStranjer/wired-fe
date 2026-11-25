/**
 * `/vsplit [view…]` (alias `/vs`; decisions 6, 12 and 13): split the focused
 * pane side by side (`row`) and focus the new pane. With no argument the new
 * pane shows the same window, as vim's `:vsplit` does; with one, the rest of
 * the line is a view spec (src/commands/viewSpec) opened the way its own
 * command opens it — `/vsplit tag rust`, `/vsplit win 3`. A spec that is not
 * one echoes the usage and splits nothing. Completion of the view names is
 * viewProvider's; their arguments complete as they do for the open commands.
 */

import { VIEW_USAGE, splitRun } from '../splitRun';
import type { CommandDefinition } from '../types';

/** The command's grammar: /help shows it, a bad argument echoes it. */
const USAGE = `/vsplit ${VIEW_USAGE}`;

/** The `/vsplit` (alias `/vs`) definition. */
export const command: CommandDefinition = {
  name: 'vsplit',
  aliases: ['vs'],
  usage: USAGE,
  summary: 'Split the focused pane side by side',
  run: splitRun('row', USAGE),
  bindings: [{ mode: 'navigation', chord: 'w v', args: '' }],
};
